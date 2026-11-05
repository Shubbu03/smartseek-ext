import type { VideoProgress } from "@/library/types";
import type { Settings } from "@/settings/types";
import { copyProgress, copySettings, isRecord, isSettings, isVideoProgress, normalizeStoredSettings } from "./validation";

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const MAX_BACKUP_VIDEOS = 25_000;
export const UNDO_WINDOW_MS = 10_000;

export type LibraryBackup = {
  format: "smartseek-backup";
  version: 1;
  exportedAt: string;
  videos: VideoProgress[];
  settings: Settings;
};
export type ImportMode = "merge" | "replace";
export type ImportSummary = {
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
  total: number;
  favorites: number;
  selected: number;
  preferences: boolean;
};
export type ImportPreview = ImportSummary & {
  id: string;
  expiresAt: number;
  mode: ImportMode;
  includeSettings: boolean;
  fileVideos: number;
};
export type RemovalReceipt = { id: string; videoId: string; title: string; expiresAt: number };
export type UndoResult = { status: "restored" | "already-saved"; videoId: string };

export function copyLibraryVideo(video: VideoProgress): VideoProgress {
  return { ...copyProgress(video),
    ...(video.isFavorite !== undefined ? { isFavorite: video.isFavorite } : {}),
    ...(video.isSelected !== undefined ? { isSelected: video.isSelected } : {}),
  };
}

export function jsonBytes(value: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
  catch { throw new Error("The backup could not be read as JSON."); }
}

export function parseLibraryBackup(value: unknown): LibraryBackup {
  if (jsonBytes(value) > MAX_BACKUP_BYTES) throw new Error("This backup exceeds the 10 MB import limit.");
  if (isRecord(value) && value.format === undefined && Object.hasOwn(value, "video_progress")) {
    if (!isRecord(value.video_progress)) throw new Error("This v2 export has an invalid video library.");
    const entries = Object.entries(value.video_progress);
    if (entries.length > MAX_BACKUP_VIDEOS) throw new Error("The backup contains more than 25,000 videos.");
    const settings = value.smartseek_settings === undefined ? { saveMusicVideosOnly: false } : normalizeStoredSettings(value.smartseek_settings);
    if (!settings) throw new Error("This v2 export contains invalid preferences.");
    const videos = entries.map(([id, video], index) => {
      if (!isVideoProgress(video) || video.videoId !== id) throw new Error(`Video ${index + 1} in the v2 export has invalid progress or metadata.`);
      return copyLibraryVideo(video);
    });
    return { format: "smartseek-backup", version: 1, exportedAt: new Date().toISOString(), videos, settings: copySettings(settings) };
  }
  if (!isRecord(value) || value.format !== "smartseek-backup") throw new Error("Choose a SmartSeek JSON backup exported from Settings.");
  if (value.version !== 1) throw new Error("This backup version is not supported. Use a compatible SmartSeek version.");
  if (typeof value.exportedAt !== "string" || value.exportedAt.length > 64 || !Number.isFinite(Date.parse(value.exportedAt))) throw new Error("The backup has an invalid export date.");
  if (!Array.isArray(value.videos) || value.videos.length > MAX_BACKUP_VIDEOS) throw new Error("The backup must contain a video list of at most 25,000 entries.");
  if (!isSettings(value.settings)) throw new Error("The backup contains invalid preferences.");
  const seen = new Set<string>();
  const videos = value.videos.map((video: unknown, index) => {
    if (!isVideoProgress(video)) throw new Error(`Video ${index + 1} in the backup has invalid progress or metadata.`);
    if (seen.has(video.videoId)) throw new Error(`Video ${index + 1} repeats an identifier. Each video must appear once.`);
    seen.add(video.videoId);
    return copyLibraryVideo(video);
  });
  return { format: "smartseek-backup", version: 1, exportedAt: value.exportedAt, videos, settings: copySettings(value.settings) };
}

export function isImportSummary(value: unknown): value is ImportSummary {
  return isRecord(value) && ["added", "updated", "unchanged", "removed", "total", "favorites", "selected"]
    .every((key) => Number.isSafeInteger(value[key]) && Number(value[key]) >= 0) && typeof value.preferences === "boolean";
}

export function isImportPreview(value: unknown): value is ImportPreview {
  return isRecord(value) && typeof value.id === "string" &&
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt) &&
    (value.mode === "merge" || value.mode === "replace") && typeof value.includeSettings === "boolean" &&
    Number.isSafeInteger(value.fileVideos) && Number(value.fileVideos) >= 0 && isImportSummary(value);
}

export function isRemovalReceipt(value: unknown): value is RemovalReceipt {
  return isRecord(value) && typeof value.id === "string" && typeof value.videoId === "string" &&
    typeof value.title === "string" && typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt);
}
