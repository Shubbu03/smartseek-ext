import { VideoProgress } from "../model/VideoProgress";

const STORAGE_KEY = "video_progress";
const EXPIRATION_DAYS = 45;

function isExpired(dateStr: string): boolean {
  const updated = new Date(dateStr);
  const now = new Date();
  const diffInDays =
    (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
  return diffInDays > EXPIRATION_DAYS;
}

export async function cleanupOldTimestamps(): Promise<void> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const all: Record<string, VideoProgress> = data[STORAGE_KEY] || {};

  const cleaned: Record<string, VideoProgress> = {};
  for (const [videoId, progress] of Object.entries(all)) {
    if (!isExpired(progress.updatedAt)) {
      cleaned[videoId] = progress;
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: cleaned });
}

export async function saveTimestamp(video: VideoProgress): Promise<void> {
  await cleanupOldTimestamps();

  const data = await chrome.storage.local.get(STORAGE_KEY);
  const all = data[STORAGE_KEY] || {};
  all[video.videoId] = video;

  await chrome.storage.local.set({ [STORAGE_KEY]: all });
}

export async function getTimestamp(
  videoId: string
): Promise<VideoProgress | null> {
  await cleanupOldTimestamps();
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY]?.[videoId] || null;
}

export async function deleteVideo(videoId: string): Promise<void> {
  await cleanupOldTimestamps();
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const all: Record<string, VideoProgress> = data[STORAGE_KEY] || {};

  if (all[videoId]) {
    delete all[videoId];
    await chrome.storage.local.set({ [STORAGE_KEY]: all });
  }
}
