import { expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { deleteAllVideos, deleteVideo, getTimestamp, getVideos, saveTimestamp, setFavorite, setSelected, undoVideoRemoval } from "@/library/storage";
import { getSettings, saveSettings } from "@/settings/storage";
import { LIBRARY_CHANNEL } from "@/shared/libraryProtocol";
import { lectureVideo, tutorialVideo } from "../fixtures/videos";
import { applyLibraryImport, cancelLibraryImport, exportLibrary, previewLibraryImport } from "@/library/data";
import { DATA_KEYS } from "@/library/dataKeys";
import { STORAGE_KEYS } from "@/library/keys";
import { restartWorker } from "../helpers/worker";
import type { LibraryBackup } from "@/shared/libraryData";
import { deliverMessage } from "../helpers/runtime";

test("export returns a versioned backup with progress, choices and preferences", async () => {
  await saveTimestamp(lectureVideo);
  await setFavorite("lecture-a", true);
  await setSelected("lecture-a", true);
  await saveSettings({ saveMusicVideosOnly: true, saveMode: "selected", retentionDays: null });
  const reply = await chrome.runtime.sendMessage({ channel: LIBRARY_CHANNEL, command: { type: "library.export" } });
  expect(reply).toMatchObject({ ok: true, data: {
    format: "smartseek-backup", version: 1,
    videos: [{ ...lectureVideo, isFavorite: true, isSelected: true }],
    settings: { saveMusicVideosOnly: true, saveMode: "selected", retentionDays: null },
  } });
  expect(reply.data.videos[0]).toEqual({ ...lectureVideo, isFavorite: true, isSelected: true });
  expect(reply.data.settings).not.toHaveProperty("revision");
});

test("a merge preview does not write videos and applying it keeps newer rewinds and both sets of choices", async () => {
  await saveTimestamp(lectureVideo);
  await setFavorite("lecture-a", true);
  const backup = { format: "smartseek-backup", version: 1, exportedAt: lectureVideo.updatedAt,
    videos: [{ ...lectureVideo, lastWatched: 30, updatedAt: "2026-11-04T12:01:00.000Z", isSelected: true, isFavorite: false }],
    settings: { saveMusicVideosOnly: true, retentionDays: 30 },
  };
  const preview = await previewLibraryImport(backup, "merge");
  expect(preview).toMatchObject({ added: 0, updated: 1, removed: 0, total: 1, preferences: false });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(120);
  await applyLibraryImport(preview.id);
  expect(await getTimestamp("lecture-a")).toMatchObject({ lastWatched: 30, isFavorite: true, isSelected: true });
  expect((await getSettings()).retentionDays ?? null).toBeNull();
});

function backup(): LibraryBackup {
  return { format: "smartseek-backup", version: 1, exportedAt: lectureVideo.updatedAt,
    videos: [{ ...lectureVideo, lastWatched: 30, updatedAt: "2026-11-04T12:01:00Z", isFavorite: false }],
    settings: { saveMusicVideosOnly: true, saveMode: "selected", retentionDays: 30 },
  };
}

test("merge rebases against progress saved after the preview instead of overwriting a newer rewind", async () => {
  await saveTimestamp(lectureVideo);
  const preview = await previewLibraryImport(backup(), "merge");
  await saveTimestamp({ ...lectureVideo, lastWatched: 20, updatedAt: "2026-11-04T12:02:00Z" });
  await applyLibraryImport(preview.id);
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(20);
});

test("replace applies the reviewed library and imports preferences only when explicitly requested", async () => {
  await saveTimestamp(lectureVideo);
  await saveTimestamp(tutorialVideo);
  await setFavorite("lecture-a", true);
  const preview = await previewLibraryImport(backup(), "replace");
  expect(preview).toMatchObject({ updated: 1, removed: 1, total: 1, preferences: false });
  await applyLibraryImport(preview.id);
  expect(await getTimestamp("lecture-a")).toEqual(backup().videos[0]);
  expect(await getTimestamp("tutorial-b")).toBeNull();
  expect((await getSettings()).saveMusicVideosOnly).toBe(false);
  const withPreferences = await previewLibraryImport(backup(), "merge", true);
  await applyLibraryImport(withPreferences.id);
  expect(await getSettings()).toMatchObject({ saveMusicVideosOnly: true, saveMode: "selected", retentionDays: 30 });
});

test("a stale replace preview cannot discard progress saved while the user was reviewing it", async () => {
  await saveTimestamp(lectureVideo);
  const preview = await previewLibraryImport(backup(), "replace");
  await saveTimestamp({ ...lectureVideo, lastWatched: 250 });
  await expect(applyLibraryImport(preview.id)).rejects.toThrow("library changed");
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(250);
});

test("importing preferences restores implicit defaults rather than carrying over current auto-deletion", async () => {
  await saveSettings({ saveMusicVideosOnly: true, saveMode: "selected", autoResume: false, showSaveButton: false, retentionDays: 90 });
  const withDefaults = { ...backup(), settings: { saveMusicVideosOnly: false } };
  const preview = await previewLibraryImport(withDefaults, "merge", true);
  await applyLibraryImport(preview.id);
  const settings = await getSettings();
  expect(settings.retentionDays ?? null).toBeNull();
  expect(settings.saveMode ?? "automatic").toBe("automatic");
  expect(settings.autoResume ?? true).toBe(true);
  expect(settings.showSaveButton ?? true).toBe(true);
});

test("changed preferences require a fresh preview before imported preferences can replace them", async () => {
  const preview = await previewLibraryImport(backup(), "merge", true);
  await saveSettings({ saveMusicVideosOnly: false, autoResume: false });
  await expect(applyLibraryImport(preview.id)).rejects.toThrow("preferences changed");
  expect((await getSettings()).autoResume).toBe(false);
});

test("cancelled and expired previews cannot apply their data", async () => {
  const cancelled = await previewLibraryImport(backup(), "merge");
  await cancelLibraryImport(cancelled.id);
  await expect(applyLibraryImport(cancelled.id)).rejects.toThrow("expired");
  const expired = await previewLibraryImport(backup(), "merge");
  vi.setSystemTime(new Date(Date.now() + 600001));
  await expect(applyLibraryImport(expired.id)).rejects.toThrow("expired");
  expect(await getVideos()).toEqual({});
});

test("retrying a committed import after worker restart never replays it over later edits", async () => {
  const preview = await previewLibraryImport(backup(), "merge");
  const result = await applyLibraryImport(preview.id);
  await saveTimestamp({ ...lectureVideo, lastWatched: 250, updatedAt: "2026-11-04T12:02:00Z" });
  restartWorker();
  expect(await applyLibraryImport(preview.id)).toEqual(result);
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(250);
});

test.each([
  { version: 99 },
  { videos: [{ ...lectureVideo, lastWatched: -1 }] },
  { videos: [lectureVideo, lectureVideo] },
  { settings: { saveMusicVideosOnly: false, retentionDays: 45 } },
])("invalid backups are rejected before any library changes", async (invalid) => {
  await saveTimestamp(lectureVideo);
  await expect(previewLibraryImport({ ...backup(), ...invalid }, "merge")).rejects.toThrow();
  expect(await getVideos()).toEqual({ "lecture-a": lectureVideo });
});

test("prototype-like identifiers are ordinary video IDs and unknown fields never reach storage", async () => {
  const imported = { ...backup(), videos: [{ ...lectureVideo, videoId: "constructor", imageUrl: "https://example.com/private", checkpoint: { sequence: 999 } }] };
  const preview = await previewLibraryImport(imported, "merge");
  await applyLibraryImport(preview.id);
  expect(await getTimestamp("constructor")).toEqual({ ...lectureVideo, videoId: "constructor" });
  expect((await exportLibrary()).videos).toEqual([{ ...lectureVideo, videoId: "constructor" }]);
});

test("quota preflight refuses an import before changing the active library", async () => {
  await saveTimestamp(tutorialVideo);
  const preview = await previewLibraryImport(backup(), "replace");
  vi.mocked(fakeBrowser.storage.local.getBytesInUse).mockImplementation(async () => fakeBrowser.storage.local.QUOTA_BYTES);
  await expect(applyLibraryImport(preview.id)).rejects.toThrow("not enough local storage");
  expect(await getVideos()).toEqual({ "tutorial-b": tutorialVideo });
});

test.each(["journal", "records", "partial-records", "removals", "finish"])("an import interrupted during %s can recover before exposing its library", async (stage) => {
  await saveTimestamp(tutorialVideo);
  const preview = await previewLibraryImport(backup(), "replace");
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  const remove = fakeBrowser.storage.local.remove.bind(fakeBrowser.storage.local);
  const writing = vi.spyOn(fakeBrowser.storage.local, "set").mockImplementation(async (items: Record<string, unknown>) => {
    if (stage === "journal" && DATA_KEYS.journal in items) throw new Error("Interrupted journal");
    if ((stage === "records" || stage === "partial-records") && STORAGE_KEYS.progress("lecture-a") in items) {
      if (stage === "partial-records") await write({ [STORAGE_KEYS.progress("lecture-a")]: items[STORAGE_KEYS.progress("lecture-a")] });
      throw new Error("Interrupted records");
    }
    await write(items);
  });
  const removing = vi.spyOn(fakeBrowser.storage.local, "remove").mockImplementation(async (keys: string | string[]) => {
    if (stage === "removals" && Array.isArray(keys) && keys.includes(STORAGE_KEYS.progress("tutorial-b"))) throw new Error("Interrupted removals");
    if (stage === "finish" && keys === DATA_KEYS.journal) throw new Error("Interrupted finish");
    await remove(keys);
  });
  await expect(applyLibraryImport(preview.id)).rejects.toThrow("Interrupted");
  if (stage !== "journal") await expect(getVideos()).rejects.toThrow("Interrupted");
  writing.mockRestore();
  removing.mockRestore();
  restartWorker();
  if (stage === "journal") {
    expect(await getVideos()).toEqual({ "tutorial-b": tutorialVideo });
    await applyLibraryImport(preview.id);
  }
  expect(await getVideos()).toEqual({ "lecture-a": backup().videos[0] });
  expect(await applyLibraryImport(preview.id)).toMatchObject({ total: 1 });
});

test("an import invalidates older Undo receipts", async () => {
  await saveTimestamp(tutorialVideo);
  const removal = await deleteVideo("tutorial-b");
  const preview = await previewLibraryImport(backup(), "merge");
  await applyLibraryImport(preview.id);
  await expect(undoVideoRemoval(removal!.id)).rejects.toThrow("expired");
});

test("bulk clear discards pending previews and cannot replay a completed import", async () => {
  const completed = await previewLibraryImport(backup(), "merge");
  await applyLibraryImport(completed.id);
  const pending = await previewLibraryImport(backup(), "merge");
  await deleteAllVideos();
  await expect(applyLibraryImport(completed.id)).rejects.toThrow("expired");
  await expect(applyLibraryImport(pending.id)).rejects.toThrow("expired");
  expect(await getVideos()).toEqual({});
});

test("a YouTube content script cannot import, export, or undo library data", async () => {
  const sender = { id: "test-extension-id", url: "https://www.youtube.com/watch?v=lecture-a", frameId: 0, tab: { id: 42 } as chrome.tabs.Tab };
  for (const command of [{ type: "library.export" }, { type: "library.import.preview", backup: backup(), mode: "replace", includeSettings: true }, { type: "removal.undo", id: "receipt-a" }]) {
    expect(await deliverMessage({ channel: LIBRARY_CHANNEL, command }, sender)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  }
  expect(await getVideos()).toEqual({});
});
