import { isMigrationStatus } from "@/shared/libraryProtocol";
import { isRecord, isVideoProgress, normalizeStoredSettings } from "@/shared/validation";
import type { Diagnostics, RecoverySnapshot } from "@/shared/supportTypes";
import { STORAGE_KEYS } from "@/library/keys";
import { DATA_KEYS } from "@/library/dataKeys";

// Read only: these operations must also work when migration or journal recovery cannot.
export async function collectDiagnostics(): Promise<Diagnostics> {
  const report: Diagnostics = {
    format: "smartseek-diagnostics", version: 1, generatedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    storage: { status: "unavailable", usedBytes: null, quotaBytes: chrome.storage.local.QUOTA_BYTES },
    library: { status: "unavailable", videos: 0, favorites: 0, selected: 0, invalidRecords: 0,
      migrationWarnings: 0, legacyBackup: false, pendingChange: false }, preferences: null,
  };
  const [read, usage] = await Promise.allSettled([chrome.storage.local.get(null), chrome.storage.local.getBytesInUse(null)]);
  if (usage.status === "fulfilled") report.storage = { ...report.storage, status: "ok", usedBytes: usage.value };
  if (read.status !== "fulfilled") return report;
  const stored: Record<string, unknown> = read.value;
  const meta = stored[STORAGE_KEYS.meta];
  report.preferences = normalizeStoredSettings(stored[STORAGE_KEYS.settings]);
  report.library.legacyBackup = stored[STORAGE_KEYS.backup] !== undefined || stored.video_progress !== undefined;
  report.library.pendingChange = stored[DATA_KEYS.journal] !== undefined;
  report.library.migrationWarnings = isMigrationStatus(meta) ? meta.warnings.length : 0;
  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith(STORAGE_KEYS.progressPrefix)) continue;
    if (!isVideoProgress(value) || value.videoId !== key.slice(STORAGE_KEYS.progressPrefix.length)) { report.library.invalidRecords++; continue; }
    report.library.videos++;
    const preferences = stored[STORAGE_KEYS.preferences(value.videoId)];
    if (preferences !== undefined && (!isRecord(preferences) ||
      (preferences.isFavorite !== undefined && typeof preferences.isFavorite !== "boolean") ||
      (preferences.isSelected !== undefined && typeof preferences.isSelected !== "boolean"))) { report.library.invalidRecords++; continue; }
    if (isRecord(preferences) && preferences.isFavorite === true) report.library.favorites++;
    if (isRecord(preferences) && preferences.isSelected === true) report.library.selected++;
  }
  report.library.status = isMigrationStatus(meta) && report.preferences && !report.library.pendingChange && !report.library.invalidRecords
    ? "ready" : meta === undefined && !Object.keys(stored).some((key) => key.startsWith("smartseek:v3:")) ? "not-initialized" : "needs-recovery";
  return report;
}

export async function exportRecoverySnapshot(): Promise<RecoverySnapshot> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(null);
  return { format: "smartseek-recovery", version: 1, exportedAt: new Date().toISOString(),
    data: Object.fromEntries(Object.entries(stored).filter(([key]) => key.startsWith("smartseek:v3:") || key === "video_progress" || key === "smartseek_settings")) };
}
