import { Window } from "happy-dom";
import { act, createElement, StrictMode } from "react";
import { vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import App from "@/popup/App";
import type { PlaybackStatus } from "@/playback/playerControl";

export async function renderPopup(activeVideo?: PlaybackStatus) {
  const host = new Window({ url: "chrome-extension://test-extension-id/popup.html" });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = {
    window: host, document: host.document, navigator: host.navigator,
    HTMLElement: host.HTMLElement, Element: host.Element, Node: host.Node,
    HTMLInputElement: host.HTMLInputElement, HTMLSelectElement: host.HTMLSelectElement,
    Event: host.Event, MouseEvent: host.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [name, value] of Object.entries(globals)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  vi.spyOn(fakeBrowser.tabs, "query").mockImplementation(async () => activeVideo
    ? [{ id: 42, url: "https://www.youtube.com/watch?v=lecture-a" } as chrome.tabs.Tab] : []);
  vi.spyOn(fakeBrowser.tabs, "sendMessage").mockImplementation(async () => ({ ok: true, data: activeVideo }));
  vi.spyOn(fakeBrowser.runtime, "getManifest").mockReturnValue({ name: "SmartSeek", version: "2.0.0", manifest_version: 3 });
  const { createRoot } = await import("react-dom/client");
  const container = host.document.createElement("div");
  host.document.body.append(container);
  const root = createRoot(container as unknown as HTMLElement);
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
  await act(async () => { root.render(createElement(StrictMode, null, createElement(App))); await settle(); });
  const get = (selector: string) => {
    const element = container.querySelector(selector);
    if (!element) throw new Error(`Missing popup element: ${selector}`);
    return element;
  };
  return {
    host, container, get,
    async click(selector: string) {
      await act(async () => { get(selector).dispatchEvent(new host.MouseEvent("click", { bubbles: true, cancelable: true })); await settle(); });
    },
    async select(selector: string, value: string) {
      await act(async () => {
        const select = get(selector) as InstanceType<typeof host.HTMLSelectElement>;
        select.value = value;
        select.dispatchEvent(new host.Event("change", { bubbles: true }));
        await settle();
      });
    },
    async search(value: string) {
      await act(async () => {
        const input = get('input[type="search"]');
        Object.getOwnPropertyDescriptor(host.HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new host.Event("input", { bubbles: true }));
        await settle();
      });
    },
    async event(selector: string, type: string) {
      await act(async () => { get(selector).dispatchEvent(new host.Event(type)); await settle(); });
    },
    async dispose() {
      await act(async () => { root.unmount(); await settle(); });
      await host.happyDOM.close();
      // Restore only this helper's globals; WXT owns chrome/browser stubs.
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
}
