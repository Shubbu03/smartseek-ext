import { useMemo } from "react";
import { VideoProgress } from "@/model/VideoProgress";
import { SortOption, VideoViewType } from "../types";
import { calculateProgress } from "../utils/videoUtils";

export function useVideoFiltering(
  videos: Record<string, VideoProgress>,
  searchTerm: string,
  sortOrder: SortOption,
  viewType: VideoViewType,
  cleanupCompletedVideos: () => void
) {
  const filteredAndSortedVideos = useMemo(() => {
    const videosToRemove: string[] = [];
    let videoEntries = Object.entries(videos).filter(([id, video]) => {
      const progress = calculateProgress(video);
      if (progress >= 100) {
        videosToRemove.push(id);
        return false;
      }

      if (viewType === "music") {
        if (!video.isMusic) {
          return false;
        }
      } else { }

      return (video.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (videosToRemove.length > 0) {
      cleanupCompletedVideos();
    }

    switch (sortOrder) {
      case "titleAsc":
        videoEntries.sort(([, a], [, b]) =>
          (a.title || "").localeCompare(b.title || "")
        );
        break;
      case "titleDesc":
        videoEntries.sort(([, a], [, b]) =>
          (b.title || "").localeCompare(a.title || "")
        );
        break;
      case "progressDesc":
        videoEntries.sort(([, a], [, b]) => {
          const progressA = calculateProgress(a);
          const progressB = calculateProgress(b);
          return progressB - progressA;
        });
        break;
      case "progressAsc":
        videoEntries.sort(([, a], [, b]) => {
          const progressA = calculateProgress(a);
          const progressB = calculateProgress(b);
          return progressA - progressB;
        });
        break;
      case "default":
      default:
        videoEntries.sort(([, a], [, b]) => {
          const dateA = new Date(a.updatedAt).getTime();
          const dateB = new Date(b.updatedAt).getTime();
          return dateB - dateA;
        });
        break;
    }
    return videoEntries;
  }, [videos, searchTerm, sortOrder, viewType, cleanupCompletedVideos]);

  return filteredAndSortedVideos;
}

