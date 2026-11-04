import { expect, test } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { getTimestamp, getVideos } from "@/library/storage";
import { LIBRARY_CHANNEL } from "@/shared/libraryProtocol";
import type { LibraryCommand } from "@/shared/libraryProtocol";
import { lectureVideo } from "../fixtures/videos";
import { deliverMessage } from "../helpers/runtime";

const contentSender: chrome.runtime.MessageSender = {
  id: fakeBrowser.runtime.id,
  url: "https://www.youtube.com/watch?v=lecture-a",
  frameId: 0,
  tab: { id: 42 } as chrome.tabs.Tab,
};

function fromContent(command: unknown, sender = contentSender) {
  return deliverMessage({ channel: LIBRARY_CHANNEL, command }, sender);
}

test("a supported top-frame content script can save/read its video and read settings", async () => {
  expect(await fromContent({ type: "session.open", videoId: "lecture-a", sessionId: "session-a" })).toMatchObject({ ok: true });
  expect(await fromContent({ type: "session.checkpoint", sessionId: "session-a", sequence: 1, policyRevision: 0,
    reason: "play", video: lectureVideo })).toMatchObject({ ok: true, data: { status: "saved" } });
  expect(await fromContent({ type: "library.get", videoId: "lecture-a" })).toMatchObject({ ok: true, data: lectureVideo });
  expect(await fromContent({ type: "settings.get" })).toMatchObject({ ok: true, data: { saveMusicVideosOnly: false } });
  expect(await getTimestamp("lecture-a")).toEqual({ ...lectureVideo, isCompleted: false });
});

test.each([
  { type: "videos.clear" },
  { type: "video.remove", videoId: "lecture-a" },
  { type: "favorite.set", videoId: "lecture-a", favorite: true },
  { type: "settings.save", settings: { saveMusicVideosOnly: true } },
  { type: "library.list" },
  { type: "maintenance" },
  { type: "library.get", videoId: "another-video" },
  { type: "progress.save", video: { ...lectureVideo, videoId: "another-video" } },
])("content scripts cannot issue privileged or unrelated-video commands: $type", async (command) => {
  expect(await fromContent(command)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  expect(await fakeBrowser.storage.local.get(null)).toEqual({});
});

test.each([
  { ...contentSender, id: "another-extension" },
  { ...contentSender, frameId: 1 },
  { ...contentSender, url: "https://www.youtube.com.evil.example/watch?v=lecture-a" },
  { ...contentSender, url: "http://www.youtube.com/watch?v=lecture-a" },
  { ...contentSender, url: "https://example.com/watch?v=lecture-a" },
  { ...contentSender, url: "invalid" },
  { ...contentSender, tab: undefined },
  {},
])("untrusted senders cannot write storage", async (sender) => {
  expect(await fromContent({ type: "progress.save", video: lectureVideo }, sender)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  expect(await fakeBrowser.storage.local.get(null)).toEqual({});
});

test.each([
  null,
  { type: "unknown" },
  { type: "progress.save", video: { ...lectureVideo, lastWatched: -1 } },
  { type: "progress.save", video: { ...lectureVideo, lastWatched: Infinity } },
  { type: "progress.save", video: { ...lectureVideo, duration: 0 } },
  { type: "progress.save", video: { ...lectureVideo, updatedAt: "not-a-date" } },
  { type: "progress.save", video: { ...lectureVideo, title: "x".repeat(4097) } },
  { type: "library.get", videoId: "../settings" },
  { type: "favorite.set", videoId: "lecture-a", favorite: "true" },
  { type: "settings.save", settings: { saveMusicVideosOnly: true, defaultView: "bad" } },
])("malformed commands are rejected before migration or mutation", async (command) => {
  expect(await fromContent(command)).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  expect(await fakeBrowser.storage.local.get(null)).toEqual({});
});

test("unknown checkpoint fields cannot write arbitrary keys or favorite preferences", async () => {
  await fromContent({ type: "session.open", videoId: "lecture-a", sessionId: "session-a" });
  const command: LibraryCommand = { type: "session.checkpoint", sessionId: "session-a", sequence: 1, policyRevision: 0,
    reason: "play", video: lectureVideo };
  expect(await fromContent({ ...command, video: { ...lectureVideo, isFavorite: true, arbitraryKey: "injected" } })).toMatchObject({ ok: true });
  expect(await getVideos()).toEqual({ "lecture-a": { ...lectureVideo, isCompleted: false } });
});
