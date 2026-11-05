import { isRecord, isSettings, isVideoId, isVideoProgress } from "@/shared/validation";
import { isImportSummary, jsonBytes } from "@/shared/libraryData";
import { DATA_KEYS } from "./dataKeys";
import { STORAGE_KEYS } from "./keys";
import { invalidatePlayback, restorePlayback } from "./playbackSessions";

type PlaybackChange = { videoId: string; removalId?: string };
export type DataMutation = {
  version: 1;
  writes: Record<string, unknown>;
  removals: string[];
  invalidate: PlaybackChange[];
  restore: PlaybackChange[];
  clearUndo: boolean;
  consumeUndo?: string;
};

function videoStorageKey(key: string): boolean {
  return [STORAGE_KEYS.progressPrefix, STORAGE_KEYS.preferencesPrefix].some((prefix) =>
    key.startsWith(prefix) && isVideoId(key.slice(prefix.length)));
}

function validWrites(writes: Record<string, unknown>): boolean {
  return Object.entries(writes).every(([key, value]) => {
    if (key === STORAGE_KEYS.settings) {
      const revision = isRecord(value) ? value.revision : undefined;
      return isSettings(value) && Number.isSafeInteger(revision) && Number(revision) >= 0;
    }
    if (key === DATA_KEYS.importResult) return isRecord(value) && isVideoId(value.id) && isImportSummary(value.summary);
    if (key.startsWith(STORAGE_KEYS.progressPrefix)) return videoStorageKey(key) && isVideoProgress(value) && value.videoId === key.slice(STORAGE_KEYS.progressPrefix.length);
    return key.startsWith(STORAGE_KEYS.preferencesPrefix) && videoStorageKey(key) && isRecord(value) &&
      (value.isFavorite === undefined || typeof value.isFavorite === "boolean") &&
      (value.isSelected === undefined || typeof value.isSelected === "boolean");
  });
}

function isPlaybackChanges(value: unknown): value is PlaybackChange[] {
  return Array.isArray(value) && value.every((entry) => isRecord(entry) && isVideoId(entry.videoId) &&
    (entry.removalId === undefined || isVideoId(entry.removalId)));
}

function isMutation(value: unknown): value is DataMutation {
  return isRecord(value) && value.version === 1 && isRecord(value.writes) && validWrites(value.writes) &&
    Object.hasOwn(value.writes, STORAGE_KEYS.settings) && Array.isArray(value.removals) && value.removals.every((key) => typeof key === "string" && videoStorageKey(key)) &&
    isPlaybackChanges(value.invalidate) && isPlaybackChanges(value.restore) && typeof value.clearUndo === "boolean" &&
    (value.consumeUndo === undefined || isVideoId(value.consumeUndo));
}

export async function clearRemovalReceipts(): Promise<void> {
  const stored = await chrome.storage.session.get(null);
  const keys = Object.keys(stored).filter((key) => key.startsWith(DATA_KEYS.undoPrefix));
  if (keys.length) await chrome.storage.session.remove(keys);
}

async function applyMutation(mutation: DataMutation): Promise<void> {
  for (const change of mutation.invalidate) await invalidatePlayback(change.videoId, change.removalId);
  await chrome.storage.local.set(mutation.writes);
  if (mutation.removals.length) await chrome.storage.local.remove(mutation.removals);
  for (const change of mutation.restore) await restorePlayback(change.videoId, change.removalId);
  if (mutation.clearUndo) await clearRemovalReceipts();
  if (mutation.consumeUndo) {
    const key = DATA_KEYS.undo(mutation.consumeUndo);
    const receipt = (await chrome.storage.session.get(key))[key];
    if (isRecord(receipt)) await chrome.storage.session.set({ [key]: { ...receipt, restored: true } });
  }
  await chrome.storage.local.remove(DATA_KEYS.journal);
}

export async function recoverDataMutation(): Promise<void> {
  const value: unknown = (await chrome.storage.local.get(DATA_KEYS.journal))[DATA_KEYS.journal];
  if (value === undefined) return;
  if (!isMutation(value)) throw new Error("An unfinished library change needs recovery. Existing data has been preserved; do not clear local storage.");
  await applyMutation(value);
}

export async function commitDataMutation(mutation: DataMutation, importOperation = false): Promise<void> {
  const current: Record<string, unknown> = await chrome.storage.local.get(null);
  const used = await chrome.storage.local.getBytesInUse(null);
  const journalBytes = new TextEncoder().encode(DATA_KEYS.journal).byteLength + jsonBytes(mutation);
  const growth = Object.entries(mutation.writes).reduce((sum, [key, value]) => sum + Math.max(0,
    new TextEncoder().encode(key).byteLength + jsonBytes(value) - (current[key] === undefined ? 0 : new TextEncoder().encode(key).byteLength + jsonBytes(current[key]))), 0);
  if (used + journalBytes + growth + (importOperation ? 64 * 1024 : 0) > chrome.storage.local.QUOTA_BYTES) {
    throw new Error("There is not enough local storage to complete this change safely. Your existing library has not been changed.");
  }
  // Once the intent is durable, every command must finish it before reading or writing.
  await chrome.storage.local.set({ [DATA_KEYS.journal]: mutation });
  await applyMutation(mutation);
}
