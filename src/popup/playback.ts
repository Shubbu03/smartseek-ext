import { isRecord, requestLibrary } from "@/shared/libraryProtocol";
import type { PlaybackStatus } from "@/playback/playerControl";
import { watchVideoId } from "@/youtube/player";
import { isMissingPlayer, isPlaybackStatus, PLAYER_CHANNEL } from "@/shared/playerProtocol";

export async function activePlayback(type: "status" | "save"): Promise<PlaybackStatus | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !tab.url || !watchVideoId(tab.url)) return null;
  let reply: unknown;
  try {
    reply = await chrome.tabs.sendMessage(tab.id, { channel: PLAYER_CHANNEL, type }, { frameId: 0 });
  } catch (error) {
    // Only a missing receiver can be retried safely. A lost save reply may already be committed.
    if (!isMissingPlayer(error)) throw new Error("Could not reach this YouTube tab. Check the connection and try again.");
    try {
      await requestLibrary({ type: "playback.attach", tabId: tab.id });
      reply = await chrome.tabs.sendMessage(tab.id, { channel: PLAYER_CHANNEL, type }, { frameId: 0 });
    } catch { throw new Error("Could not connect to this YouTube tab. Refresh it once, then try again."); }
  }
  if (!isRecord(reply) || reply.ok !== true) {
    throw new Error(isRecord(reply) && typeof reply.message === "string" ? reply.message : "SmartSeek could not reach this video.");
  }
  if (!isPlaybackStatus(reply.data)) throw new Error("SmartSeek received an invalid player response.");
  return reply.data;
}
