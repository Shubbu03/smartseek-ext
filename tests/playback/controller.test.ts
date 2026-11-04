import { afterEach, expect, test, vi } from "vitest";
import { getTimestamp, getVideos, saveTimestamp } from "@/library/storage";
import { saveSettings } from "@/settings/storage";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { deleteVideo, undoVideoRemoval } from "@/library/storage";
import { lectureVideo } from "../fixtures/videos";
import { playerFixture, settle } from "../helpers/player";

let fixture: ReturnType<typeof playerFixture> | undefined;
afterEach(async () => { await fixture?.dispose(); fixture = undefined; });

test("resume occurs once; comments, playlist query changes, and player replacement never restore again", async () => {
  await saveTimestamp(lectureVideo);
  fixture = playerFixture();
  await settle();
  expect(fixture.media.currentTime).toBe(120);
  fixture.event("seeked");
  fixture.media.currentTime = 220;
  fixture.host.history.pushState({}, "", "/watch?v=lecture-a&list=study&index=2");
  fixture.host.document.body.append(fixture.host.document.createElement("div"));
  fixture.controller.refresh();
  await settle();
  expect(fixture.media.currentTime).toBe(220);
  fixture.replacePlayer();
  fixture.media.currentTime = 230;
  fixture.controller.refresh();
  await settle();
  expect(fixture.media.currentTime).toBe(230);
  fixture.state.paused = false;
  fixture.event("play");
  await settle();
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(230);
});

test.each(["&t=0", "&t=1m30s", "&start=30", "#t=45"])("an explicit timestamp (%s) takes precedence over the saved position", async (query) => {
  await saveTimestamp(lectureVideo);
  fixture = playerFixture(query);
  await settle();
  expect(fixture.media.currentTime).toBe(0);
});

test("a user seek before initialization finishes cancels pending restoration", async () => {
  await saveTimestamp(lectureVideo);
  fixture = playerFixture();
  fixture.seek(35);
  await settle();
  expect(fixture.media.currentTime).toBe(35);
});

test("initial zero cannot overwrite an existing checkpoint", async () => {
  await saveTimestamp(lectureVideo);
  fixture = playerFixture();
  fixture.state.paused = false;
  fixture.event("play");
  fixture.event("timeupdate");
  await settle();
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(120);
});

test("rapid navigation cancels stale work and never saves old media time under a new video ID", async () => {
  fixture = playerFixture();
  fixture.media.currentTime = 150;
  fixture.beginNavigation("tutorial-b");
  fixture.state.paused = false;
  fixture.event("timeupdate");
  fixture.beginNavigation("video-c");
  await settle();
  expect(await getTimestamp("tutorial-b")).toBeNull();
  expect(await getTimestamp("video-c")).toBeNull();
  fixture.finishNavigation("video-c");
  await settle();
  fixture.media.currentTime = 25;
  fixture.event("play");
  await settle();
  expect((await getTimestamp("video-c"))?.lastWatched).toBe(25);
  expect(fixture.host.document.querySelectorAll('[id="smartseek-manual-save-button"]')).toHaveLength(1);
});

test("duplicate mounting and settings changes leave one control and do not seek", async () => {
  fixture = playerFixture();
  await settle();
  fixture.remount();
  await settle();
  fixture.media.currentTime = 55;
  await saveSettings({ saveMusicVideosOnly: true, defaultView: "music" });
  await settle();
  expect(fixture.media.currentTime).toBe(55);
  expect(fixture.host.document.querySelectorAll('[id="smartseek-manual-save-button"]')).toHaveLength(1);
  await saveSettings({ saveMusicVideosOnly: true, showSaveButton: false });
  await settle();
  expect(fixture.host.document.getElementById("smartseek-manual-save-button")).toBeNull();
  fixture.media.currentTime = 65;
  await fixture.controller.saveNow();
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(65);
});

test("missing control anchors cannot prevent saving, and manual selection keeps updating", async () => {
  await saveSettings({ saveMusicVideosOnly: false, saveMode: "selected" });
  fixture = playerFixture();
  fixture.host.document.getElementById("actions")!.remove();
  await settle();
  fixture.media.currentTime = 40;
  fixture.state.paused = false;
  fixture.event("play");
  fixture.event("pause");
  await settle();
  expect(await getVideos()).toEqual({});
  expect((await fixture.controller.saveNow()).position).toBe(40);
  fixture.seek(70);
  await settle();
  expect(await getTimestamp("lecture-a")).toMatchObject({ lastWatched: 70, isSelected: true });
});

