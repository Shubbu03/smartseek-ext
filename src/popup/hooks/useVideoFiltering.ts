import { useMemo } from "react";
import type { VideoProgress } from "@/library/types";
import type { SortOption, VideoViewType } from "../types";
import { calculateProgress } from "../utils/videoUtils";

export function useVideoFiltering(
  videos: Record<string, VideoProgress>,
  searchTerm: string,
  sortOrder: SortOption,
  viewType: VideoViewType
) {
  const filteredAndSortedVideos = useMemo(() => {
    const videoEntries = Object.entries(videos).filter(([, video]) => {
      if (viewType === "selected" && !video.isSelected) return false;
      if (viewType === "completed" && !video.isCompleted) return false;
      if (viewType === "music") {
        if (!video.isMusic) {
          return false;
        }
      } else if (viewType === "favourites") {
        if (!video.isFavorite) {
          return false;
        }
      }

      return (video.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    });

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
  }, [videos, searchTerm, sortOrder, viewType]);

  return filteredAndSortedVideos;
}

