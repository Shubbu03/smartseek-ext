import type { VideoProgress } from "@/library/types";
import type { Settings } from "@/settings/types";
import type { CheckpointReply, PlaybackCheckpoint, SessionOpened } from "./playbackTypes";
import { isImportPreview, isImportSummary, isRemovalReceipt, parseLibraryBackup } from "./libraryData";
import type { ImportMode, ImportPreview, ImportSummary, LibraryBackup, RemovalReceipt, UndoResult } from "./libraryData";

import { copyProgress, copySettings, isPlaybackPolicy, isPosition, isRecord, isSettings, isVideoId, isVideoProgress } from "./validation";
export { copyProgress, copySettings, isRecord, isSettings, isVideoId, isVideoProgress, normalizeStoredSettings } from "./validation";

export const LIBRARY_CHANNEL = "smartseek:library:v3";

export type MigrationStatus = {
  version: 3;
  ready: true;
  migratedAt: string;
  warnings: string[];
};

export type LibraryCommand =
  | { type: "library.list" }
  | { type: "library.get"; videoId: string }
  | { type: "progress.save"; video: VideoProgress }
  | { type: "favorite.set"; videoId: string; favorite: boolean }
  | { type: "selection.set"; videoId: string; selected: boolean }
  | { type: "video.remove"; videoId: string }
  | { type: "videos.clear" }
  | { type: "library.export" }
  | { type: "library.import.preview"; backup: LibraryBackup; mode: ImportMode; includeSettings: boolean }
  | { type: "library.import.apply"; previewId: string }
  | { type: "library.import.cancel"; previewId: string }
  | { type: "removal.pending" }
  | { type: "removal.undo"; id: string }
  | { type: "removal.dismiss"; id: string }
  | { type: "settings.get" }
  | { type: "settings.save"; settings: Settings }
  | { type: "maintenance" }
  | { type: "migration.status" }
  | { type: "session.open"; videoId: string; sessionId: string }
  | ({ type: "session.checkpoint" } & PlaybackCheckpoint)
  | { type: "session.close"; sessionId: string };

export type LibraryReplies = {
  "library.list": Record<string, VideoProgress>;
  "library.get": VideoProgress | null;
  "progress.save": null;
  "favorite.set": null;
  "selection.set": null;
  "video.remove": RemovalReceipt | null;
  "videos.clear": null;
  "library.export": LibraryBackup;
  "library.import.preview": ImportPreview;
  "library.import.apply": ImportSummary;
  "library.import.cancel": null;
  "removal.pending": RemovalReceipt | null;
  "removal.undo": UndoResult;
  "removal.dismiss": null;
  "settings.get": Settings;
  "settings.save": null;
  maintenance: null;
  "migration.status": MigrationStatus;
  "session.open": SessionOpened;
  "session.checkpoint": CheckpointReply;
  "session.close": null;
};

export type LibraryReply =
  | { ok: true; data: LibraryReplies[keyof LibraryReplies] }
  | { ok: false; code: "INVALID_REQUEST" | "FORBIDDEN" | "STORAGE_ERROR"; message: string };

export function isMigrationStatus(value: unknown): value is MigrationStatus {
  return isRecord(value) && value.version === 3 && value.ready === true &&
    typeof value.migratedAt === "string" && Number.isFinite(Date.parse(value.migratedAt)) &&
    Array.isArray(value.warnings) && value.warnings.every((warning) => typeof warning === "string");
}

