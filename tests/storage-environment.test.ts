import { expect, test } from "vitest";

test("storage reads return independent copies of persisted data", async () => {
  await chrome.storage.local.set({ checkpoint: { position: 120 } });

  const first = await chrome.storage.local.get<{
    checkpoint: { position: number };
  }>("checkpoint");
  if (!first.checkpoint) throw new Error("The checkpoint fixture was not stored");
  first.checkpoint.position = 999;

  const second = await chrome.storage.local.get<{
    checkpoint: { position: number };
  }>("checkpoint");

  expect(second.checkpoint?.position).toBe(120);
});
