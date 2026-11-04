import { afterEach, beforeEach, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

beforeEach(() => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T12:00:00.000Z"));

  const readStorage = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);

  // Match Chrome's serialized reads; shared nested references can hide lost writes.
  vi.spyOn(fakeBrowser.storage.local, "get").mockImplementation(async (keys) =>
    structuredClone(await readStorage(keys)),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
