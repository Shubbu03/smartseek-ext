import { DEFAULT_SETTINGS } from "@/settings/types";
import {
  copyProgress, isMigrationStatus, isRecord, isVideoProgress, normalizeStoredSettings,
} from "@/shared/libraryProtocol";
import type { MigrationStatus } from "@/shared/libraryProtocol";
import { STORAGE_KEYS } from "./keys";

type LegacyBackup = {
  capturedAt: string;
  legacy: Record<string, unknown>;
};

function isBackup(value: unknown): value is LegacyBackup {
  return isRecord(value) && typeof value.capturedAt === "string" &&
    Number.isFinite(Date.parse(value.capturedAt)) && isRecord(value.legacy);
}

function bytesFor(key: string, value: unknown): number {
  return new TextEncoder().encode(key + JSON.stringify(value)).byteLength;
}

export async function initializeLibrary(): Promise<MigrationStatus> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(null);
  const existingMeta = stored[STORAGE_KEYS.meta];
  if (existingMeta !== undefined) {
    if (!isMigrationStatus(existingMeta)) {
      throw new Error("Unsupported or damaged SmartSeek schema. Keep your local data and use a compatible recovery build.");
    }
    return existingMeta;
  }

  const existingBackup = stored[STORAGE_KEYS.backup];
  if (existingBackup !== undefined && !isBackup(existingBackup)) {
    throw new Error("SmartSeek's migration backup is damaged. Original data has been preserved; recovery is required.");
  }
  // A backup is written before any migrated record. Never adopt unexplained v3 data.
  if (existingBackup === undefined && Object.keys(stored).some((key) => key.startsWith("smartseek:v3:"))) {
    throw new Error("Incomplete SmartSeek data has no migration backup. Recovery is required before writing.");
  }
  const backup: LegacyBackup = existingBackup ?? {
    capturedAt: new Date().toISOString(),
    legacy: Object.fromEntries(["video_progress", "smartseek_settings"]
      .filter((key) => stored[key] !== undefined).map((key) => [key, stored[key]])),
  };
  const warnings: string[] = [];
  const records: Record<string, unknown> = {};
  const legacyVideos = backup.legacy.video_progress;
  if (legacyVideos !== undefined && !isRecord(legacyVideos)) {
    warnings.push("The legacy video library is malformed; its original value remains in the backup.");
  } else if (isRecord(legacyVideos)) {
    for (const [id, video] of Object.entries(legacyVideos)) {
      if (!isVideoProgress(video) || video.videoId !== id) {
        warnings.push(`Skipped invalid legacy video ${id.slice(0, 128)}; preserved in backup.`);
        continue;
      }
      records[STORAGE_KEYS.progress(id)] = copyProgress(video);
      if (video.isFavorite !== undefined) {
        records[STORAGE_KEYS.preferences(id)] = { isFavorite: video.isFavorite };
      }
    }
  }

  const legacySettings = backup.legacy.smartseek_settings;
  const normalizedSettings = normalizeStoredSettings(legacySettings);
  if (legacySettings !== undefined && !normalizedSettings) {
    warnings.push("Invalid legacy settings were replaced with defaults; original settings remain in backup.");
  }
  records[STORAGE_KEYS.settings] = normalizedSettings ?? DEFAULT_SETTINGS;
  const meta: MigrationStatus = { version: 3, ready: true, migratedAt: backup.capturedAt, warnings };
  const planned = { ...records, [STORAGE_KEYS.backup]: backup, [STORAGE_KEYS.meta]: meta };
  const used = await chrome.storage.local.getBytesInUse(null);
  const extra = Object.entries(planned).reduce((total, [key, value]) =>
    total + bytesFor(key, value) - (stored[key] === undefined ? 0 : bytesFor(key, stored[key])), 0);
  // Leave room for the next checkpoint and error/recovery metadata. Never delete legacy data for space.
  if (used + extra + 64 * 1024 > chrome.storage.local.QUOTA_BYTES) {
    throw new Error("Not enough local storage to safely upgrade SmartSeek. Existing saves are intact. Keep the extension installed and back up its local data before retrying with a recovery build.");
  }

  if (existingBackup === undefined) await chrome.storage.local.set({ [STORAGE_KEYS.backup]: backup });
  await chrome.storage.local.set(records);
  const toVerify = { ...records, [STORAGE_KEYS.backup]: backup };
  const verified: Record<string, unknown> = await chrome.storage.local.get(Object.keys(toVerify));
  if (Object.entries(toVerify).some(([key, value]) => JSON.stringify(verified[key]) !== JSON.stringify(value))) {
    throw new Error("SmartSeek migration verification failed. Original saves and the migration backup are intact. Retry with a recovery build.");
  }
  // No commands run until this final commit succeeds. Retrying an incomplete migration uses the immutable backup.
  await chrome.storage.local.set({ [STORAGE_KEYS.meta]: meta });
  return meta;
}
