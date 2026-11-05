import type { ContentScriptContext } from "#imports";
import { mountPlayback } from "./controller";
import { PLAYER_CHANNEL } from "@/shared/playerProtocol";

export function startTracking(ctx: ContentScriptContext) {
  const playback = mountPlayback(window);
  ctx.addEventListener(window, "wxt:locationchange", playback.refresh);
  ctx.onInvalidated(playback.dispose);

  const listener = (message: unknown, sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void) => {
    if (typeof message !== "object" || message === null || !("channel" in message) ||
      message.channel !== PLAYER_CHANNEL) return;
    if (sender.id !== chrome.runtime.id || sender.tab || (sender.url !== undefined && !sender.url.startsWith(chrome.runtime.getURL("/")))) return;
    if ("type" in message && message.type === "status") {
      sendResponse({ ok: true, data: playback.getStatus() });
    } else if ("type" in message && message.type === "save") {
      playback.saveNow().then(
        (data) => sendResponse({ ok: true, data }),
        (error: unknown) => sendResponse({ ok: false, message: error instanceof Error ? error.message : "Could not save." }),
      );
      return true;
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  ctx.onInvalidated(() => chrome.runtime.onMessage.removeListener(listener));
}
