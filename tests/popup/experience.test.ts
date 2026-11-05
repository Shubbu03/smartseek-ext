import { afterEach, expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { getSettings } from "@/settings/storage";
import { getTimestamp } from "@/library/storage";
import { lectureVideo } from "../fixtures/videos";
import { renderPopup } from "../helpers/popup";

let popup: Awaited<ReturnType<typeof renderPopup>> | undefined;
afterEach(async () => { await popup?.dispose(); popup = undefined; });

test("first-run setup explains manual saving and persists the selected mode across popup sessions", async () => {
  popup = await renderPopup(undefined, { showIntro: true });
  expect(popup.get("h1").textContent).toContain("Keep your place");
  expect(popup.container.querySelector('[aria-label="Open settings"]')).toBeNull();
  await popup.click('input[value="selected"]');
  await popup.click(".intro-continue");
  await popup.waitFor(".intro-tip");
  expect(popup.get(".intro-tip").textContent).toContain("Save once, keep watching");
  expect((await getSettings()).saveMode).toBe("selected");
  await popup.click(".intro-continue");
  expect(popup.get("h1").textContent).toBe("Recent saves (0)");
  await popup.dispose();
  popup = await renderPopup(undefined, { showIntro: true });
  expect(popup.get("h1").textContent).toBe("Recent saves (0)");
});

test("setup write failure stays visible and can be retried without claiming success", async () => {
  popup = await renderPopup(undefined, { showIntro: true });
  await popup.click('input[value="selected"]');
  vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("Storage is full"));
  await popup.click(".intro-continue");
  expect(popup.get('[role="alert"]').textContent).toContain("Storage is full");
  expect(popup.container.querySelector(".intro-tip")).toBeNull();
  await popup.click(".intro-continue");
  await popup.waitFor(".intro-tip");
  expect((await getSettings()).saveMode).toBe("selected");
});

test("returning-user messaging is one-time, preserves saves and preferences, and remains available in Settings", async () => {
  await fakeBrowser.storage.local.set({ video_progress: { "lecture-a": lectureVideo }, smartseek_settings: { saveMusicVideosOnly: true, saveMode: "selected" } });
  popup = await renderPopup(undefined, { showIntro: true });
  expect(popup.get(".whats-new").textContent).toContain("existing saving preferences stay");
  await popup.click(".intro-continue");
  expect((await getSettings()).saveMode).toBe("selected");
  expect(await getTimestamp("lecture-a")).toEqual(lectureVideo);
  await popup.click('[aria-label="Open settings"]');
  await popup.click(".settings-navigation:nth-of-type(2)");
  expect(popup.get(".whats-new")).toBeDefined();
  await popup.click('[aria-label="Back to settings"]');
  expect(popup.get("#theme")).toBeDefined();
  await popup.dispose();
  popup = await renderPopup(undefined, { showIntro: true });
  expect(popup.container.querySelector(".whats-new")).toBeNull();
});
