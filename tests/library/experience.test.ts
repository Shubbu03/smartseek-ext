import { expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { requestLibrary } from "@/shared/libraryProtocol";
import { getSettings, saveSettings } from "@/settings/storage";
import { deleteAllVideos, getMigrationStatus, getVideos } from "@/library/storage";
import { applyLibraryImport, exportLibrary, previewLibraryImport } from "@/library/data";
import { STORAGE_KEYS } from "@/library/keys";
import { lectureVideo } from "../fixtures/videos";
import { restartWorker } from "../helpers/worker";

test("a fresh installation chooses its saving mode once and remains ready after worker restart and clearing videos", async () => {
  expect(await requestLibrary({ type: "experience.get" })).toEqual({ step: "welcome" });
  await expect(requestLibrary({ type: "experience.complete" })).rejects.toThrow("Choose a saving mode");
  await requestLibrary({ type: "experience.complete", saveMode: "selected" });
  expect(await getSettings()).toMatchObject({ saveMode: "selected" });
  restartWorker();
  expect(await requestLibrary({ type: "experience.get" })).toEqual({ step: "ready" });
  await deleteAllVideos();
  expect(await requestLibrary({ type: "experience.get" })).toEqual({ step: "ready" });
});

test("returning users see the upgrade once and keep their preferences and migrated videos", async () => {
  await fakeBrowser.storage.local.set({ video_progress: { "lecture-a": lectureVideo },
    smartseek_settings: { saveMusicVideosOnly: true, saveMode: "selected", autoResume: false, retentionDays: null } });
  expect(await requestLibrary({ type: "experience.get" })).toEqual({ step: "upgrade" });
  await requestLibrary({ type: "experience.complete", saveMode: "automatic" });
  expect(await getSettings()).toMatchObject({ saveMusicVideosOnly: true, saveMode: "selected", autoResume: false, retentionDays: null });
  expect(await getVideos()).toEqual({ "lecture-a": lectureVideo });
  restartWorker();
  expect(await requestLibrary({ type: "experience.get" })).toEqual({ step: "ready" });
});

test("existing v3 installations without the new audience field receive the upgrade message", async () => {
  await getVideos();
  const meta = await getMigrationStatus();
  delete meta.installation;
  await fakeBrowser.storage.local.set({ [STORAGE_KEYS.meta]: meta });
  restartWorker();
  expect(await requestLibrary({ type: "experience.get" })).toEqual({ step: "upgrade" });
});

test("setup failure never claims completion and a retry preserves the chosen mode", async () => {
  await requestLibrary({ type: "experience.get" });
  vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("Storage is full"));
  await expect(requestLibrary({ type: "experience.complete", saveMode: "selected" })).rejects.toThrow("Storage is full");
  expect(await requestLibrary({ type: "experience.get" })).toEqual({ step: "welcome" });
  await requestLibrary({ type: "experience.complete", saveMode: "selected" });
  await saveSettings({ ...await getSettings(), saveMode: "automatic" });
  await requestLibrary({ type: "experience.complete", saveMode: "selected" });
  expect((await getSettings()).saveMode).toBe("automatic");
});

test("appearance round-trips through backup imports without carrying setup completion between installations", async () => {
  await saveSettings({ saveMusicVideosOnly: false, theme: "dark", density: "compact" });
  const backup = await exportLibrary();
  expect(backup.settings).toMatchObject({ theme: "dark", density: "compact" });
  expect(backup).not.toHaveProperty("experience");
  await saveSettings({ ...await getSettings(), theme: "light", density: "comfortable" });
  await applyLibraryImport((await previewLibraryImport(backup, "merge", true)).id);
  expect(await getSettings()).toMatchObject({ theme: "dark", density: "compact" });
  expect(await requestLibrary({ type: "experience.get" })).toEqual({ step: "welcome" });
});

test.each([{ theme: "neon" }, { density: "tiny" }])("invalid appearance preferences are rejected before mutation", async (invalid) => {
  const reply = await chrome.runtime.sendMessage({ channel: "smartseek:library:v3", command: { type: "settings.save", settings: { saveMusicVideosOnly: false, ...invalid } } });
  expect(reply).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  expect(await fakeBrowser.storage.local.get(null)).toEqual({});
});
