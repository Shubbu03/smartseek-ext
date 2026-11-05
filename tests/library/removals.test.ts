import { expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { deleteAllVideos, deleteVideo, dismissVideoRemoval, getPendingRemoval, getTimestamp, saveTimestamp, setFavorite, setSelected, undoVideoRemoval } from "@/library/storage";
import { lectureVideo } from "../fixtures/videos";
import { restartWorker } from "../helpers/worker";
import { STORAGE_KEYS } from "@/library/keys";

test("Undo restores the saved place, favorite, chosen and completion state after worker restart", async () => {
  await saveTimestamp({ ...lectureVideo, isCompleted: true });
  await setFavorite("lecture-a", true);
  await setSelected("lecture-a", true);
  const removal = await deleteVideo("lecture-a");
  expect(await getTimestamp("lecture-a")).toBeNull();
  restartWorker();
  expect(await getPendingRemoval()).toEqual(removal);
  expect(await undoVideoRemoval(removal!.id)).toMatchObject({ status: "restored" });
  expect(await getTimestamp("lecture-a")).toEqual({ ...lectureVideo, isFavorite: true, isSelected: true, isCompleted: true });
  expect(await getPendingRemoval()).toBeNull();
  expect(await undoVideoRemoval(removal!.id)).toMatchObject({ status: "restored" });
});

test("Undo never overwrites a video that was saved again after removal", async () => {
  await saveTimestamp(lectureVideo);
  const removal = await deleteVideo("lecture-a");
  await saveTimestamp({ ...lectureVideo, lastWatched: 250 });
  expect(await undoVideoRemoval(removal!.id)).toMatchObject({ status: "already-saved" });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(250);
});

test("expired, dismissed and bulk-cleared removals cannot restore deleted data", async () => {
  await saveTimestamp(lectureVideo);
  const expired = await deleteVideo("lecture-a");
  vi.setSystemTime(new Date(Date.now() + 10001));
  await expect(undoVideoRemoval(expired!.id)).rejects.toThrow("expired");
  await saveTimestamp(lectureVideo);
  const dismissed = await deleteVideo("lecture-a");
  await dismissVideoRemoval(dismissed!.id);
  await expect(undoVideoRemoval(dismissed!.id)).rejects.toThrow("expired");
  await saveTimestamp(lectureVideo);
  const cleared = await deleteVideo("lecture-a");
  await deleteAllVideos();
  await expect(undoVideoRemoval(cleared!.id)).rejects.toThrow("expired");
  expect(await getTimestamp("lecture-a")).toBeNull();
});

test("an interrupted Undo finishes both progress and preferences before later reads", async () => {
  await saveTimestamp(lectureVideo);
  await setFavorite("lecture-a", true);
  const removal = await deleteVideo("lecture-a");
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  const failure = vi.spyOn(fakeBrowser.storage.local, "set").mockImplementation(async (items: Record<string, unknown>) => {
    if (STORAGE_KEYS.progress("lecture-a") in items) {
      await write({ [STORAGE_KEYS.progress("lecture-a")]: items[STORAGE_KEYS.progress("lecture-a")] });
      throw new Error("Interrupted Undo");
    }
    await write(items);
  });
  await expect(undoVideoRemoval(removal!.id)).rejects.toThrow("Interrupted Undo");
  await expect(getTimestamp("lecture-a")).rejects.toThrow("Interrupted Undo");
  failure.mockRestore();
  restartWorker();
  expect(await getTimestamp("lecture-a")).toEqual({ ...lectureVideo, isFavorite: true });
  expect(await undoVideoRemoval(removal!.id)).toMatchObject({ status: "restored" });
});
