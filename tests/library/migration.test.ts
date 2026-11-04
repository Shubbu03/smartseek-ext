import { expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  deleteAllVideos, getMigrationStatus, getTimestamp, getVideos, saveTimestamp, setFavorite,
} from "@/library/storage";
import { STORAGE_KEYS } from "@/library/keys";
import { getSettings, saveSettings } from "@/settings/storage";
import { lectureVideo, tutorialVideo } from "../fixtures/videos";
import { restartWorker } from "../helpers/worker";

const legacy = {
  video_progress: {
    "lecture-a": { ...lectureVideo, isFavorite: true, isMusic: true },
    "tutorial-b": tutorialVideo,
  },
  smartseek_settings: { saveMusicVideosOnly: true, defaultView: "favourites" },
};

test("a clean installation initializes an empty library with the existing defaults", async () => {
  expect(await getVideos()).toEqual({});
  expect(await getSettings()).toEqual({ saveMusicVideosOnly: false, defaultView: "recent" });
  expect(await getMigrationStatus()).toMatchObject({ version: 3, ready: true, warnings: [] });
});

test("legacy videos, favorites, music flags and settings migrate without changing the original snapshot", async () => {
  await fakeBrowser.storage.local.set(legacy);
  expect(await getVideos()).toEqual(legacy.video_progress);
  expect(await getSettings()).toEqual(legacy.smartseek_settings);

  const stored = await fakeBrowser.storage.local.get(null);
  expect(stored.video_progress).toEqual(legacy.video_progress);
  expect(stored.smartseek_settings).toEqual(legacy.smartseek_settings);
  expect(stored[STORAGE_KEYS.backup]).toMatchObject({ legacy });
  expect(stored[STORAGE_KEYS.progress("lecture-a")]).not.toHaveProperty("isFavorite");
  expect(stored[STORAGE_KEYS.preferences("lecture-a")]).toEqual({ isFavorite: true });
});

test("migration keeps old and completed records, and accepts missing optional metadata", async () => {
  const videos = {
    old: { ...lectureVideo, videoId: "old", updatedAt: "2020-01-01T00:00:00Z" },
    completed: { ...tutorialVideo, videoId: "completed", lastWatched: tutorialVideo.duration },
    minimal: { videoId: "minimal", lastWatched: 5, updatedAt: lectureVideo.updatedAt },
  };
  await fakeBrowser.storage.local.set({ video_progress: videos });
  expect(await getVideos()).toEqual(videos);
});

test("invalid legacy records are reported and preserved for recovery rather than erasing valid saves", async () => {
  const videos = {
    "lecture-a": lectureVideo,
    negative: { ...tutorialVideo, videoId: "negative", lastWatched: -5 },
    mismatch: tutorialVideo,
    broken: "unreadable",
  };
  await fakeBrowser.storage.local.set({ video_progress: videos, smartseek_settings: { defaultView: "invalid" } });
  expect(await getVideos()).toEqual({ "lecture-a": lectureVideo });
  expect((await getMigrationStatus()).warnings).toHaveLength(4);
  expect(await getSettings()).toEqual({ saveMusicVideosOnly: false, defaultView: "recent" });
  const backup = await fakeBrowser.storage.local.get(STORAGE_KEYS.backup);
  expect(backup[STORAGE_KEYS.backup]).toMatchObject({ legacy: { video_progress: videos } });
});

test.each([{ value: null }, { value: [] }, { value: "malformed" }])("a malformed legacy map ($value) remains recoverable", async ({ value: video_progress }) => {
  // The fake browser treats null as deletion, unlike Chrome; seed it through the backup when needed.
  await fakeBrowser.storage.local.set({
    [STORAGE_KEYS.backup]: { capturedAt: lectureVideo.updatedAt, legacy: { video_progress } },
  });
  expect(await getVideos()).toEqual({});
  expect((await getMigrationStatus()).warnings).toHaveLength(1);
  const saved = await fakeBrowser.storage.local.get(STORAGE_KEYS.backup);
  expect(saved[STORAGE_KEYS.backup]).toMatchObject({ legacy: { video_progress } });
});

test.each(["backup", "records", "ready"])("migration can resume after a rejected %s write", async (stage) => {
  await fakeBrowser.storage.local.set(legacy);
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  const failingKey = stage === "backup" ? STORAGE_KEYS.backup
    : stage === "records" ? STORAGE_KEYS.settings : STORAGE_KEYS.meta;
  const failure = vi.spyOn(fakeBrowser.storage.local, "set").mockImplementation(async (items) => {
    if (failingKey in items) throw new Error(`Rejected ${stage} write`);
    await write(items);
  });
  await expect(saveTimestamp({ ...tutorialVideo, lastWatched: 300 })).rejects.toThrow(`Rejected ${stage}`);
  const interrupted = await fakeBrowser.storage.local.get(null);
  expect(interrupted[STORAGE_KEYS.meta]).toBeUndefined();
  expect(interrupted.video_progress).toEqual(legacy.video_progress);

  failure.mockRestore();
  restartWorker();
  expect(await getVideos()).toEqual(legacy.video_progress);
  expect(await getSettings()).toEqual(legacy.smartseek_settings);
});

