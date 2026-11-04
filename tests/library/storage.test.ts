import { expect, test } from "vitest";
import {
  deleteAllVideos,
  deleteVideo,
  getTimestamp,
  saveTimestamp,
} from "@/library/storage";
import { getSettings, saveSettings } from "@/settings/storage";
import { lectureVideo, tutorialVideo } from "../fixtures/videos";

test("saved video progress can be retrieved", async () => {
  await saveTimestamp(lectureVideo);

  expect(await getTimestamp("lecture-a")).toEqual(lectureVideo);
});

test("an unknown video has no saved progress", async () => {
  expect(await getTimestamp("unknown-video")).toBeNull();
});

test("updating one video preserves another video's saved place", async () => {
  await saveTimestamp(lectureVideo);
  await saveTimestamp(tutorialVideo);
  await saveTimestamp({ ...lectureVideo, lastWatched: 180 });

  const updated = await getTimestamp("lecture-a");
  const untouched = await getTimestamp("tutorial-b");

  expect({ updated, untouched }).toEqual({
    updated: { ...lectureVideo, lastWatched: 180 },
    untouched: tutorialVideo,
  });
});

test("removing one video keeps the other saved videos", async () => {
  await saveTimestamp(lectureVideo);
  await saveTimestamp(tutorialVideo);

  await deleteVideo("lecture-a");

  const removed = await getTimestamp("lecture-a");
  const retained = await getTimestamp("tutorial-b");

  expect({ removed, retained }).toEqual({
    removed: null,
    retained: tutorialVideo,
  });
});

test("clearing the video library preserves the user's preferences", async () => {
  await saveSettings({ saveMusicVideosOnly: true, defaultView: "favourites" });
  await saveTimestamp(lectureVideo);
  await saveTimestamp(tutorialVideo);

  await deleteAllVideos();

  const lecture = await getTimestamp("lecture-a");
  const tutorial = await getTimestamp("tutorial-b");
  const settings = await getSettings();

  expect({ lecture, tutorial, settings }).toEqual({
    lecture: null,
    tutorial: null,
    settings: { saveMusicVideosOnly: true, defaultView: "favourites" },
  });
});
