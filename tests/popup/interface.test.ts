import { afterEach, expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { getTimestamp, saveTimestamp, setFavorite } from "@/library/storage";
import { getSettings } from "@/settings/storage";
import { lectureVideo, tutorialVideo } from "../fixtures/videos";
import { renderPopup } from "../helpers/popup";

let popup: Awaited<ReturnType<typeof renderPopup>> | undefined;
afterEach(async () => { await popup?.dispose(); popup = undefined; });

test("auto-deletion starts off, reveals only the requested periods when enabled, and hides them when disabled", async () => {
  popup = await renderPopup();
  await popup.click('[aria-label="Open settings"]');
  expect(popup.get("#auto-delete").getAttribute("aria-checked")).toBe("false");
  expect(popup.container.querySelector("#retention-days")).toBeNull();
  await popup.click("#auto-delete");
  expect(popup.get("#auto-delete").getAttribute("aria-checked")).toBe("true");
  expect(Array.from(popup.get("#retention-days").querySelectorAll("option"), (option) => option.value)).toEqual(["30", "60", "90"]);
  expect((await getSettings()).retentionDays).toBe(30);
  await popup.select("#retention-days", "90");
  expect((await getSettings()).retentionDays).toBe(90);
  await popup.click("#auto-delete");
  expect(popup.container.querySelector("#retention-days")).toBeNull();
  expect((await getSettings()).retentionDays).toBeNull();
});

test("a rejected preference write leaves auto-deletion off and displays the failure", async () => {
  popup = await renderPopup();
  await popup.click('[aria-label="Open settings"]');
  vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("Storage is full"));
  await popup.click("#auto-delete");
  expect(popup.get("#auto-delete").getAttribute("aria-checked")).toBe("false");
  expect(popup.container.querySelector("#retention-days")).toBeNull();
  expect(popup.get('[role="alert"]').textContent).toContain("Storage is full");
  expect((await getSettings()).retentionDays ?? null).toBeNull();
  await popup.click("#auto-delete");
  expect((await getSettings()).retentionDays).toBe(30);
});

test("search, sorting and the selected view stay intact across settings navigation", async () => {
  await saveTimestamp(lectureVideo);
  await setFavorite("lecture-a", true);
  await saveTimestamp(tutorialVideo);
  popup = await renderPopup();
  await popup.click('.library-views > button:nth-child(2)');
  await popup.search("Systems");
  await popup.select('[aria-label="Sort saved videos"]', "titleDesc");
  expect(popup.container.querySelectorAll(".video-row")).toHaveLength(1);
  await popup.select('[aria-label="Saving mode"]', "selected");
  expect((await getSettings()).saveMode).toBe("selected");
  await popup.click('[aria-label="Open settings"]');
  expect((popup.get("#settings-mode") as InstanceType<typeof popup.host.HTMLSelectElement>).value).toBe("selected");
  await popup.select("#settings-mode", "automatic");
  await popup.click('[aria-label="Back to library"]');
  expect((popup.get('[aria-label="Saving mode"]') as InstanceType<typeof popup.host.HTMLSelectElement>).value).toBe("automatic");
  expect(popup.get('input[type="search"]').getAttribute("value")).toBe("Systems");
  expect(popup.get('.library-views > button:nth-child(2)').getAttribute("aria-pressed")).toBe("true");
  expect((popup.get('[aria-label="Sort saved videos"]') as InstanceType<typeof popup.host.HTMLSelectElement>).value).toBe("titleDesc");
  expect(popup.container.querySelectorAll(".video-row")).toHaveLength(1);
});

test("favorite, chosen and removal actions use committed data, and image failures use a local fallback", async () => {
  await saveTimestamp(lectureVideo);
  popup = await renderPopup();
  await popup.event(".video-thumbnail img", "error");
  expect(popup.container.querySelector(".video-thumbnail img")).toBeNull();
  expect(popup.get(".thumbnail-fallback")).toBeDefined();
  await popup.click(".favorite-button");
  await popup.click(".choose-button");
  expect(await getTimestamp("lecture-a")).toMatchObject({ isFavorite: true, isSelected: true });
  await popup.click(".remove-button");
  expect(popup.get("dialog").hasAttribute("open")).toBe(true);
  await popup.click(".dialog-actions .button-secondary");
  expect(await getTimestamp("lecture-a")).not.toBeNull();
  await popup.click(".remove-button");
  await popup.click(".dialog-actions .button-danger");
  expect(await getTimestamp("lecture-a")).toBeNull();
  expect(popup.container.querySelector("dialog")).toBeNull();
  expect(popup.get(".toast").textContent).toContain("Video removed");
});

test("storage failure is distinct from an empty library and can be retried", async () => {
  const read = vi.mocked(fakeBrowser.storage.local.get).getMockImplementation()!;
  vi.mocked(fakeBrowser.storage.local.get).mockImplementation(async () => { throw new Error("Storage is unavailable"); });
  popup = await renderPopup();
  expect(popup.get(".load-error").textContent).toContain("Storage is unavailable");
  expect(popup.container.querySelector(".empty-state")).toBeNull();
  expect(popup.get(".popup-footer").textContent).toContain("Library unavailable");
  vi.mocked(fakeBrowser.storage.local.get).mockImplementation(read);
  await popup.click(".load-error .button");
  expect(popup.container.querySelector(".load-error")).toBeNull();
  expect(popup.get(".empty-state")).toBeDefined();
});

test("the current-video card keeps failed saves distinct from its last acknowledged position", async () => {
  const player = {
    supported: true, videoId: "lecture-a", title: "Systems lecture", state: "saved" as const,
    selected: true, canSave: true, position: 120, message: "Saved at 2:00.",
  };
  popup = await renderPopup(player);
  expect(popup.get(".current-video-title").textContent).toBe("Systems lecture");
  vi.mocked(fakeBrowser.tabs.sendMessage).mockImplementationOnce(async () => ({ ok: false, message: "Could not save this checkpoint" }));
  await popup.click(".current-save");
  expect(popup.get(".current-video [role='alert']").textContent).toContain("Could not save this checkpoint");
  expect(popup.get(".last-saved").textContent).toContain("2:00");
  vi.mocked(fakeBrowser.tabs.sendMessage).mockImplementation(async () => ({ ok: true, data: { ...player, position: 150, message: "Saved at 2:30." } }));
  await popup.click(".current-save");
  expect(popup.get(".current-video-status").textContent).toBe("Saved at 2:30.");
  expect(popup.container.querySelector(".last-saved")).toBeNull();
});