export function parseCommand(value: unknown): LibraryCommand {
  if (!isRecord(value)) throw new Error("Invalid library command.");
  switch (value.type) {
    case "library.list":
    case "videos.clear":
    case "library.export":
    case "removal.pending":
    case "settings.get":
    case "maintenance":
    case "migration.status":
      return { type: value.type };
    case "library.import.preview":
      if ((value.mode === "merge" || value.mode === "replace") && typeof value.includeSettings === "boolean") {
        return { type: value.type, mode: value.mode, includeSettings: value.includeSettings, backup: parseLibraryBackup(value.backup) };
      }
      break;
    case "library.import.apply":
    case "library.import.cancel":
      if (isVideoId(value.previewId)) return { type: value.type, previewId: value.previewId };
      break;
    case "removal.undo":
    case "removal.dismiss":
      if (isVideoId(value.id)) return { type: value.type, id: value.id };
      break;
    case "library.get":
    case "video.remove":
      if (isVideoId(value.videoId)) return { type: value.type, videoId: value.videoId };
      break;
    case "favorite.set":
      if (isVideoId(value.videoId) && typeof value.favorite === "boolean") {
        return { type: value.type, videoId: value.videoId, favorite: value.favorite };
      }
      break;
    case "selection.set":
      if (isVideoId(value.videoId) && typeof value.selected === "boolean") {
        return { type: value.type, videoId: value.videoId, selected: value.selected };
      }
      break;
    case "session.open":
      if (isVideoId(value.videoId) && isVideoId(value.sessionId)) {
        return { type: value.type, videoId: value.videoId, sessionId: value.sessionId };
      }
      break;
    case "session.close":
      if (isVideoId(value.sessionId)) return { type: value.type, sessionId: value.sessionId };
      break;
    case "session.checkpoint": {
      const reasons = ["play", "tick", "pause", "seek", "hidden", "leave", "ended", "manual"];
      if (isVideoId(value.sessionId) && Number.isSafeInteger(value.sequence) && Number(value.sequence) > 0 &&
        Number.isSafeInteger(value.policyRevision) && Number(value.policyRevision) >= 0 &&
        typeof value.reason === "string" && reasons.includes(value.reason) && isVideoProgress(value.video) &&
        value.video.duration !== undefined && value.video.lastWatched <= value.video.duration + 1 &&
        (value.reason !== "ended" || value.video.lastWatched >= value.video.duration - 1) &&
        (value.interactionAt === undefined || isPosition(value.interactionAt))) {
        return {
          type: value.type, sessionId: value.sessionId, sequence: Number(value.sequence),
          policyRevision: Number(value.policyRevision), reason: value.reason as PlaybackCheckpoint["reason"],
          video: copyProgress(value.video),
          ...(typeof value.interactionAt === "number" ? { interactionAt: value.interactionAt } : {}),
        };
      }
      break;
    }
    case "progress.save":
      if (isVideoProgress(value.video)) return { type: value.type, video: copyProgress(value.video) };
      break;
    case "settings.save":
      if (isSettings(value.settings)) return { type: value.type, settings: copySettings(value.settings) };
      break;
  }
  throw new Error("Invalid library command or payload.");
}

function isResult(type: LibraryCommand["type"], value: unknown): boolean {
  switch (type) {
    case "library.list":
      return isRecord(value) && Object.entries(value).every(([id, video]) =>
        isVideoProgress(video) && video.videoId === id);
    case "library.get":
      return value === null || isVideoProgress(value);
    case "settings.get":
      return isSettings(value);
    case "library.export":
      try { parseLibraryBackup(value); return true; } catch { return false; }
    case "library.import.preview":
      return isImportPreview(value);
    case "library.import.apply":
      return isImportSummary(value);
    case "video.remove":
    case "removal.pending":
      return value === null || isRemovalReceipt(value);
    case "removal.undo":
      return isRecord(value) && (value.status === "restored" || value.status === "already-saved") && isVideoId(value.videoId);
    case "migration.status":
      return isMigrationStatus(value);
    case "session.open":
      return isRecord(value) && isPlaybackPolicy(value.policy) &&
        (value.saved === null || isVideoProgress(value.saved)) &&
        typeof value.selected === "boolean" && typeof value.removed === "boolean";
    case "session.checkpoint":
      return isRecord(value) && isPlaybackPolicy(value.policy) && typeof value.selected === "boolean" &&
        ((value.status === "saved" && isPosition(value.position)) ||
          (value.status === "ignored" && ["not-selected", "music-disabled", "removed", "closed", "stale-policy",
            "stale-sequence", "stale-checkpoint", "another-tab"].includes(String(value.reason))));
    default:
      return value === null;
  }
}

export async function requestLibrary<C extends LibraryCommand>(
  command: C,
): Promise<LibraryReplies[C["type"]]> {
  const reply: unknown = await chrome.runtime.sendMessage({ channel: LIBRARY_CHANNEL, command });
  if (!isRecord(reply) || typeof reply.ok !== "boolean") {
    throw new Error("SmartSeek did not receive a valid storage response. Reload the extension and refresh YouTube.");
  }
  if (!reply.ok) {
    throw new Error(typeof reply.message === "string" ? reply.message : "SmartSeek storage request failed.");
  }
  if (!isResult(command.type, reply.data)) throw new Error("SmartSeek received invalid saved data.");
  // The result validator above establishes the command-specific wire type.
  return reply.data as LibraryReplies[C["type"]];
}
