import { expect, test } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { cleanupOldTimestamps, getTimestamp, saveTimestamp, setFavorite } from "@/library/storage";
import { saveSettings, getSettings } from "@/settings/storage";
import { STORAGE_KEYS } from "@/library/keys";
import { lectureVideo } from "../fixtures/videos";
import { LIBRARY_CHANNEL } from "@/shared/libraryProtocol";

test("automatic deletion is off by default and keeps old videos", async () => {
  await saveTimestamp({ ...lectureVideo, updatedAt: "2020-01-01T00:00:00Z" });
  await cleanupOldTimestamps();
  expect(await getTimestamp("lecture-a")).not.toBeNull();
});

test.each([30, 60, 90] as const)("enabled deletion honors %i days since the last progress update", async (days) => {
  await saveSettings({ saveMusicVideosOnly: false, retentionDays: days });
  await saveTimestamp({ ...lectureVideo, updatedAt: new Date(Date.now() - (days + 1) * 86400000).toISOString() });
  await saveTimestamp({ ...lectureVideo, videoId: "recent", updatedAt: new Date(Date.now() - (days - 1) * 86400000).toISOString() });
  await saveTimestamp({ ...lectureVideo, videoId: "favorite", updatedAt: "2020-01-01T00:00:00Z" });
  await setFavorite("favorite", true);
  await cleanupOldTimestamps();
  expect(await getTimestamp("lecture-a")).toBeNull();
  expect(await getTimestamp("recent")).not.toBeNull();
  expect(await getTimestamp("favorite")).toMatchObject({ isFavorite: true });
});

test("turning automatic deletion off preserves records beyond the chosen duration", async () => {
  await saveSettings({ saveMusicVideosOnly: false, retentionDays: 30 });
  await saveTimestamp({ ...lectureVideo, updatedAt: "2020-01-01T00:00:00Z" });
  await saveSettings({ saveMusicVideosOnly: false, retentionDays: null });
  await cleanupOldTimestamps();
  expect(await getTimestamp("lecture-a")).not.toBeNull();
  expect((await getSettings()).retentionDays).toBeNull();
});

test("the discontinued 45-day setting is read as off without losing other preferences", async () => {
  await getSettings();
  await fakeBrowser.storage.local.set({ [STORAGE_KEYS.settings]: {
    saveMusicVideosOnly: true, defaultView: "favourites", saveMode: "selected", retentionDays: 45, revision: 4,
  } });
  await saveTimestamp({ ...lectureVideo, updatedAt: "2020-01-01T00:00:00Z" });
  expect(await getSettings()).toMatchObject({ saveMusicVideosOnly: true, defaultView: "favourites", saveMode: "selected", retentionDays: null });
  await cleanupOldTimestamps();
  expect(await getTimestamp("lecture-a")).not.toBeNull();
});

test("migration of the old 45-day preference preserves the library and starts with deletion off", async () => {
  await fakeBrowser.storage.local.set({
    smartseek_settings: { saveMusicVideosOnly: true, defaultView: "favourites", retentionDays: 45 },
    video_progress: { "lecture-a": { ...lectureVideo, updatedAt: "2020-01-01T00:00:00Z" } },
  });
  await cleanupOldTimestamps();
  expect(await getTimestamp("lecture-a")).not.toBeNull();
  expect(await getSettings()).toEqual({ saveMusicVideosOnly: true, defaultView: "favourites", retentionDays: null });
});

test("45 days cannot be re-enabled through a new settings message", async () => {
  expect(await chrome.runtime.sendMessage({ channel: LIBRARY_CHANNEL, command: {
    type: "settings.save", settings: { saveMusicVideosOnly: false, retentionDays: 45 },
  } })).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
});
