import { isRecord, isVideoId } from "./validation";
import type { PlaybackStatus } from "@/playback/playerControl";

export const PLAYER_CHANNEL = "smartseek:player:v3";
export function isPlaybackStatus(value: unknown): value is PlaybackStatus {
  return isRecord(value) && typeof value.supported === "boolean" &&
    (value.videoId === null || isVideoId(value.videoId)) && typeof value.title === "string" &&
    ["waiting", "ready", "saving", "saved", "not-tracking", "removed", "another-tab", "error"].includes(String(value.state)) &&
    typeof value.selected === "boolean" && typeof value.canSave === "boolean" &&
    (value.position === null || (typeof value.position === "number" && Number.isFinite(value.position) && value.position >= 0)) &&
    typeof value.message === "string";
}

export function isMissingPlayer(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /receiving end does not exist|could not establish connection/i.test(message);
}
