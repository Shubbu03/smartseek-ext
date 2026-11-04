import { isRecord, isVideoId } from "@/shared/libraryProtocol";
import type { PlaybackStatus } from "@/playback/playerControl";
import { watchVideoId } from "@/youtube/player";

function isPlaybackStatus(value: unknown): value is PlaybackStatus {
  return isRecord(value) && typeof value.supported === "boolean" &&
    (value.videoId === null || isVideoId(value.videoId)) && typeof value.title === "string" &&
    ["waiting", "ready", "saving", "saved", "not-tracking", "removed", "another-tab", "error"].includes(String(value.state)) &&
    typeof value.selected === "boolean" && typeof value.canSave === "boolean" &&
    (value.position === null || (typeof value.position === "number" && Number.isFinite(value.position) && value.position >= 0)) &&
    typeof value.message === "string";
}

export async function activePlayback(type: "status" | "save"): Promise<PlaybackStatus | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !tab.url || !watchVideoId(tab.url)) return null;
  let reply: unknown;
  try {
    reply = await chrome.tabs.sendMessage(tab.id, { channel: "smartseek:player:v3", type });
  } catch {
    throw new Error("Refresh this YouTube tab after reloading SmartSeek, then try again.");
  }
  if (!isRecord(reply) || reply.ok !== true) {
    throw new Error(isRecord(reply) && typeof reply.message === "string" ? reply.message : "SmartSeek could not reach this video.");
  }
  if (!isPlaybackStatus(reply.data)) throw new Error("SmartSeek received an invalid player response.");
  return reply.data;
}
