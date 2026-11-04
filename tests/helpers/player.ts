import { Window } from "happy-dom";
import { vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { mountPlayback } from "@/playback/controller";
import { isRecord } from "@/shared/libraryProtocol";
import type { BrowserWindow } from "@/youtube/player";
import { deliverMessage } from "./runtime";

export async function settle() { await new Promise<void>((resolve) => setImmediate(resolve)); }

export function playerFixture(query = "") {
  const host = new Window({ url: `https://www.youtube.com/watch?v=lecture-a${query}` });
  host.document.body.innerHTML = '<ytd-watch-flexy video-id="lecture-a"><div id="movie_player"><video class="html5-main-video"></video></div><ytd-watch-metadata><h1>Systems lecture</h1><div id="actions"><div id="flexible-actions"></div></div></ytd-watch-metadata></ytd-watch-flexy>';
  let media = host.document.querySelector("video")!;
  const state = { duration: 600, readyState: 1, paused: true, source: "blob:lecture-a" };
  function configure() {
    Object.defineProperties(media, {
      duration: { configurable: true, get: () => state.duration },
      readyState: { configurable: true, get: () => state.readyState },
      paused: { configurable: true, get: () => state.paused },
      currentSrc: { configurable: true, get: () => state.source },
    });
  }
  configure();
  vi.mocked(fakeBrowser.runtime.sendMessage).mockImplementation(async (message: unknown) => {
    const content = isRecord(message) && isRecord(message.command) && String(message.command.type).startsWith("session.");
    return deliverMessage(message, content ? {
      id: fakeBrowser.runtime.id, url: host.location.href, tab: { id: 42 } as chrome.tabs.Tab,
      frameId: 0, documentId: "document-a",
    } : { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL("popup.html") });
  });
  let controller = mountPlayback(host as unknown as BrowserWindow);
  const event = (type: string) => { media.dispatchEvent(new host.Event(type)); };
  return {
    host, state, get media() { return media; }, get controller() { return controller; }, event,
    remount() { controller = mountPlayback(host as unknown as BrowserWindow); },
    seek(position: number) {
      const input = new host.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true });
      Object.defineProperty(input, "isTrusted", { value: true });
      media.dispatchEvent(input);
      media.currentTime = position;
      event("seeking");
      event("seeked");
    },
    beginNavigation(id: string) {
      host.document.dispatchEvent(new host.Event("yt-navigate-start"));
      host.history.pushState({}, "", `/watch?v=${id}`);
      host.document.querySelector("ytd-watch-flexy")!.setAttribute("video-id", id);
      controller.refresh();
    },
    finishNavigation(id: string) {
      state.source = `blob:${id}`;
      media.currentTime = 0;
      event("loadstart");
      event("loadedmetadata");
      host.document.dispatchEvent(new host.Event("yt-navigate-finish"));
    },
    replacePlayer() {
      const replacement = host.document.createElement("video");
      replacement.className = "html5-main-video";
      media.replaceWith(replacement);
      media = replacement;
      configure();
      event("loadedmetadata");
      controller.refresh();
    },
    async dispose() {
      controller.dispose();
      await settle();
      await host.happyDOM.close();
    },
  };
}
