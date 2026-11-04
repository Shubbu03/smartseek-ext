import { expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { LIBRARY_CHANNEL, requestLibrary } from "@/shared/libraryProtocol";
import { getMigrationStatus, getVideos, saveTimestamp, setFavorite, setSelected } from "@/library/storage";
import { STORAGE_KEYS } from "@/library/keys";
import { DATA_KEYS } from "@/library/dataKeys";
import { lectureVideo } from "../fixtures/videos";
import { deliverMessage } from "../helpers/runtime";
import { restartWorker } from "../helpers/worker";

function manifest() { vi.spyOn(fakeBrowser.runtime, "getManifest").mockReturnValue({ name: "SmartSeek", version: "2.0.0", manifest_version: 3 }); }

test("diagnostics count committed records without including IDs, titles, URLs, raw warnings or recovery content", async () => {
  manifest();
  await saveTimestamp({ ...lectureVideo, title: "Private title" });
  await setFavorite("lecture-a", true); await setSelected("lecture-a", true);
  const before = await fakeBrowser.storage.local.get(null);
  const diagnostics = await requestLibrary({ type: "diagnostics.get" });
  expect(diagnostics.library).toMatchObject({ status: "ready", videos: 1, favorites: 1, selected: 1 });
  expect(diagnostics.storage.status).toBe("ok");
  const json = JSON.stringify(diagnostics);
  expect(json).not.toContain("lecture-a"); expect(json).not.toContain("Private title");
  expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
});

test.each(["migration", "journal"])("recovery and diagnostics remain read-only when %s cannot finish", async (stage) => {
  manifest();
  if (stage === "journal") await getVideos();
  const damaged: Record<string, unknown> = stage === "migration"
    ? { [STORAGE_KEYS.meta]: { version: 99 }, video_progress: { secret: "untouched" }, unrelated: "excluded" }
    : { [DATA_KEYS.journal]: { version: "invalid", secret: "untouched" }, unrelated: "excluded" };
  await fakeBrowser.storage.local.set(damaged);
  restartWorker();
  await expect(getVideos()).rejects.toThrow();
  const before = await fakeBrowser.storage.local.get(null);
  const report = await requestLibrary({ type: "diagnostics.get" });
  expect(report.library.status).toBe("needs-recovery");
  expect(JSON.stringify(report)).not.toContain("untouched");
  const recovery = await requestLibrary({ type: "recovery.export" });
  expect(recovery.format).toBe("smartseek-recovery");
  expect(recovery.data).not.toHaveProperty("unrelated");
  expect(recovery.data[stage === "migration" ? "video_progress" : DATA_KEYS.journal]).toMatchObject({ secret: "untouched" });
  expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
});

test("unavailable storage is reported honestly and recovery read errors remain visible", async () => {
  manifest();
  vi.mocked(fakeBrowser.storage.local.get).mockRejectedValue(new Error("Cannot read storage"));
  vi.mocked(fakeBrowser.storage.local.getBytesInUse).mockRejectedValue(new Error("Cannot measure storage"));
  expect(await requestLibrary({ type: "diagnostics.get" })).toMatchObject({ storage: { status: "unavailable", usedBytes: null }, library: { status: "unavailable" } });
  await expect(requestLibrary({ type: "recovery.export" })).rejects.toThrow("Cannot read storage");
});

test("corrupt records and migration warnings are summarized without copying private values", async () => {
  manifest();
  await getVideos();
  const meta = await getMigrationStatus();
  await fakeBrowser.storage.local.set({ [STORAGE_KEYS.progress("lecture-a")]: { ...lectureVideo, lastWatched: -5 },
    [STORAGE_KEYS.meta]: { ...meta, warnings: ["Private warning about lecture-a"] } });
  const diagnostics = await requestLibrary({ type: "diagnostics.get" });
  expect(diagnostics.library).toMatchObject({ status: "needs-recovery", invalidRecords: 1, migrationWarnings: 1 });
  expect(JSON.stringify(diagnostics)).not.toContain("lecture-a");
});

test.each([{ type: "experience.get" }, { type: "experience.complete", saveMode: "selected" }, { type: "diagnostics.get" }, { type: "recovery.export" }])("content scripts cannot access private setup/support operations: $type", async (command) => {
  const sender = { id: fakeBrowser.runtime.id, url: "https://www.youtube.com/watch?v=lecture-a", frameId: 0, tab: { id: 42 } as chrome.tabs.Tab };
  expect(await deliverMessage({ channel: LIBRARY_CHANNEL, command }, sender)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  expect(await fakeBrowser.storage.local.get(null)).toEqual({});
});