test("ad playback and non-finite media durations never become checkpoints", async () => {
  fixture = playerFixture();
  await settle();
  fixture.host.document.getElementById("movie_player")!.classList.add("ad-showing");
  fixture.state.paused = false;
  fixture.media.currentTime = 15;
  fixture.event("loadedmetadata");
  fixture.event("play");
  fixture.event("pause");
  await settle();
  expect(await getVideos()).toEqual({});
  fixture.host.document.getElementById("movie_player")!.classList.remove("ad-showing");
  fixture.state.duration = Infinity;
  fixture.event("loadedmetadata");
  fixture.event("play");
  await settle();
  expect(await getVideos()).toEqual({});
  fixture.state.duration = 600;
  fixture.event("loadedmetadata");
  fixture.media.currentTime = 50;
  fixture.event("play");
  await settle();
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(50);
});

test("checkpoints coalesce at five seconds, pause saves promptly, and disposal removes tracking", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  fixture = playerFixture();
  await settle();
  fixture.media.currentTime = 10;
  fixture.state.paused = false;
  fixture.event("play");
  await settle();
  fixture.media.currentTime = 12;
  fixture.event("timeupdate");
  await settle();
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(10);
  fixture.media.currentTime = 16;
  await vi.advanceTimersByTimeAsync(5000);
  await settle();
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(16);
  fixture.media.currentTime = 18;
  fixture.state.paused = true;
  fixture.event("pause");
  await settle();
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(18);
  fixture.controller.dispose();
  await settle();
  fixture.media.currentTime = 99;
  fixture.event("play");
  await vi.advanceTimersByTimeAsync(10000);
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(18);
  expect(fixture.host.document.getElementById("smartseek-manual-save-button")).toBeNull();
});

test("completion survives leaving the video, and a deliberate replay returns it to in-progress", async () => {
  fixture = playerFixture();
  await settle();
  fixture.state.paused = false;
  fixture.media.currentTime = 590;
  fixture.event("play");
  await settle();
  fixture.media.currentTime = 600;
  fixture.state.paused = true;
  fixture.event("ended");
  await settle();
  expect(await getTimestamp("lecture-a")).toMatchObject({ isCompleted: true, lastWatched: 600 });
  fixture.beginNavigation("tutorial-b");
  fixture.finishNavigation("tutorial-b");
  await settle();
  expect(await getTimestamp("lecture-a")).toMatchObject({ isCompleted: true, lastWatched: 600 });
  fixture.beginNavigation("lecture-a");
  fixture.finishNavigation("lecture-a");
  await settle();
  expect(fixture.media.currentTime).toBe(0);
  fixture.seek(20);
  await settle();
  expect(await getTimestamp("lecture-a")).toMatchObject({ isCompleted: false, lastWatched: 20 });
});

test("a failed manual save shows failure, retries once, and never claims an uncommitted checkpoint", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  fixture = playerFixture();
  await settle();
  fixture.media.currentTime = 40;
  const failure = vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValue(new Error("disk full"));
  const saving = fixture.controller.saveNow();
  const rejected = expect(saving).rejects.toThrow("disk full");
  await settle();
  await vi.advanceTimersByTimeAsync(300);
  await rejected;
  expect(fixture.controller.getStatus()).toMatchObject({ state: "error", position: null });
  expect(await getTimestamp("lecture-a")).toBeNull();
  failure.mockRestore();
  expect(await fixture.controller.saveNow()).toMatchObject({ state: "saved", position: 40 });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(40);
});

test("changing resume preferences never seeks the already initialized session", async () => {
  await saveTimestamp(lectureVideo);
  await saveSettings({ saveMusicVideosOnly: false, autoResume: false });
  fixture = playerFixture();
  await settle();
  expect(fixture.media.currentTime).toBe(0);
  await saveSettings({ saveMusicVideosOnly: false, autoResume: true });
  await settle();
  expect(fixture.media.currentTime).toBe(0);
  fixture.seek(25);
  await settle();
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(25);
});

