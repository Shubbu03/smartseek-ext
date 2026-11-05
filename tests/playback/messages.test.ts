import { Window } from "happy-dom";
import { expect, test } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { startTracking } from "@/playback/startTracking";
import { PLAYER_CHANNEL } from "@/shared/playerProtocol";
import { deliverMessage } from "../helpers/runtime";

test("the content listener accepts its own worker without a URL and rejects page and foreign senders", async () => {
  const host = new Window({ url: "https://www.youtube.com/" });
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: host });
  const cleanups: Array<() => void> = [];
  const context = { addEventListener() {}, onInvalidated(callback: () => void) { cleanups.push(callback); } } as unknown as Parameters<typeof startTracking>[0];
  try {
    startTracking(context);
    const message = { channel: PLAYER_CHANNEL, type: "status" };
    expect(await deliverMessage(message, { id: fakeBrowser.runtime.id })).toMatchObject({ ok: true, data: { supported: false } });
    await expect(deliverMessage(message, { id: "another-extension" })).rejects.toThrow("No SmartSeek listener");
    await expect(deliverMessage(message, { id: fakeBrowser.runtime.id, url: "https://www.youtube.com/", tab: { id: 42 } as chrome.tabs.Tab })).rejects.toThrow("No SmartSeek listener");
  } finally {
    for (const cleanup of cleanups) cleanup();
    await host.happyDOM.close();
    if (original) Object.defineProperty(globalThis, "window", original); else Reflect.deleteProperty(globalThis, "window");
  }
});
