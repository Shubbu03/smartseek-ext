import { requestLibrary } from "@/shared/libraryProtocol";
import { isVideoKey, STORAGE_KEYS } from "./keys";
import type { VideoProgress } from "./types";
import { DATA_KEYS } from "./dataKeys";

export async function cleanupOldTimestamps(): Promise<void> {
  await requestLibrary({ type: "maintenance" });
}

export async function saveTimestamp(video: VideoProgress): Promise<void> {
  await requestLibrary({ type: "progress.save", video });
}

export function getTimestamp(videoId: string): Promise<VideoProgress | null> {
  return requestLibrary({ type: "library.get", videoId });
}

export function getVideos(): Promise<Record<string, VideoProgress>> {
  return requestLibrary({ type: "library.list" });
}

export function deleteVideo(videoId: string) {
  return requestLibrary({ type: "video.remove", videoId });
}

export function getPendingRemoval() { return requestLibrary({ type: "removal.pending" }); }
export function undoVideoRemoval(id: string) { return requestLibrary({ type: "removal.undo", id }); }
export async function dismissVideoRemoval(id: string): Promise<void> { await requestLibrary({ type: "removal.dismiss", id }); }

export function watchRemovals(onChange: () => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "session" && Object.keys(changes).some((key) => key.startsWith(DATA_KEYS.undoPrefix))) onChange();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function setFavorite(videoId: string, favorite: boolean): Promise<void> {
  await requestLibrary({ type: "favorite.set", videoId, favorite });
}

export async function setSelected(videoId: string, selected: boolean): Promise<void> {
  await requestLibrary({ type: "selection.set", videoId, selected });
}

export async function deleteAllVideos(): Promise<void> {
  await requestLibrary({ type: "videos.clear" });
}

export function getMigrationStatus() {
  return requestLibrary({ type: "migration.status" });
}

export function watchVideos(onChange: () => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && Object.keys(changes).some((key) => isVideoKey(key) || key === STORAGE_KEYS.meta)) {
      onChange();
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
