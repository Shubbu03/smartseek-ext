import { expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { activePlayback } from "@/popup/playback";
import { ensurePlaybackAttached } from "@/playback/attachment";
import { LIBRARY_CHANNEL } from "@/shared/libraryProtocol";
import { deliverMessage } from "../helpers/runtime";

const status = { supported: true, videoId: "lecture-a", title: "Systems lecture", state: "ready", selected: false, canSave: true, position: null, message: "Ready" };
function tabs() {
  vi.spyOn(fakeBrowser.tabs, "query").mockImplementation(async () => [{ id: 42, url: "https://www.youtube.com/watch?v=lecture-a" } as chrome.tabs.Tab]);
  vi.spyOn(fakeBrowser.tabs, "get").mockImplementation(async () => ({ id: 42, url: "https://www.youtube.com/watch?v=lecture-a" } as chrome.tabs.Tab));
  vi.spyOn(fakeBrowser.runtime, "getManifest").mockReturnValue({ name: "SmartSeek", version: "3.0.0", manifest_version: 3,
    content_scripts: [{ matches: ["https://www.youtube.com/*"], js: ["content-scripts/content.js"] }] });
}

test("an existing YouTube tab with no receiver reconnects without refreshing the page", async () => {
  tabs();
  let connected = false;
  vi.spyOn(fakeBrowser.tabs, "sendMessage").mockImplementation(async () => {
    if (!connected) throw new Error("Could not establish connection. Receiving end does not exist.");
    return { ok: true, data: status };
  });
  const inject = vi.spyOn(fakeBrowser.scripting, "executeScript").mockImplementation(async () => { connected = true; return []; });
  expect(await activePlayback("status")).toEqual(status);
  expect(inject).toHaveBeenCalledTimes(1);
  expect(await activePlayback("status")).toEqual(status);
  expect(inject).toHaveBeenCalledTimes(1);
});

test("saving to an unattached tab connects first and sends the save command only once", async () => {
  tabs();
  let connected = false;
  let saves = 0;
  vi.spyOn(fakeBrowser.tabs, "sendMessage").mockImplementation(async (_tab: number, message: unknown) => {
    if (!connected) throw new Error("Could not establish connection. Receiving end does not exist.");
    if (typeof message === "object" && message !== null && "type" in message && message.type === "save") saves++;
    return { ok: true, data: status };
  });
  vi.spyOn(fakeBrowser.scripting, "executeScript").mockImplementation(async () => { connected = true; return []; });
  await activePlayback("save");
  expect(saves).toBe(1);
});

test("concurrent attachment requests inject once, and a healthy player is not restarted", async () => {
  tabs();
  let connected = false;
  vi.spyOn(fakeBrowser.tabs, "sendMessage").mockImplementation(async () => {
    if (!connected) throw new Error("Receiving end does not exist.");
    return { ok: true, data: status };
  });
  const inject = vi.spyOn(fakeBrowser.scripting, "executeScript").mockImplementation(async () => { connected = true; return []; });
  await Promise.all([ensurePlaybackAttached(42), ensurePlaybackAttached(42)]);
  await ensurePlaybackAttached(42);
  expect(inject).toHaveBeenCalledTimes(1);
});

test("a lost save acknowledgment is never automatically replayed", async () => {
  tabs();
  const send = vi.spyOn(fakeBrowser.tabs, "sendMessage").mockRejectedValue(new Error("The message port closed before a response was received."));
  const inject = vi.spyOn(fakeBrowser.scripting, "executeScript");
  await expect(activePlayback("save")).rejects.toThrow("Could not reach");
  expect(send).toHaveBeenCalledTimes(1);
  expect(inject).not.toHaveBeenCalled();
});

test("a denied connection reports an actionable failure and can be retried", async () => {
  tabs();
  vi.spyOn(fakeBrowser.tabs, "sendMessage").mockRejectedValue(new Error("Receiving end does not exist."));
  const inject = vi.spyOn(fakeBrowser.scripting, "executeScript").mockRejectedValue(new Error("Cannot access contents of the page"));
  await expect(activePlayback("status")).rejects.toThrow("Could not connect");
  expect(inject).toHaveBeenCalledTimes(1);
});

test("page scripts and unrelated hosts cannot request an attachment", async () => {
  tabs();
  const inject = vi.spyOn(fakeBrowser.scripting, "executeScript");
  expect(await deliverMessage({ channel: LIBRARY_CHANNEL, command: { type: "playback.attach", tabId: 42 } },
    { id: fakeBrowser.runtime.id, url: "https://www.youtube.com/watch?v=lecture-a", tab: { id: 42 } as chrome.tabs.Tab, frameId: 0 })).toMatchObject({ ok: false, code: "FORBIDDEN" });
  vi.mocked(fakeBrowser.tabs.get).mockImplementation(async () => ({ id: 42, url: "https://example.com/" } as chrome.tabs.Tab));
  await expect(ensurePlaybackAttached(42)).rejects.toThrow("only connect to YouTube");
  expect(inject).not.toHaveBeenCalled();
});
