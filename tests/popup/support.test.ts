import { afterEach, expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { STORAGE_KEYS } from "@/library/keys";
import { lectureVideo } from "../fixtures/videos";
import { renderPopup } from "../helpers/popup";

let popup: Awaited<ReturnType<typeof renderPopup>> | undefined;
afterEach(async () => { await popup?.dispose(); popup = undefined; });

test("an issue report can be reviewed, copied and downloaded without exposing player identity or sending anything", async () => {
  popup = await renderPopup({ supported: true, videoId: "secret-video", title: "Private video title", state: "saved", selected: true, canSave: true, position: 120, message: "Private video title secret-video" });
  const copy = vi.spyOn(popup.host.navigator.clipboard, "writeText").mockResolvedValue();
  let download: { url: string; name: string } | undefined;
  vi.spyOn(popup.host.HTMLAnchorElement.prototype, "click").mockImplementation(function (this: { href: string; download: string }) { download = { url: this.href, name: this.download }; });
  await popup.click('[aria-label="Open settings"]');
  await popup.click(".settings-navigation:first-of-type");
  await popup.type("#issue-doing", "Switched videos in a playlist");
  await popup.type("#issue-expected", "The new video should start normally");
  await popup.type("#issue-happened", "It jumped back");
  await popup.click('.report-form button[type="submit"]');
  await popup.waitFor("#support-report");
  const report = (popup.get("#support-report") as InstanceType<typeof popup.host.HTMLTextAreaElement>).value;
  expect(report).toContain("Switched videos in a playlist");
  expect(report).not.toContain("secret-video"); expect(report).not.toContain("Private video title");
  expect(JSON.parse(report).player).toEqual({ page: "watch", state: "saved", canSave: true });
  expect(copy).not.toHaveBeenCalled(); expect(download).toBeUndefined();
  await popup.click(".prepared-report .backup-actions button:first-child");
  expect(copy).toHaveBeenCalledWith(report);
  expect(popup.get('[role="status"]').textContent).toContain("Report copied");
  await popup.click(".prepared-report .backup-actions button:last-child");
  expect(download?.name).toBe("smartseek-report-2026-11-04.json");
  expect(await (await fetch(download!.url)).json()).toEqual(JSON.parse(report));
  await popup.type("#issue-happened", "A corrected description");
  expect(popup.container.querySelector("#support-report")).toBeNull();
});

test("clipboard failure offers an alternative and does not claim the report was copied", async () => {
  popup = await renderPopup();
  vi.spyOn(popup.host.navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied"));
  await popup.click('[aria-label="Open settings"]'); await popup.click(".settings-navigation:first-of-type");
  await popup.click('.report-form button[type="submit"]'); await popup.waitFor("#support-report");
  await popup.click(".prepared-report .backup-actions button:first-child");
  expect(popup.get('[role="alert"]').textContent).toContain("Download it");
  expect(popup.container.querySelector('[role="status"]')).toBeNull();
});

test("failed migration exposes recovery export and support without loading or mutating the damaged library", async () => {
  await fakeBrowser.storage.local.set({ [STORAGE_KEYS.meta]: { version: 99 }, video_progress: { "lecture-a": lectureVideo } });
  popup = await renderPopup();
  expect(popup.get(".load-error").textContent).toContain("Keep SmartSeek installed");
  const before = await fakeBrowser.storage.local.get(null);
  let url = "";
  vi.spyOn(popup.host.HTMLAnchorElement.prototype, "click").mockImplementation(function (this: { href: string }) { url = this.href; });
  await popup.click(".recovery-actions button");
  const snapshot = await (await fetch(url)).json();
  expect(snapshot.format).toBe("smartseek-recovery");
  expect(snapshot.data.video_progress).toEqual({ "lecture-a": lectureVideo });
  expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
  await popup.click(".load-error > .text-button");
  expect(popup.get(".support-content")).toBeDefined();
  await popup.click('.report-form button[type="submit"]'); await popup.waitFor("#support-report");
  const report = JSON.parse((popup.get("#support-report") as InstanceType<typeof popup.host.HTMLTextAreaElement>).value);
  expect(report.library.status).toBe("needs-recovery");
  expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
});

test("privacy guidance explains local storage and reports, and navigation returns to Settings", async () => {
  popup = await renderPopup();
  await popup.click('[aria-label="Open settings"]'); await popup.click(".settings-navigation:nth-of-type(3)");
  expect(popup.get(".information-content").textContent).toContain("Nothing is sent automatically");
  expect(popup.host.document.activeElement).toBe(popup.get("h1"));
  await popup.click('[aria-label="Back to settings"]');
  expect(popup.get("#density")).toBeDefined();
  expect(popup.host.document.activeElement).toBe(popup.get("h1"));
});
