import { useEffect, useState } from "react";
import { VideoProgress } from "@/model/VideoProgress";
import { deleteVideo } from "../../../lib/storage";
import { calculateProgress } from "../utils/videoUtils";

export function useVideos() {
  const [videos, setVideos] = useState<Record<string, VideoProgress>>({});

  useEffect(() => {
    try {
      chrome.storage.local.get("video_progress", (data) => {
        setVideos(data.video_progress || {});
      });

      const storageChangeListener = (changes: any, areaName: string) => {
        if (areaName === "local" && changes.video_progress) {
          setVideos(changes.video_progress.newValue || {});
        }
      };
      chrome.storage.onChanged.addListener(storageChangeListener);

      return () => {
        try {
          chrome.storage.onChanged.removeListener(storageChangeListener);
        } catch (error) {
        }
      };
    } catch (error) {
      console.error("[SmartSeek] Error accessing storage:", error);
      setVideos({});
    }
  }, []);

  const handleDeleteVideo = async (videoId: string, videoTitle?: string) => {
    const title = videoTitle || "this video";
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await deleteVideo(videoId);
        chrome.storage.local.get("video_progress", (data) => {
          setVideos(data.video_progress || {});
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("Extension context invalidated")) {
          alert("Extension was reloaded. Please refresh the extension and try again.");
          return;
        }
        console.error("[SmartSeek] Error deleting video:", error);
      }
    }
  };

  const cleanupCompletedVideos = () => {
    const videosToRemove: string[] = [];
    Object.entries(videos).forEach(([id, video]) => {
      const progress = calculateProgress(video);
      if (progress >= 100) {
        videosToRemove.push(id);
      }
    });

    if (videosToRemove.length > 0) {
      setTimeout(() => {
        videosToRemove.forEach((videoId) => {
          deleteVideo(videoId).catch((error) => {
            if (error.message?.includes("Extension context invalidated")) {
              return;
            }
            console.error(`[SmartSeek] Error removing 100% video ${videoId}:`, error);
          });
        });
      }, 0);
    }
  };

  return { videos, setVideos, handleDeleteVideo, cleanupCompletedVideos };
}

