import { afterEach, beforeEach, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { registerLibraryMessages } from "@/background/libraryMessages";
import { deliverMessage } from "./helpers/runtime";

function storageClone(values: Record<string, unknown>): Record<string, unknown> {
  const reorder = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(reorder);
    if (typeof value !== "object" || value === null) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, reorder((value as Record<string, unknown>)[key])]));
  };
  return reorder(structuredClone(values)) as Record<string, unknown>;
}

beforeEach(() => {
  fakeBrowser.reset();
  vi.spyOn(fakeBrowser.tabs, "get").mockImplementation(async (tabId) => ({ id: tabId, url: "https://www.youtube.com/watch?v=lecture-a" } as chrome.tabs.Tab));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T12:00:00.000Z"));

  const readStorage = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);

  // Separate references and reordered JSON properties expose storage round-trip assumptions.
  vi.spyOn(fakeBrowser.storage.local, "get").mockImplementation(async (keys) =>
    storageClone(await readStorage(keys)),
  );
  const readSession = fakeBrowser.storage.session.get.bind(fakeBrowser.storage.session);
  vi.spyOn(fakeBrowser.storage.session, "get").mockImplementation(async (keys) =>
    storageClone(await readSession(keys)),
  );

  // This quota API is not implemented by the installed fake-browser package.
  vi.spyOn(fakeBrowser.storage.local, "getBytesInUse").mockImplementation(async (keys) => {
    const values = await readStorage(keys);
    return Object.entries(values).reduce((bytes, [key, value]) =>
      bytes + (value === undefined ? 0 : new TextEncoder().encode(key + JSON.stringify(value)).byteLength), 0);
  });
  vi.spyOn(fakeBrowser.runtime, "sendMessage").mockImplementation(async (message: unknown) =>
    deliverMessage(message, { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL("popup.html") }),
  );
  registerLibraryMessages();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
