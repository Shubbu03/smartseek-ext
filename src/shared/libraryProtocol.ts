import type { VideoProgress } from "@/library/types";
import type { Settings } from "@/settings/types";
import { isRetentionDays } from "@/settings/types";
import type { CheckpointReply, PlaybackCheckpoint, PlaybackPolicy, SessionOpened } from "./playbackTypes";

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
  "video.remove": null;
  "videos.clear": null;
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isVideoId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function isPosition(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isVideoProgress(value: unknown): value is VideoProgress {
  return isRecord(value) && isVideoId(value.videoId) && isPosition(value.lastWatched) &&
    typeof value.updatedAt === "string" && value.updatedAt.length <= 64 &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    (value.title === undefined || (typeof value.title === "string" && value.title.length <= 4096)) &&
    (value.duration === undefined || (isPosition(value.duration) && value.duration > 0)) &&
    (value.isMusic === undefined || typeof value.isMusic === "boolean") &&
    (value.isFavorite === undefined || typeof value.isFavorite === "boolean") &&
    (value.isSelected === undefined || typeof value.isSelected === "boolean") &&
    (value.isCompleted === undefined || typeof value.isCompleted === "boolean");
}

// Pick known fields: messages and legacy data must not become arbitrary storage writes.
export function copyProgress(video: VideoProgress): Omit<VideoProgress, "isFavorite" | "isSelected"> {
  return {
    videoId: video.videoId,
    lastWatched: video.lastWatched,
    updatedAt: video.updatedAt,
    ...(video.title !== undefined ? { title: video.title } : {}),
    ...(video.duration !== undefined ? { duration: video.duration } : {}),
    ...(video.isMusic !== undefined ? { isMusic: video.isMusic } : {}),
    ...(video.isCompleted !== undefined ? { isCompleted: video.isCompleted } : {}),
  };
}

export function isSettings(value: unknown): value is Settings {
  return isRecord(value) && typeof value.saveMusicVideosOnly === "boolean" &&
    (value.defaultView === undefined || value.defaultView === "recent" ||
      value.defaultView === "music" || value.defaultView === "favourites" ||
      value.defaultView === "selected" || value.defaultView === "completed") &&
    (value.saveMode === undefined || value.saveMode === "automatic" || value.saveMode === "selected") &&
    (value.autoResume === undefined || typeof value.autoResume === "boolean") &&
    (value.showSaveButton === undefined || typeof value.showSaveButton === "boolean") &&
    (value.retentionDays === undefined || value.retentionDays === null || isRetentionDays(value.retentionDays));
}

export function copySettings(settings: Settings): Settings {
  return {
    saveMusicVideosOnly: settings.saveMusicVideosOnly,
    defaultView: settings.defaultView ?? "recent",
    ...(settings.saveMode !== undefined ? { saveMode: settings.saveMode } : {}),
    ...(settings.autoResume !== undefined ? { autoResume: settings.autoResume } : {}),
    ...(settings.showSaveButton !== undefined ? { showSaveButton: settings.showSaveButton } : {}),
    ...(settings.retentionDays !== undefined ? { retentionDays: settings.retentionDays } : {}),
  };
}

export function normalizeStoredSettings(value: unknown): Settings | null {
  // The discontinued implicit/explicit 45-day policy must never opt a user into deletion.
  const settings = isRecord(value) && value.retentionDays === 45 ? { ...value, retentionDays: null } : value;
  return isSettings(settings) ? copySettings(settings) : null;
}

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
    case "settings.get":
    case "maintenance":
    case "migration.status":
      return { type: value.type };
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

export function isPlaybackPolicy(value: unknown): value is PlaybackPolicy {
  return isRecord(value) && Number.isSafeInteger(value.revision) && Number(value.revision) >= 0 &&
    (value.saveMode === "automatic" || value.saveMode === "selected") &&
    typeof value.autoResume === "boolean" && typeof value.showSaveButton === "boolean" &&
    typeof value.includeMusic === "boolean" && (value.retentionDays === null || isRetentionDays(value.retentionDays));
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
