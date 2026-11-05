import type { VideoProgress } from "@/library/types";
import type { Settings } from "@/settings/types";
import { isDensity, isRetentionDays, isTheme } from "@/settings/types";
import type { PlaybackPolicy } from "./playbackTypes";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isVideoId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function isPosition(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isVideoProgress(value: unknown): value is VideoProgress {
  return isRecord(value) && isVideoId(value.videoId) && isPosition(value.lastWatched) &&
    typeof value.updatedAt === "string" && value.updatedAt.length <= 64 &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    (value.title === undefined || (typeof value.title === "string" && value.title.length <= 4096)) &&
    (value.duration === undefined || (isPosition(value.duration) && value.duration > 0)) &&
    (value.isMusic === undefined || typeof value.isMusic === "boolean") &&
    (value.isFavorite === undefined || typeof value.isFavorite === "boolean") &&
    (value.isSelected === undefined || typeof value.isSelected === "boolean") &&
    (value.isCompleted === undefined || typeof value.isCompleted === "boolean");
}

// Pick known fields: messages and legacy data must not become arbitrary storage writes.
export function copyProgress(video: VideoProgress): Omit<VideoProgress, "isFavorite" | "isSelected"> {
  return {
    videoId: video.videoId,
    lastWatched: video.lastWatched,
    updatedAt: video.updatedAt,
    ...(video.title !== undefined ? { title: video.title } : {}),
    ...(video.duration !== undefined ? { duration: video.duration } : {}),
    ...(video.isMusic !== undefined ? { isMusic: video.isMusic } : {}),
    ...(video.isCompleted !== undefined ? { isCompleted: video.isCompleted } : {}),
  };
}

export function isSettings(value: unknown): value is Settings {
  return isRecord(value) && typeof value.saveMusicVideosOnly === "boolean" &&
    (value.defaultView === undefined || value.defaultView === "recent" ||
      value.defaultView === "music" || value.defaultView === "favourites" ||
      value.defaultView === "selected" || value.defaultView === "completed") &&
    (value.saveMode === undefined || value.saveMode === "automatic" || value.saveMode === "selected") &&
    (value.autoResume === undefined || typeof value.autoResume === "boolean") &&
    (value.showSaveButton === undefined || typeof value.showSaveButton === "boolean") &&
    (value.retentionDays === undefined || value.retentionDays === null || isRetentionDays(value.retentionDays)) &&
    (value.theme === undefined || isTheme(value.theme)) && (value.density === undefined || isDensity(value.density));
}

export function copySettings(settings: Settings): Settings {
  return {
    saveMusicVideosOnly: settings.saveMusicVideosOnly,
    defaultView: settings.defaultView ?? "recent",
    ...(settings.saveMode !== undefined ? { saveMode: settings.saveMode } : {}),
    ...(settings.autoResume !== undefined ? { autoResume: settings.autoResume } : {}),
    ...(settings.showSaveButton !== undefined ? { showSaveButton: settings.showSaveButton } : {}),
    ...(settings.retentionDays !== undefined ? { retentionDays: settings.retentionDays } : {}),
    ...(settings.theme !== undefined ? { theme: settings.theme } : {}),
    ...(settings.density !== undefined ? { density: settings.density } : {}),
  };
}

export function normalizeStoredSettings(value: unknown): Settings | null {
  // The discontinued implicit/explicit 45-day policy must never opt a user into deletion.
  const settings = isRecord(value) && value.retentionDays === 45 ? { ...value, retentionDays: null } : value;
  return isSettings(settings) ? copySettings(settings) : null;
}

export function isPlaybackPolicy(value: unknown): value is PlaybackPolicy {
  return isRecord(value) && Number.isSafeInteger(value.revision) && Number(value.revision) >= 0 &&
    (value.saveMode === "automatic" || value.saveMode === "selected") &&
    typeof value.autoResume === "boolean" && typeof value.showSaveButton === "boolean" &&
    typeof value.includeMusic === "boolean" && (value.retentionDays === null || isRetentionDays(value.retentionDays));
}

