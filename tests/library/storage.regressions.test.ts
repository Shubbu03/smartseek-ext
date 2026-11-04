import { beforeEach, describe, expect, test } from "vitest";
import { getTimestamp, saveTimestamp, toggleFavorite } from "@/library/storage";
import type { VideoProgress } from "@/library/types";
import { lectureVideo, tutorialVideo } from "../fixtures/videos";

describe("SS-001: favorite preservation", () => {
  let savedVideo: VideoProgress | null;

  beforeEach(async () => {
    await saveTimestamp(lectureVideo);
    await toggleFavorite("lecture-a");
    expect((await getTimestamp("lecture-a"))?.isFavorite).toBe(true);

    await saveTimestamp({ ...lectureVideo, lastWatched: 180 });
    savedVideo = await getTimestamp("lecture-a");
    expect(savedVideo?.lastWatched).toBe(180);
  });

  // Reproduced SS-001. Remove .fails when the persistence phase fixes it.
  test.fails("a new progress checkpoint preserves the user's favorite choice", () => {
    expect(savedVideo?.isFavorite).toBe(true);
  });
});

describe("SS-002: overlapping video saves", () => {
  let savedVideos: {
    lecture: VideoProgress | null;
    tutorial: VideoProgress | null;
  };

  beforeEach(async () => {
    await Promise.all([
      saveTimestamp(lectureVideo),
      saveTimestamp(tutorialVideo),
    ]);

    savedVideos = {
      lecture: await getTimestamp("lecture-a"),
      tutorial: await getTimestamp("tutorial-b"),
    };

    // A missing/failed fixture must fail setup, not count as the expected bug.
    expect(savedVideos.lecture ?? savedVideos.tutorial).not.toBeNull();
    if (savedVideos.lecture) expect(savedVideos.lecture).toEqual(lectureVideo);
    if (savedVideos.tutorial) expect(savedVideos.tutorial).toEqual(tutorialVideo);
  });

  // Reproduced SS-002. Remove .fails when the write coordinator fixes it.
  test.fails("overlapping saves for different videos preserve both saved places", () => {
    expect(savedVideos).toEqual({
      lecture: lectureVideo,
      tutorial: tutorialVideo,
    });
  });
});
