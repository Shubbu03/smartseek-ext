import { copyProgress, isRecord, isVideoProgress, normalizeStoredSettings } from "@/shared/libraryProtocol";
import type { PlaybackPolicy } from "@/shared/playbackTypes";
import { STORAGE_KEYS } from "./keys";
import type { VideoProgress } from "./types";

export function storedVideo(videoId: string, stored: Record<string, unknown>): VideoProgress | null {
  const progress = stored[STORAGE_KEYS.progress(videoId)];
  if (progress === undefined) return null;
  if (!isVideoProgress(progress) || progress.videoId !== videoId) {
    throw new Error(`Saved progress for ${videoId} is damaged. Restore it from a backup before continuing.`);
  }
  const preferences = stored[STORAGE_KEYS.preferences(videoId)];
  if (preferences !== undefined && (!isRecord(preferences) ||
    (preferences.isFavorite !== undefined && typeof preferences.isFavorite !== "boolean") ||
    (preferences.isSelected !== undefined && typeof preferences.isSelected !== "boolean"))) {
    throw new Error(`Saved preferences for ${videoId} are damaged. Recovery is required.`);
  }
  return {
    ...copyProgress(progress),
    ...(isRecord(preferences) && typeof preferences.isFavorite === "boolean" ? { isFavorite: preferences.isFavorite } : {}),
    ...(isRecord(preferences) && typeof preferences.isSelected === "boolean" ? { isSelected: preferences.isSelected } : {}),
  };
}

export async function readVideo(videoId: string): Promise<VideoProgress | null> {
  return storedVideo(videoId, await chrome.storage.local.get([
    STORAGE_KEYS.progress(videoId), STORAGE_KEYS.preferences(videoId),
  ]));
}

export async function listVideos(): Promise<Record<string, VideoProgress>> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(null);
  const videos = Object.keys(stored).filter((key) => key.startsWith(STORAGE_KEYS.progressPrefix))
    .map((key) => key.slice(STORAGE_KEYS.progressPrefix.length))
    .map((id) => [id, storedVideo(id, stored)] as const);
  return Object.fromEntries(videos.filter((entry): entry is readonly [string, VideoProgress] => entry[1] !== null));
}

export async function readSettingsRecord() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const settings: unknown = stored[STORAGE_KEYS.settings];
  const rawRevision = isRecord(settings) ? settings.revision : undefined;
  const normalized = normalizeStoredSettings(settings);
  if (!normalized) throw new Error("Saved settings are damaged. Recovery is required.");
  const revision = Number.isSafeInteger(rawRevision) && Number(rawRevision) >= 0 ? Number(rawRevision) : 0;
  return { ...normalized, revision };
}

export async function readPolicy(): Promise<PlaybackPolicy> {
  const settings = await readSettingsRecord();
  return {
    revision: settings.revision,
    saveMode: settings.saveMode ?? "automatic",
    autoResume: settings.autoResume ?? true,
    showSaveButton: settings.showSaveButton ?? true,
    includeMusic: settings.saveMusicVideosOnly,
    retentionDays: settings.retentionDays ?? null,
  };
}

export async function advancePolicyRevision(): Promise<void> {
  const settings = await readSettingsRecord();
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: { ...settings, revision: settings.revision + 1 } });
}
