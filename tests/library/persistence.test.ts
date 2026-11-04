import { expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  cleanupOldTimestamps, getTimestamp, getVideos, saveTimestamp, setFavorite, watchVideos,
} from "@/library/storage";
import { STORAGE_KEYS } from "@/library/keys";
import { getSettings, saveSettings, watchSettings } from "@/settings/storage";
import { lectureVideo, tutorialVideo } from "../fixtures/videos";
import { restartWorker } from "../helpers/worker";

test.each([true, false])("overlapping progress and explicit favorite changes preserve favorite=%s", async (favorite) => {
  await saveTimestamp(lectureVideo);
  await Promise.all([
    setFavorite("lecture-a", favorite),
    saveTimestamp({ ...lectureVideo, lastWatched: 200 }),
    saveTimestamp(tutorialVideo),
  ]);
  expect(await getTimestamp("lecture-a")).toEqual({ ...lectureVideo, lastWatched: 200, isFavorite: favorite });
  expect(await getTimestamp("tutorial-b")).toEqual(tutorialVideo);
});

test("repeated explicit favorite commands are idempotent and checkpoints cannot supply favorite choices", async () => {
  await saveTimestamp(lectureVideo);
  await setFavorite("lecture-a", true);
  await setFavorite("lecture-a", true);
  await saveTimestamp({ ...lectureVideo, lastWatched: 220, isFavorite: false });
  expect(await getTimestamp("lecture-a")).toMatchObject({ lastWatched: 220, isFavorite: true });
});

test("an intentional rewind and missing new metadata preserve the requested position and existing metadata", async () => {
  await saveTimestamp(lectureVideo);
  await saveTimestamp({ videoId: "lecture-a", lastWatched: 20, updatedAt: lectureVideo.updatedAt });
  expect(await getTimestamp("lecture-a")).toEqual({ ...lectureVideo, lastWatched: 20 });
});

test("a rejected checkpoint is reported, retains the committed position and does not poison later writes", async () => {
  await saveTimestamp(lectureVideo);
  const failure = vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("QUOTA_BYTES exceeded"));
  await expect(saveTimestamp({ ...lectureVideo, lastWatched: 200 })).rejects.toThrow("QUOTA_BYTES exceeded");
  failure.mockRestore();
  expect(await getTimestamp("lecture-a")).toEqual(lectureVideo);
  await saveTimestamp(tutorialVideo);
  expect(await getTimestamp("tutorial-b")).toEqual(tutorialVideo);
});

test("save success waits for the durable storage write", async () => {
  await getVideos();
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  vi.spyOn(fakeBrowser.storage.local, "set").mockImplementation(async (items) => {
    entered.resolve();
    await release.promise;
    await write(items);
  });
  let acknowledged = false;
  const saving = saveTimestamp(lectureVideo).then(() => { acknowledged = true; });
  await entered.promise;
  expect(acknowledged).toBe(false);
  const pending = await fakeBrowser.storage.local.get(STORAGE_KEYS.progress("lecture-a"));
  expect(pending[STORAGE_KEYS.progress("lecture-a")]).toBeUndefined();
  release.resolve();
  await saving;
  expect(acknowledged).toBe(true);
  expect(await getTimestamp("lecture-a")).toEqual(lectureVideo);
});

test("successful progress and preference writes survive a worker restart", async () => {
  await saveTimestamp(lectureVideo);
  await setFavorite("lecture-a", true);
  restartWorker();
  expect(await getTimestamp("lecture-a")).toEqual({ ...lectureVideo, isFavorite: true });
});

test("reads never expire records and maintenance keeps old favorites and completed recent saves", async () => {
  await saveSettings({ saveMusicVideosOnly: false, retentionDays: 30 });
  const old = "2020-01-01T00:00:00Z";
  await saveTimestamp({ ...lectureVideo, updatedAt: old });
  await setFavorite("lecture-a", true);
  await saveTimestamp({ ...tutorialVideo, updatedAt: old });
  const completed = { ...lectureVideo, videoId: "completed", lastWatched: 600 };
  await saveTimestamp(completed);
  expect(await getTimestamp("tutorial-b")).not.toBeNull();
  await cleanupOldTimestamps();
  expect(await getTimestamp("tutorial-b")).toBeNull();
  expect(await getTimestamp("lecture-a")).toMatchObject({ isFavorite: true });
  expect(await getTimestamp("completed")).toEqual(completed);
});

test("maintenance removes no more than 100 expired records per pass", async () => {
  const oldVideos = Object.fromEntries(Array.from({ length: 105 }, (_, index) => {
    const videoId = `old-${index}`;
    return [videoId, { ...lectureVideo, videoId, updatedAt: "2020-01-01T00:00:00Z" }];
  }));
  await fakeBrowser.storage.local.set({ video_progress: oldVideos });
  expect(Object.keys(await getVideos())).toHaveLength(105);
  await saveSettings({ saveMusicVideosOnly: false, retentionDays: 30 });
  await cleanupOldTimestamps();
  expect(Object.keys(await getVideos())).toHaveLength(5);
});

test("library and settings subscribers see their own committed changes and can unsubscribe", async () => {
  await getVideos();
  const libraryChanged = vi.fn();
  const settingsChanged = vi.fn();
  const unwatchVideos = watchVideos(libraryChanged);
  const unwatchSettings = watchSettings(settingsChanged);
  await saveTimestamp(lectureVideo);
  expect(libraryChanged).toHaveBeenCalled();
  expect(settingsChanged).not.toHaveBeenCalled();
  libraryChanged.mockClear();
  await saveSettings({ saveMusicVideosOnly: true });
  expect(settingsChanged).toHaveBeenCalled();
  expect(libraryChanged).not.toHaveBeenCalled();
  unwatchVideos();
  unwatchSettings();
  settingsChanged.mockClear();
  await saveTimestamp(tutorialVideo);
  await saveSettings({ saveMusicVideosOnly: false });
  expect(libraryChanged).not.toHaveBeenCalled();
  expect(settingsChanged).not.toHaveBeenCalled();
});

test("corrupt ready-state data is surfaced without overwriting it or substituting an empty library", async () => {
  await saveTimestamp(lectureVideo);
  await fakeBrowser.storage.local.set({ [STORAGE_KEYS.progress("lecture-a")]: { lastWatched: -1 } });
  await expect(getVideos()).rejects.toThrow("damaged");
  await expect(saveTimestamp(lectureVideo)).rejects.toThrow("damaged");
  await fakeBrowser.storage.local.set({ [STORAGE_KEYS.settings]: { saveMusicVideosOnly: "yes" } });
  await expect(getSettings()).rejects.toThrow("damaged");
});
