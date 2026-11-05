import { isRecord, isSettings } from "./validation";
import type { Settings } from "@/settings/types";

export type Diagnostics = {
  format: "smartseek-diagnostics";
  version: 1;
  generatedAt: string;
  extensionVersion: string;
  storage: { status: "ok" | "unavailable"; usedBytes: number | null; quotaBytes: number };
  library: {
    status: "ready" | "needs-recovery" | "not-initialized" | "unavailable";
    videos: number; favorites: number; selected: number; invalidRecords: number;
    migrationWarnings: number; legacyBackup: boolean; pendingChange: boolean;
  };
  preferences: Settings | null;
};
export type RecoverySnapshot = {
  format: "smartseek-recovery"; version: 1; exportedAt: string; data: Record<string, unknown>;
};

const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
export function isDiagnostics(value: unknown): value is Diagnostics {
  if (!isRecord(value) || value.format !== "smartseek-diagnostics" || value.version !== 1 ||
    typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt)) || typeof value.extensionVersion !== "string" ||
    !isRecord(value.storage) || !isRecord(value.library)) return false;
  const { storage, library } = value;
  return ["ok", "unavailable"].includes(String(storage.status)) && (storage.usedBytes === null || count(storage.usedBytes)) && count(storage.quotaBytes) &&
    ["ready", "needs-recovery", "not-initialized", "unavailable"].includes(String(library.status)) &&
    ["videos", "favorites", "selected", "invalidRecords", "migrationWarnings"].every((key) => count(library[key])) &&
    typeof library.legacyBackup === "boolean" && typeof library.pendingChange === "boolean" &&
    (value.preferences === null || isSettings(value.preferences));
}
export function isRecoverySnapshot(value: unknown): value is RecoverySnapshot {
  return isRecord(value) && value.format === "smartseek-recovery" && value.version === 1 &&
    typeof value.exportedAt === "string" && Number.isFinite(Date.parse(value.exportedAt)) && isRecord(value.data);
}
