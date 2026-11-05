import { afterEach, expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { exportLibrary } from "@/library/data";
import { getTimestamp, getVideos, saveTimestamp, setFavorite } from "@/library/storage";
import { getSettings, saveSettings } from "@/settings/storage";
import { MAX_BACKUP_BYTES } from "@/shared/libraryData";
import { readBackupFile } from "@/popup/backup";
import { lectureVideo, tutorialVideo } from "../fixtures/videos";
import { renderPopup } from "../helpers/popup";

let popup: Awaited<ReturnType<typeof renderPopup>> | undefined;
afterEach(async () => { await popup?.dispose(); popup = undefined; });

test("Export downloads a versioned JSON backup of committed data", async () => {
  await saveTimestamp(lectureVideo);
  await setFavorite("lecture-a", true);
  popup = await renderPopup();
  let downloaded: { url: string; name: string } | undefined;
  vi.spyOn(popup.host.HTMLAnchorElement.prototype, "click").mockImplementation(function (this: { href: string; download: string }) {
    downloaded = { url: this.href, name: this.download };
  });
  await popup.click('[aria-label="Open settings"]');
  await popup.click(".backup-actions > button:first-child");
  expect(downloaded?.name).toBe("smartseek-backup-2026-11-04.json");
  expect(await (await fetch(downloaded!.url)).json()).toEqual(await exportLibrary());
  expect(popup.get(".backup-message").textContent).toContain("Backup download started");
});

test("Import previews a merge and keeps current preferences unless explicitly requested", async () => {
  await saveTimestamp(tutorialVideo);
  await saveSettings({ saveMusicVideosOnly: false, retentionDays: 90, saveMode: "selected" });
  const backup = { ...await exportLibrary(), videos: [{ ...lectureVideo, isFavorite: true }],
    settings: { ...await getSettings(), retentionDays: null, saveMode: "automatic" } };
  popup = await renderPopup();
  await popup.click('[aria-label="Open settings"]');
  await popup.upload(JSON.stringify(backup));
  await popup.waitFor('.import-dialog .button-primary:not(:disabled)');
  expect(popup.get("dialog").hasAttribute("open")).toBe(true);
  expect(popup.get(".import-preview").textContent).toContain("2 saved after import");
  expect(popup.get("#import-preferences").getAttribute("aria-checked")).toBe("false");
  expect(Object.keys(await getVideos())).toEqual(["tutorial-b"]);
  await popup.click(".import-dialog .button-primary");
  await popup.waitFor(".toast");
  expect(popup.container.querySelector("dialog")).toBeNull();
  expect(await getTimestamp("lecture-a")).toMatchObject({ isFavorite: true, lastWatched: 120 });
  expect(await getTimestamp("tutorial-b")).not.toBeNull();
  expect(await getSettings()).toMatchObject({ retentionDays: 90, saveMode: "selected" });
  expect(popup.get(".toast").textContent).toContain("Import complete. 2 videos");
});

test("Replace is separately reviewed, can be cancelled, and imports preferences only after opting in", async () => {
  await saveTimestamp(tutorialVideo);
  const backup = { ...await exportLibrary(), videos: [lectureVideo],
    settings: { ...await getSettings(), retentionDays: 60, saveMode: "selected" } };
  popup = await renderPopup();
  await popup.click('[aria-label="Open settings"]');
  await popup.upload(JSON.stringify(backup));
  await popup.waitFor('.import-dialog .button-primary:not(:disabled)');
  await popup.click('input[value="replace"]');
  await popup.waitFor('.import-dialog .button-danger:not(:disabled)');
  expect(popup.get(".import-counts > div:last-child strong").textContent).toBe("1");
  await popup.click(".dialog-actions .button-secondary");
  expect(Object.keys(await getVideos())).toEqual(["tutorial-b"]);
  await popup.upload(JSON.stringify(backup));
  await popup.waitFor('.import-dialog .button-primary:not(:disabled)');
  await popup.click('input[value="replace"]');
  await popup.click("#import-preferences");
  await popup.waitFor('.import-dialog .button-danger:not(:disabled)');
  expect(popup.get(".import-preferences-note").textContent).toContain("60 days");
  await popup.click(".import-dialog .button-danger");
  await popup.waitFor('#auto-delete[aria-checked="true"]');
  expect(Object.keys(await getVideos())).toEqual(["lecture-a"]);
  expect(await getSettings()).toMatchObject({ retentionDays: 60, saveMode: "selected" });
  expect(popup.get("#auto-delete").getAttribute("aria-checked")).toBe("true");
});

test("invalid backup files show a useful error without opening an import or changing data", async () => {
  await saveTimestamp(lectureVideo);
  popup = await renderPopup();
  await popup.click('[aria-label="Open settings"]');
  await popup.upload("not JSON");
  expect(popup.get('.library-data-tools [role="alert"]').textContent).toContain("could not be read as JSON");
  expect(popup.container.querySelector("dialog")).toBeNull();
  await popup.upload(JSON.stringify({ format: "some-other-backup", videos: [] }));
  expect(popup.get('.library-data-tools [role="alert"]').textContent).toContain("SmartSeek");
  expect(await getTimestamp("lecture-a")).toEqual(lectureVideo);
  const text = vi.fn();
  await expect(readBackupFile({ size: MAX_BACKUP_BYTES + 1, text } as unknown as File)).rejects.toThrow("10 MB");
  expect(text).not.toHaveBeenCalled();
});

test("a failed export is visible and does not claim a download succeeded", async () => {
  popup = await renderPopup();
  await popup.click('[aria-label="Open settings"]');
  vi.mocked(fakeBrowser.runtime.sendMessage).mockImplementationOnce(async () => ({ ok: false, message: "Export storage is unavailable" }));
  await popup.click(".backup-actions > button:first-child");
  expect(popup.get('.library-data-tools [role="alert"]').textContent).toContain("Export storage is unavailable");
  expect(popup.container.querySelector('.library-data-tools [role="status"]')).toBeNull();
});

test("Undo remains available after reopening the popup, and bulk clear still requires confirmation", async () => {
  await saveTimestamp(lectureVideo);
  popup = await renderPopup();
  await popup.click(".video-options > summary");
  await popup.click(".remove-button");
  await popup.dispose();
  popup = await renderPopup();
  await popup.click(".undo-button");
  expect(await getTimestamp("lecture-a")).toEqual(lectureVideo);
  await popup.click('[aria-label="Open settings"]');
  await popup.click(".clear-library-button");
  await popup.click(".dialog-actions .button-secondary");
  expect(await getTimestamp("lecture-a")).not.toBeNull();
  await popup.click(".clear-library-button");
  await popup.click(".dialog-actions .button-danger");
  expect(await getVideos()).toEqual({});
  expect(popup.container.querySelector(".undo-button")).toBeNull();
});