test("hidden and page-exit events flush the latest confirmed position without waiting for a heartbeat", async () => {
  fixture = playerFixture();
  await settle();
  fixture.state.paused = false;
  fixture.media.currentTime = 40;
  fixture.event("play");
  await settle();
  fixture.media.currentTime = 45;
  Object.defineProperty(fixture.host.document, "visibilityState", { configurable: true, value: "hidden" });
  fixture.host.document.dispatchEvent(new fixture.host.Event("visibilitychange"));
  await settle();
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(45);
  fixture.media.currentTime = 47;
  fixture.host.dispatchEvent(new fixture.host.Event("pagehide"));
  await settle();
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(47);
});

test("removal stops the active session until a new explicit save", async () => {
  fixture = playerFixture();
  await settle();
  fixture.state.paused = false;
  fixture.media.currentTime = 40;
  fixture.event("play");
  await settle();
  await deleteVideo("lecture-a");
  await settle();
  fixture.media.currentTime = 60;
  fixture.event("pause");
  fixture.event("timeupdate");
  await settle();
  expect(await getTimestamp("lecture-a")).toBeNull();
  expect(fixture.controller.getStatus().state).toBe("removed");
  expect(await fixture.controller.saveNow()).toMatchObject({ state: "saved", position: 60 });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(60);
});

test("Undo re-enables the active session without seeking back to the restored timestamp", async () => {
  fixture = playerFixture();
  await settle();
  fixture.state.paused = false;
  fixture.media.currentTime = 40;
  fixture.event("play");
  await settle();
  const removal = await deleteVideo("lecture-a");
  await settle();
  fixture.media.currentTime = 65;
  await undoVideoRemoval(removal!.id);
  await settle();
  expect(fixture.media.currentTime).toBe(65);
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(40);
  fixture.event("pause");
  await settle();
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(65);
  expect(fixture.controller.getStatus().state).toBe("saved");
});

test("same-video YouTube navigation events preserve tracking and never restore again", async () => {
  await saveTimestamp(lectureVideo);
  fixture = playerFixture();
  await settle();
  fixture.event("seeked");
  fixture.media.currentTime = 220;
  fixture.host.document.dispatchEvent(new fixture.host.Event("yt-navigate-start"));
  fixture.host.history.pushState({}, "", "/watch?v=lecture-a&list=study");
  fixture.host.document.dispatchEvent(new fixture.host.Event("yt-navigate-finish"));
  fixture.state.paused = false;
  fixture.event("play");
  await settle();
  expect(fixture.media.currentTime).toBe(220);
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(220);
});

test("a delayed metadata event with the previous video's media source cannot authorize a new checkpoint", async () => {
  fixture = playerFixture();
  await settle();
  fixture.media.currentTime = 150;
  fixture.beginNavigation("tutorial-b");
  fixture.event("loadedmetadata");
  fixture.host.document.dispatchEvent(new fixture.host.Event("yt-navigate-finish"));
  await settle();
  fixture.state.paused = false;
  fixture.event("play");
  await settle();
  expect(await getTimestamp("tutorial-b")).toBeNull();
});

test("a transient startup failure retries without overriding a seek made while waiting", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  await saveTimestamp(lectureVideo);
  vi.spyOn(fakeBrowser.storage.session, "set").mockRejectedValueOnce(new Error("worker unavailable"));
  fixture = playerFixture();
  await settle();
  fixture.seek(35);
  await vi.advanceTimersByTimeAsync(300);
  await settle();
  expect(fixture.controller.getStatus().state).not.toBe("error");
  expect(fixture.controller.getStatus().canSave).toBe(true);
  expect(fixture.media.currentTime).toBe(35);
});

test("startup failure stays visible after one retry and a user can explicitly retry", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  const failure = vi.spyOn(fakeBrowser.storage.session, "set").mockRejectedValue(new Error("worker unavailable"));
  fixture = playerFixture();
  await settle();
  await vi.advanceTimersByTimeAsync(300);
  await settle();
  expect(fixture.controller.getStatus()).toMatchObject({ state: "error", canSave: true });
  failure.mockRestore();
  fixture.media.currentTime = 40;
  expect(await fixture.controller.saveNow()).toMatchObject({ state: "saved", position: 40 });
  expect((await getTimestamp("lecture-a"))?.lastWatched).toBe(40);
});
