import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { getSettings } from "@/settings/storage";
import { lectureVideo } from "../fixtures/videos";
import { saveTimestamp } from "@/library/storage";
import { renderPopup } from "../helpers/popup";

let popup: Awaited<ReturnType<typeof renderPopup>> | undefined;
afterEach(async () => { await popup?.dispose(); popup = undefined; });
const styles = readFileSync(new URL("../../src/popup/styles.css", import.meta.url), "utf8").replace(/^@import[^;]+;/m, "");

test("System follows a dark device, Light overrides it, and both theme and density persist after reopening", async () => {
  await saveTimestamp(lectureVideo);
  popup = await renderPopup(undefined, { colorScheme: "dark" });
  const sheet = popup.host.document.createElement("style"); sheet.textContent = styles; popup.host.document.head.append(sheet);
  const root = popup.host.document.documentElement;
  const variable = (name: string) => popup!.host.getComputedStyle(root).getPropertyValue(name).trim();
  expect(root.dataset.theme).toBe("system");
  expect(variable("--ss-bg")).toBe("#101827");
  await popup.click('[aria-label="Open settings"]');
  await popup.select("#theme", "light");
  expect(variable("--ss-bg")).toBe("#fafbfd");
  await popup.select("#theme", "dark");
  expect(variable("--ss-bg")).toBe("#101827");
  await popup.select("#density", "compact");
  expect(await getSettings()).toMatchObject({ theme: "dark", density: "compact" });
  await popup.click('[aria-label="Back to library"]');
  expect(root.dataset.density).toBe("compact");
  expect(popup.host.getComputedStyle(popup.get(".video-thumbnail")).width).toBe("70px");
  await popup.dispose();
  popup = await renderPopup(undefined, { colorScheme: "light" });
  expect(popup.host.document.documentElement.dataset).toMatchObject({ theme: "dark", density: "compact" });
});

test("failed appearance writes preserve the acknowledged theme and display an error", async () => {
  popup = await renderPopup();
  await popup.click('[aria-label="Open settings"]');
  vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("Cannot save appearance"));
  await popup.select("#theme", "dark");
  expect(popup.host.document.documentElement.dataset.theme).toBe("system");
  expect(popup.get('[role="alert"]').textContent).toContain("Cannot save appearance");
  expect((await getSettings()).theme ?? "system").toBe("system");
});
