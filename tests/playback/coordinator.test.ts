import { expect, test, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { cleanupOldTimestamps, deleteAllVideos, deleteVideo, getTimestamp, getVideos, saveTimestamp, setFavorite, setSelected } from "@/library/storage";
import { saveSettings } from "@/settings/storage";
import { LIBRARY_CHANNEL } from "@/shared/libraryProtocol";
import { deliverMessage } from "../helpers/runtime";
import { lectureVideo } from "../fixtures/videos";
import { restartWorker } from "../helpers/worker";

const sender = {
  id: "test-extension-id", url: "https://www.youtube.com/watch?v=lecture-a",
  frameId: 0, tab: { id: 42 }, documentId: "document-a",
} as chrome.runtime.MessageSender;

function send(command: unknown, source = sender) {
  return deliverMessage({ channel: LIBRARY_CHANNEL, command }, source);
}

test("Selected mode keeps an unchosen video absent until an explicit save starts tracking", async () => {
  const settings = { saveMusicVideosOnly: false, saveMode: "selected" as const };
  await saveSettings(settings);
  const opened = await send({ type: "session.open", videoId: "lecture-a", sessionId: "session-a" });
  expect(opened).toMatchObject({ ok: true, data: { policy: { saveMode: "selected", revision: 1 }, selected: false } });
  const checkpoint = {
    type: "session.checkpoint", sessionId: "session-a", policyRevision: 1, sequence: 1,
    reason: "play", video: lectureVideo, interactionAt: Date.now(),
  };
  expect(await send(checkpoint)).toMatchObject({ ok: true, data: { status: "ignored", reason: "not-selected" } });
  expect(await getVideos()).toEqual({});
  expect(await send({ ...checkpoint, sequence: 2, reason: "manual" })).toMatchObject({ ok: true, data: { status: "saved", selected: true } });
  expect(await getTimestamp("lecture-a")).toMatchObject({ lastWatched: 120, isSelected: true });
  expect(await send({ ...checkpoint, sequence: 3, reason: "tick", video: { ...lectureVideo, lastWatched: 130 } })).toMatchObject({ ok: true, data: { status: "saved" } });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(130);
});

function checkpoint(sequence: number, extra: Record<string, unknown> = {}) {
  return {
    type: "session.checkpoint", sessionId: "session-a", sequence, policyRevision: 0,
    reason: "play", video: { ...lectureVideo, updatedAt: new Date().toISOString() }, ...extra,
  };
}

async function open(sessionId = "session-a", source = sender) {
  return send({ type: "session.open", videoId: "lecture-a", sessionId }, source);
}

test("Automatic mode saves unknown classifications, excludes music discovery, and honors an explicit music choice", async () => {
  await open();
  expect(await send(checkpoint(1, { video: { ...lectureVideo, isMusic: true } }))).toMatchObject({ data: { reason: "music-disabled" } });
  expect(await getVideos()).toEqual({});
  expect(await send(checkpoint(2))).toMatchObject({ data: { status: "saved" } });
  expect(await send(checkpoint(3, { reason: "manual", interactionAt: Date.now(), video: { ...lectureVideo, isMusic: true } }))).toMatchObject({ data: { status: "saved", selected: true } });
  expect(await send(checkpoint(4, { reason: "tick", video: { ...lectureVideo, isMusic: true, lastWatched: 160 } }))).toMatchObject({ data: { status: "saved" } });
  expect(await getTimestamp("lecture-a")).toMatchObject({ isMusic: true, isSelected: true, lastWatched: 160 });
});

test("a mode switch rejects old-policy events and preserves existing progress", async () => {
  await open();
  await send(checkpoint(1));
  await saveSettings({ saveMusicVideosOnly: false, saveMode: "selected" });
  expect(await send(checkpoint(2, { video: { ...lectureVideo, lastWatched: 200 } }))).toMatchObject({ data: { reason: "stale-policy" } });
  expect(await send(checkpoint(3, { policyRevision: 1 }))).toMatchObject({ data: { reason: "not-selected" } });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(120);
});

test.each(["individual", "all"])("%s deletion invalidates queued checkpoints and old manual saves across worker restart", async (kind) => {
  await open();
  await send(checkpoint(1));
  if (kind === "all") await deleteAllVideos(); else await deleteVideo("lecture-a");
  restartWorker();
  expect(await send(checkpoint(2))).toMatchObject({ data: { reason: "stale-policy" } });
  expect(await send(checkpoint(3, { reason: "manual", interactionAt: Date.now() }))).toMatchObject({ data: { reason: "stale-policy" } });
  expect(await send(checkpoint(4, { policyRevision: 1 }))).toMatchObject({ data: { reason: "removed" } });
  expect(await getTimestamp("lecture-a")).toBeNull();
  expect(await send(checkpoint(5, { policyRevision: 1, reason: "manual", interactionAt: Date.now() }))).toMatchObject({ data: { status: "saved" } });
});

test("unselecting rejects an older manual command and cannot change favorites", async () => {
  await saveSettings({ saveMusicVideosOnly: false, saveMode: "selected" });
  await open();
  await send(checkpoint(1, { policyRevision: 1, reason: "manual", interactionAt: Date.now() }));
  await setFavorite("lecture-a", true);
  await setSelected("lecture-a", false);
  expect(await send(checkpoint(2, { policyRevision: 1, reason: "manual", interactionAt: Date.now() }))).toMatchObject({ data: { reason: "stale-policy" } });
  expect(await send(checkpoint(3, { policyRevision: 2 }))).toMatchObject({ data: { reason: "not-selected" } });
  expect(await getTimestamp("lecture-a")).toMatchObject({ isFavorite: true, isSelected: false });
});

test("reordered or repeated checkpoints cannot overwrite a newer intentional rewind after worker restart", async () => {
  await open();
  await send(checkpoint(1));
  await send(checkpoint(3, { reason: "seek", interactionAt: Date.now(), video: { ...lectureVideo, lastWatched: 30 } }));
  restartWorker();
  expect(await send(checkpoint(2, { video: { ...lectureVideo, lastWatched: 200 } }))).toMatchObject({ data: { reason: "stale-sequence" } });
  expect(await send(checkpoint(3, { video: { ...lectureVideo, lastWatched: 300 } }))).toMatchObject({ data: { status: "saved", position: 30 } });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(30);
});

test("a paused duplicate cannot take ownership, and old interactions cannot take it back from a newer action", async () => {
  const duplicate = { ...sender, tab: { id: 43 } as chrome.tabs.Tab, documentId: "document-b" };
  await open();
  await send(checkpoint(1, { interactionAt: Date.now() }));
  const firstAction = Date.now();
  await open("session-b", duplicate);
  expect(await send(checkpoint(1, { sessionId: "session-b", reason: "pause" }), duplicate)).toMatchObject({ data: { reason: "another-tab" } });
  expect(await send(checkpoint(2, { sessionId: "session-b", reason: "play" }), duplicate)).toMatchObject({ data: { reason: "another-tab" } });
  vi.setSystemTime(new Date(firstAction + 1000));
  expect(await send(checkpoint(3, { sessionId: "session-b", interactionAt: Date.now(), video: { ...lectureVideo, updatedAt: new Date().toISOString(), lastWatched: 240 } }), duplicate)).toMatchObject({ data: { status: "saved" } });
  restartWorker();
  expect(await send(checkpoint(2, { reason: "seek", interactionAt: firstAction }))).toMatchObject({ data: { reason: "another-tab" } });
  expect(await send(checkpoint(3, { reason: "tick" }))).toMatchObject({ data: { reason: "another-tab" } });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(240);
  vi.setSystemTime(new Date(firstAction + 2000));
  expect(await send(checkpoint(4, { reason: "seek", interactionAt: Date.now(), video: { ...lectureVideo, updatedAt: new Date().toISOString(), lastWatched: 40 } }))).toMatchObject({ data: { status: "saved" } });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(40);
});

test("a checkpoint committed before a session-state write failure is safely retried", async () => {
  await open();
  const write = fakeBrowser.storage.session.set.bind(fakeBrowser.storage.session);
  const failure = vi.spyOn(fakeBrowser.storage.session, "set").mockImplementation(async (items) => {
    if (Object.keys(items).some((key) => key.includes(":session:"))) throw new Error("Worker stopped after progress commit");
    await write(items);
  });
  expect(await send(checkpoint(1))).toMatchObject({ ok: false, code: "STORAGE_ERROR" });
  failure.mockRestore();
  restartWorker();
  expect(await send(checkpoint(1))).toMatchObject({ data: { status: "saved", position: 120 } });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(120);
});

test("sessions are bound to the browser-provided document and video identity", async () => {
  await open();
  expect(await send(checkpoint(1), { ...sender, documentId: "different-document" })).toMatchObject({ data: { reason: "closed" } });
  expect(await send(checkpoint(2, { video: { ...lectureVideo, videoId: "different-video" } }))).toMatchObject({ data: { reason: "closed" } });
  expect(await getVideos()).toEqual({});
});

test("legacy records remain resumable without becoming selected, and keep-until-deleted disables maintenance", async () => {
  await fakeBrowser.storage.local.set({ video_progress: { "lecture-a": lectureVideo } });
  await saveSettings({ saveMusicVideosOnly: false, saveMode: "selected", retentionDays: null });
  expect(await open()).toMatchObject({ data: { saved: lectureVideo, selected: false } });
  await saveTimestamp({ ...lectureVideo, updatedAt: "2020-01-01T00:00:00Z" });
  await cleanupOldTimestamps();
  expect(await getTimestamp("lecture-a")).not.toBeNull();
});

test("closing an owning tab releases session ownership without deleting its checkpoint", async () => {
  await open();
  await send(checkpoint(1));
  const worker = restartWorker();
  await worker.closeTab(42);
  expect(await send(checkpoint(2))).toMatchObject({ data: { reason: "closed" } });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(120);
  const duplicate = { ...sender, tab: { id: 43 } as chrome.tabs.Tab, documentId: "document-b" };
  await open("session-b", duplicate);
  expect(await send(checkpoint(1, { sessionId: "session-b" }), duplicate)).toMatchObject({ data: { status: "saved" } });
});

test.each([
  { sequence: 0 },
  { policyRevision: -1 },
  { video: { ...lectureVideo, duration: undefined } },
  { video: { ...lectureVideo, duration: Infinity } },
  { video: { ...lectureVideo, lastWatched: 900 } },
  { reason: "ended" },
])("invalid playback checkpoints are rejected without creating session or library data", async (invalid) => {
  expect(await send(checkpoint(1, invalid))).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  expect(await fakeBrowser.storage.local.get(null)).toEqual({});
  expect(await fakeBrowser.storage.session.get(null)).toEqual({});
});
