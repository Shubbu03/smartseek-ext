import { requestLibrary } from "@/shared/libraryProtocol";
import type { PlaybackCheckpoint } from "@/shared/playbackTypes";

export function openPlayback(videoId: string, sessionId: string) {
  return requestLibrary({ type: "session.open", videoId, sessionId });
}

export function saveCheckpoint(checkpoint: PlaybackCheckpoint) {
  return requestLibrary({ type: "session.checkpoint", ...checkpoint });
}

export function closePlayback(sessionId: string) {
  return requestLibrary({ type: "session.close", sessionId });
}
