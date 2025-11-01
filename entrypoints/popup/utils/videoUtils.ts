import { VideoProgress } from "@/model/VideoProgress";

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function calculateProgress(video: VideoProgress): number {
  if (!video.duration || video.duration === 0) return 0;
  return Math.min(100, (video.lastWatched / video.duration) * 100);
}

export function getProgressColor(progress: number): string {
  if (progress >= 90) return "bg-red-500";
  if (progress >= 50) return "bg-yellow-500";
  return "bg-green-500";
}