test("a partially written migration retries from its immutable backup", async () => {
  await fakeBrowser.storage.local.set(legacy);
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  const failure = vi.spyOn(fakeBrowser.storage.local, "set").mockImplementation(async (items) => {
    if (STORAGE_KEYS.settings in items) {
      await write({ [STORAGE_KEYS.progress("lecture-a")]: { ...lectureVideo, lastWatched: 1 } });
      throw new Error("Worker stopped during record writes");
    }
    await write(items);
  });
  await expect(getVideos()).rejects.toThrow("Worker stopped");
  failure.mockRestore();
  await fakeBrowser.storage.local.set({ video_progress: {} });
  restartWorker();
  expect(await getVideos()).toEqual(legacy.video_progress);
});

test("failed read-back verification never commits a ready marker and can be retried", async () => {
  await fakeBrowser.storage.local.set(legacy);
  // The mock uses the Promise overload; Chrome's final declaration is the callback overload.
  const read = vi.mocked(fakeBrowser.storage.local.get).getMockImplementation()! as
    (keys: string | string[] | Record<string, unknown> | null | undefined) => Promise<Record<string, unknown>>;
  vi.mocked(fakeBrowser.storage.local.get).mockImplementation(async (keys) => {
    const result = await read(keys);
    if (Array.isArray(keys) && (keys as string[]).includes(STORAGE_KEYS.backup)) {
      delete result[STORAGE_KEYS.progress("lecture-a")];
    }
    return result;
  });
  await expect(getVideos()).rejects.toThrow("verification failed");
  expect((await fakeBrowser.storage.local.get(null))[STORAGE_KEYS.meta]).toBeUndefined();
  vi.mocked(fakeBrowser.storage.local.get).mockImplementation(read);
  expect(await getVideos()).toEqual(legacy.video_progress);
});

test("worker restart after migration never reimports stale legacy data over v3 edits", async () => {
  await fakeBrowser.storage.local.set(legacy);
  await getVideos();
  await saveTimestamp({ ...lectureVideo, lastWatched: 250 });
  await setFavorite("lecture-a", false);
  await saveSettings({ saveMusicVideosOnly: false, defaultView: "music" });
  restartWorker();
  expect(await getTimestamp("lecture-a")).toMatchObject({ lastWatched: 250, isFavorite: false });
  expect(await getSettings()).toEqual({ saveMusicVideosOnly: false, defaultView: "music" });
  expect((await fakeBrowser.storage.local.get("video_progress")).video_progress).toEqual(legacy.video_progress);
});

test("quota headroom failure preserves legacy data and blocks new writes", async () => {
  await fakeBrowser.storage.local.set(legacy);
  vi.mocked(fakeBrowser.storage.local.getBytesInUse).mockImplementation(async () => fakeBrowser.storage.local.QUOTA_BYTES);
  await expect(saveTimestamp({ ...lectureVideo, lastWatched: 300 })).rejects.toThrow("Not enough local storage");
  expect(await fakeBrowser.storage.local.get(null)).toEqual(legacy);
});

test.each([
  { [STORAGE_KEYS.meta]: { version: 4, ready: true } },
  { [STORAGE_KEYS.backup]: { legacy: "damaged" } },
  { [STORAGE_KEYS.progress("lecture-a")]: lectureVideo },
])("unrecognized schema or damaged migration state blocks writes without deleting data", async (state) => {
  await fakeBrowser.storage.local.set<Record<string, unknown>>(state);
  await expect(saveTimestamp(lectureVideo)).rejects.toThrow(/schema|backup/);
  expect(await fakeBrowser.storage.local.get(null)).toEqual(state);
});

test("clearing videos removes recoverable video snapshots and does not resurrect them after restart", async () => {
  await fakeBrowser.storage.local.set(legacy);
  await getVideos();
  await deleteAllVideos();
  restartWorker();
  expect(await getVideos()).toEqual({});
  expect(await getSettings()).toEqual(legacy.smartseek_settings);
  const stored = await fakeBrowser.storage.local.get(null);
  expect(stored[STORAGE_KEYS.backup]).toBeUndefined();
  expect(stored.video_progress).toBeUndefined();
});

test("clearing videos also clears migration warnings for the deleted recovery snapshot", async () => {
  await fakeBrowser.storage.local.set({ video_progress: { broken: "unreadable" } });
  expect((await getMigrationStatus()).warnings).toHaveLength(1);
  await deleteAllVideos();
  restartWorker();
  expect((await getMigrationStatus()).warnings).toEqual([]);
});

test("a ready-marker write committed before a lost reply is not replayed after restart", async () => {
  await fakeBrowser.storage.local.set(legacy);
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  const failure = vi.spyOn(fakeBrowser.storage.local, "set").mockImplementation(async (items) => {
    await write(items);
    if (STORAGE_KEYS.meta in items) throw new Error("Worker stopped before reply");
  });
  await expect(getVideos()).rejects.toThrow("Worker stopped before reply");
  failure.mockRestore();
  restartWorker();
  await saveTimestamp({ ...lectureVideo, lastWatched: 280 });
  restartWorker();
  expect(await getTimestamp("lecture-a")).toMatchObject({ lastWatched: 280, isFavorite: true });
});
