import type { VideoProgress } from "@/library/types";
import type { RetentionDays } from "@/settings/types";

export type PlaybackPolicy = {
  revision: number;
  saveMode: "automatic" | "selected";
  autoResume: boolean;
  showSaveButton: boolean;
  includeMusic: boolean;
  retentionDays: RetentionDays | null;
};

export type CheckpointReason = "play" | "tick" | "pause" | "seek" | "hidden" | "leave" | "ended" | "manual";

export type SessionOpened = {
  policy: PlaybackPolicy;
  saved: VideoProgress | null;
  selected: boolean;
  removed: boolean;
};

export type PlaybackCheckpoint = {
  sessionId: string;
  sequence: number;
  policyRevision: number;
  reason: CheckpointReason;
  video: VideoProgress;
  interactionAt?: number;
};

export type CheckpointReply = {
  policy: PlaybackPolicy;
  selected: boolean;
} & (
  | { status: "saved"; position: number }
  | { status: "ignored"; reason: "not-selected" | "music-disabled" | "removed" | "closed" | "stale-policy" | "stale-sequence" | "stale-checkpoint" | "another-tab" }
);
