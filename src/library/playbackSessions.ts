import { copyProgress, isRecord } from "@/shared/libraryProtocol";
import type { LibraryCommand } from "@/shared/libraryProtocol";
import type { CheckpointReply } from "@/shared/playbackTypes";
import { STORAGE_KEYS } from "./keys";
import { readPolicy, readVideo } from "./records";

const SESSION_PREFIX = "smartseek:playback:session:";
const OWNER_PREFIX = "smartseek:playback:owner:";

type Session = { videoId: string; documentId: string; removed: boolean; sequence: number };
type Owner = { sessionKey: string; interactionAt: number };
export type PlaybackSource = { tabId: number; documentId: string };

function isSession(value: unknown): value is Session {
  return isRecord(value) && typeof value.videoId === "string" && typeof value.documentId === "string" &&
    typeof value.removed === "boolean" && Number.isSafeInteger(value.sequence);
}

export async function invalidatePlayback(videoId?: string): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.session.get(null);
  const changes = Object.fromEntries(Object.entries(stored).filter(([key, value]) =>
    key.startsWith(SESSION_PREFIX) && isSession(value) && (videoId === undefined || value.videoId === videoId))
    .map(([key, value]) => [key, { ...(value as Session), removed: true }]));
  if (Object.keys(changes).length) await chrome.storage.session.set(changes);
}

export async function closeTabPlayback(tabId: number): Promise<void> {
  const stored = await chrome.storage.session.get(null);
  const prefix = `${SESSION_PREFIX}${tabId}:`;
  const keys = Object.keys(stored).filter((key) => key.startsWith(prefix) ||
    (key.startsWith(OWNER_PREFIX) && isRecord(stored[key]) && String(stored[key].sessionKey).startsWith(prefix)));
  if (keys.length) await chrome.storage.session.remove(keys);
}

export async function runPlayback(
  command: Extract<LibraryCommand, { type: "session.open" | "session.checkpoint" | "session.close" }>,
  source: PlaybackSource,
) {
  const key = `${SESSION_PREFIX}${source.tabId}:${command.sessionId}`;
  const stored: Record<string, unknown> = await chrome.storage.session.get(key);
  const existing = stored[key];
  const session = isSession(existing) && existing.documentId === source.documentId ? existing : null;
  const policy = await readPolicy();

  if (command.type === "session.open") {
    if (existing !== undefined && (!session || session.videoId !== command.videoId)) {
      throw new Error("Playback session identity changed. Refresh YouTube to start a new session.");
    }
    if (!session) {
      await chrome.storage.session.set({ [key]: {
        videoId: command.videoId, documentId: source.documentId, removed: false, sequence: 0,
      } satisfies Session });
    }
    const saved = await readVideo(command.videoId);
    return { policy, saved, selected: saved?.isSelected === true, removed: session?.removed ?? false };
  }

  if (command.type === "session.close") {
    if (session) {
      const ownerKey = OWNER_PREFIX + session.videoId;
      const owner = (await chrome.storage.session.get(ownerKey))[ownerKey];
      await chrome.storage.session.remove(isRecord(owner) && owner.sessionKey === key ? [key, ownerKey] : [key]);
    }
    return null;
  }

  const saved = await readVideo(command.video.videoId);
  let selected = saved?.isSelected === true;
  const ignored = (reason: Extract<CheckpointReply, { status: "ignored" }>["reason"]): CheckpointReply =>
    ({ status: "ignored", reason, policy, selected });
  if (!session || session.videoId !== command.video.videoId) return ignored("closed");
  if (command.policyRevision !== policy.revision) return ignored("stale-policy");
  if (session.removed && command.reason !== "manual") return ignored("removed");
  const capturedAt = Date.parse(command.video.updatedAt);
  if (capturedAt > Date.now() + 1000 || Date.now() - capturedAt > 30_000) return ignored("stale-checkpoint");
  if (command.reason !== "manual") {
    if (policy.saveMode === "selected" && !selected) return ignored("not-selected");
    if (!selected && command.video.isMusic && !policy.includeMusic) return ignored("music-disabled");
  }

  const progressKey = STORAGE_KEYS.progress(command.video.videoId);
  const rawProgress = (await chrome.storage.local.get(progressKey))[progressKey];
  const checkpoint = isRecord(rawProgress) && isRecord(rawProgress.checkpoint) ? rawProgress.checkpoint : null;
  const committedSequence = checkpoint?.sessionKey === key && Number.isSafeInteger(checkpoint.sequence)
    ? Number(checkpoint.sequence) : 0;
  const lastSequence = Math.max(session.sequence, committedSequence);
  if (command.sequence <= lastSequence) {
    if (command.sequence === committedSequence && saved) {
      return { status: "saved", position: saved.lastWatched, policy, selected } satisfies CheckpointReply;
    }
    return ignored("stale-sequence");
  }

  const ownerKey = OWNER_PREFIX + command.video.videoId;
  const rawOwner = (await chrome.storage.session.get(ownerKey))[ownerKey];
  const owner: Owner | null = isRecord(rawOwner) && typeof rawOwner.sessionKey === "string" &&
    typeof rawOwner.interactionAt === "number" ? { sessionKey: rawOwner.sessionKey, interactionAt: rawOwner.interactionAt } : null;
  const interactionAt = command.interactionAt !== undefined && command.interactionAt <= Date.now() + 1000 &&
    command.interactionAt >= capturedAt - 30_000 ? command.interactionAt : undefined;
  const explicit = (command.reason === "manual" || command.reason === "play" || command.reason === "seek") && interactionAt !== undefined;
  if (owner?.sessionKey !== key) {
    if (owner ? !explicit || interactionAt! <= owner.interactionAt : command.reason !== "play" && !explicit) {
      return ignored("another-tab");
    }
  }
  await chrome.storage.session.set({ [ownerKey]: {
    sessionKey: key, interactionAt: explicit ? Math.max(interactionAt!, owner?.interactionAt ?? 0) : owner?.interactionAt ?? 0,
  } satisfies Owner });

  if (command.reason === "manual") {
    const preferencesKey = STORAGE_KEYS.preferences(command.video.videoId);
    const preferences = (await chrome.storage.local.get(preferencesKey))[preferencesKey];
    await chrome.storage.local.set({ [preferencesKey]: { ...(isRecord(preferences) ? preferences : {}), isSelected: true } });
    selected = true;
  }
  await chrome.storage.local.set({ [progressKey]: {
    ...(saved ? copyProgress(saved) : {}), ...copyProgress(command.video),
    isCompleted: command.reason === "ended" ||
      (saved?.isCompleted === true && command.video.lastWatched >= (command.video.duration ?? saved.duration ?? Infinity) - 1),
    checkpoint: { sessionKey: key, sequence: command.sequence },
  } });
  await chrome.storage.session.set({ [key]: { ...session, sequence: command.sequence, removed: false } satisfies Session });
  return { status: "saved", position: command.video.lastWatched, policy, selected } satisfies CheckpointReply;
}
