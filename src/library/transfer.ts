import { copyProgress, copySettings, isRecord } from "@/shared/validation";
import { copyLibraryVideo, isImportSummary, parseLibraryBackup } from "@/shared/libraryData";
import type { ImportMode, ImportPreview, ImportSummary, LibraryBackup } from "@/shared/libraryData";
import type { VideoProgress } from "./types";
import { listVideos, readSettingsRecord } from "./records";
import { DATA_KEYS } from "./dataKeys";
import { STORAGE_KEYS } from "./keys";
import { commitDataMutation } from "./dataMutation";

export async function exportLibraryBackup(): Promise<LibraryBackup> {
  return { format: "smartseek-backup", version: 1, exportedAt: new Date().toISOString(),
    videos: Object.values(await listVideos()), settings: copySettings(await readSettingsRecord()) };
}

type PreparedImport = {
  id: string;
  expiresAt: number;
  backup: LibraryBackup;
  mode: ImportMode;
  includeSettings: boolean;
  libraryFingerprint: string;
  settingsFingerprint: string;
};

async function fingerprint(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stableVideos(videos: Record<string, VideoProgress>) {
  return Object.entries(videos).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, video]) => copyLibraryVideo(video));
}

function importPlan(current: Record<string, VideoProgress>, backup: LibraryBackup, mode: ImportMode, includeSettings: boolean) {
  const result = new Map(mode === "merge" ? Object.entries(current) : []);
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const incoming of backup.videos) {
    const previous = Object.hasOwn(current, incoming.videoId) ? current[incoming.videoId] : undefined;
    let video = incoming;
    if (previous && mode === "merge") {
      const newer = Date.parse(incoming.updatedAt) > Date.parse(previous.updatedAt);
      const progress = newer ? { ...copyProgress(previous), ...copyProgress(incoming), isCompleted: incoming.isCompleted ?? false } : copyProgress(previous);
      const isFavorite = previous.isFavorite || incoming.isFavorite ? true : previous.isFavorite ?? incoming.isFavorite;
      const isSelected = previous.isSelected || incoming.isSelected ? true : previous.isSelected ?? incoming.isSelected;
      video = { ...progress, ...(isFavorite !== undefined ? { isFavorite } : {}), ...(isSelected !== undefined ? { isSelected } : {}) };
    }
    if (!previous) added++;
    else if (JSON.stringify(copyLibraryVideo(previous)) !== JSON.stringify(copyLibraryVideo(video))) updated++;
    else unchanged++;
    result.set(video.videoId, video);
  }
  const removed = Object.keys(current).filter((id) => !result.has(id));
  const videos = Array.from(result.values());
  const summary: ImportSummary = {
    added, updated, unchanged, removed: removed.length, total: videos.length,
    favorites: videos.filter((video) => video.isFavorite).length,
    selected: videos.filter((video) => video.isSelected).length, preferences: includeSettings,
  };
  return { videos, removed, summary };
}

export async function prepareLibraryImport(backup: LibraryBackup, mode: ImportMode, includeSettings: boolean): Promise<ImportPreview> {
  const current = await listVideos();
  const settings = copySettings(await readSettingsRecord());
  const prepared: PreparedImport = {
    id: crypto.randomUUID(), expiresAt: Date.now() + 10 * 60 * 1000,
    backup, mode, includeSettings, libraryFingerprint: await fingerprint(stableVideos(current)), settingsFingerprint: await fingerprint(settings),
  };
  const { summary } = importPlan(current, backup, mode, includeSettings);
  await chrome.storage.session.set({ [DATA_KEYS.preview]: prepared });
  return { ...summary, id: prepared.id, expiresAt: prepared.expiresAt, mode, includeSettings, fileVideos: backup.videos.length };
}

export async function applyPreparedImport(id: string): Promise<ImportSummary> {
  const last: unknown = (await chrome.storage.local.get(DATA_KEYS.importResult))[DATA_KEYS.importResult];
  if (isRecord(last) && last.id === id && isImportSummary(last.summary)) return last.summary;
  const raw: unknown = (await chrome.storage.session.get(DATA_KEYS.preview))[DATA_KEYS.preview];
  if (!isRecord(raw) || raw.id !== id || typeof raw.expiresAt !== "number" || raw.expiresAt <= Date.now() ||
    (raw.mode !== "merge" && raw.mode !== "replace") || typeof raw.includeSettings !== "boolean" ||
    typeof raw.libraryFingerprint !== "string" || typeof raw.settingsFingerprint !== "string") {
    throw new Error("This import preview has expired. Refresh the preview before importing.");
  }
  const backup = parseLibraryBackup(raw.backup);
  const current = await listVideos();
  const settings = await readSettingsRecord();
  if (raw.mode === "replace" && await fingerprint(stableVideos(current)) !== raw.libraryFingerprint) {
    throw new Error("Your library changed after this preview. Refresh the preview before replacing it.");
  }
  if (raw.includeSettings && await fingerprint(copySettings(settings)) !== raw.settingsFingerprint) {
    throw new Error("Your preferences changed after this preview. Refresh the preview before importing them.");
  }
  // Merge rebases against current progress; replace requires the reviewed snapshot.
  const plan = importPlan(current, backup, raw.mode, raw.includeSettings);
  const writes: Record<string, unknown> = {
    [STORAGE_KEYS.settings]: { ...(raw.includeSettings ? backup.settings : copySettings(settings)), revision: settings.revision + 1 },
    [DATA_KEYS.importResult]: { id, summary: plan.summary },
  };
  for (const video of plan.videos) {
    writes[STORAGE_KEYS.progress(video.videoId)] = copyProgress(video);
    writes[STORAGE_KEYS.preferences(video.videoId)] = {
      ...(video.isFavorite !== undefined ? { isFavorite: video.isFavorite } : {}),
      ...(video.isSelected !== undefined ? { isSelected: video.isSelected } : {}),
    };
  }
  await commitDataMutation({ version: 1, writes,
    removals: plan.removed.flatMap((videoId) => [STORAGE_KEYS.progress(videoId), STORAGE_KEYS.preferences(videoId)]),
    invalidate: plan.removed.map((videoId) => ({ videoId })),
    restore: backup.videos.map((video) => ({ videoId: video.videoId })), clearUndo: true,
  }, true);
  await cancelPreparedImport(id);
  return plan.summary;
}

export async function cancelPreparedImport(id: string): Promise<void> {
  const prepared: unknown = (await chrome.storage.session.get(DATA_KEYS.preview))[DATA_KEYS.preview];
  if (isRecord(prepared) && prepared.id === id) await chrome.storage.session.remove(DATA_KEYS.preview);
}
