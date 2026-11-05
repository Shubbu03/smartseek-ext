import { watchVideos } from "@/library/storage";
import { watchSettings } from "@/settings/storage";
import type { VideoProgress } from "@/library/types";
import type { CheckpointReason, PlaybackCheckpoint, SessionOpened } from "@/shared/playbackTypes";
import { createYouTubePlayer, explicitTimestamp } from "@/youtube/player";
import type { BrowserWindow } from "@/youtube/player";
import { closePlayback, openPlayback, saveCheckpoint } from "./client";
import { createPlayerControl } from "./playerControl";
import type { PlaybackStatus } from "./playerControl";

type Job = {
  checkpoint: PlaybackCheckpoint;
  resolve?: (status: PlaybackStatus) => void;
  reject?: (error: Error) => void;
};
type Session = {
  id: string;
  videoId: string;
  alive: boolean;
  opened?: SessionOpened;
  restoreDone: boolean;
  restoreTarget: number | null;
  startPosition?: number;
  sequence: number;
  hasPlayed: boolean;
  needsClaim: boolean;
  interactionAt?: number;
  lastCandidate?: VideoProgress;
  lastQueuedAt: number;
  lastPosition: number | null;
  feedback?: PlaybackStatus["state"];
  error?: string;
  auto?: Job;
  manual?: Job;
  running: boolean;
  synchronization: number;
  inFlight?: Promise<void>;
  retries: Set<() => void>;
};

const mounted = new WeakMap<Document, { dispose: () => void }>();

function timeLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function mountPlayback(host: BrowserWindow) {
  const doc = host.document;
  mounted.get(doc)?.dispose();
  const player = createYouTubePlayer(host);
  let current: Session | null = null;
  let disposed = false;
  let openingError: string | null = null;

  function getStatus(): PlaybackStatus {
    const snapshot = player.read();
    const opened = current?.opened;
    const selected = opened?.selected ?? false;
    let state: PlaybackStatus["state"] = "ready";
    let message = "Ready to track this video.";
    if (!snapshot.videoId) { state = "waiting"; message = "Open a regular YouTube watch page to save progress."; }
    else if (openingError || current?.error) { state = "error"; message = openingError || current?.error || "Could not save."; }
    else if (!opened || !snapshot.confirmed) { state = "waiting"; message = snapshot.isAd ? "Saving is paused during advertisements." : "Waiting for confirmed video metadata."; }
    else if (current?.running) { state = "saving"; message = "Saving progress…"; }
    else if (opened.removed) { state = "removed"; message = "Removed from your library. Click Save progress to track it again."; }
    else if (!selected && (opened.policy.saveMode === "selected" || (snapshot.music === "music" && !opened.policy.includeMusic))) {
      state = "not-tracking"; message = "Not tracking. Click Save progress once to keep this video’s position updated.";
    } else if (current?.feedback === "another-tab") { state = "another-tab"; message = "Another tab is tracking this video. Play, seek or save here to take over."; }
    else if (current?.lastPosition !== null && current?.lastPosition !== undefined) {
      state = "saved"; message = `Saved at ${timeLabel(current.lastPosition)}.`;
    }
    return {
      supported: !!snapshot.videoId, videoId: snapshot.videoId, title: snapshot.title, state, selected,
      canSave: (!!opened || openingError !== null) && snapshot.confirmed && !current?.running && !disposed,
      position: current?.lastPosition ?? null, message,
    };
  }

  const control = createPlayerControl(host, saveNow);
  function render() { control.update(getStatus(), current?.opened?.policy.showSaveButton ?? (openingError !== null)); }

  function cancelPending(session: Session) {
    session.auto = undefined;
    session.manual?.reject?.(new Error("Saving preferences or the video changed. Save again to use the current video."));
    session.manual = undefined;
  }

  function waitToRetry(session: Session): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        session.retries.delete(finish);
        resolve();
      };
      const timer = setTimeout(finish, 300);
      session.retries.add(finish);
    });
  }

  async function synchronize(session: Session, attempt = 0): Promise<void> {
    const synchronization = ++session.synchronization;
    try {
      const opened = await openPlayback(session.videoId, session.id);
      if (!session.alive || current !== session) {
        await closePlayback(session.id);
        return;
      }
      if (synchronization !== session.synchronization) return;
      if (session.opened && session.opened.policy.revision !== opened.policy.revision) cancelPending(session);
      session.opened = opened;
      session.lastPosition ??= opened.saved?.lastWatched ?? null;
      openingError = null;
      refresh();
    } catch (failure) {
      if (attempt === 0 && session.alive && current === session && synchronization === session.synchronization) {
        await waitToRetry(session);
        if (session.alive && current === session && synchronization === session.synchronization) {
          return synchronize(session, 1);
        }
      }
      if (session.alive && current === session && synchronization === session.synchronization) {
        openingError = failure instanceof Error ? failure.message : "Could not start tracking.";
        render();
      }
    }
  }

  function stopSession(session: Session, flush: boolean) {
    session.alive = false;
    for (const cancel of session.retries) cancel();
    cancelPending(session);
    const last = session.lastCandidate;
    const ending = flush && last && session.opened && !session.opened.removed ? {
      sessionId: session.id, sequence: ++session.sequence, policyRevision: session.opened.policy.revision,
      reason: "leave" as const, video: last,
    } : null;
    void (async () => {
      await session.inFlight;
      if (ending) await saveCheckpoint(ending);
    })().catch(() => undefined).finally(() => { void closePlayback(session.id).catch(() => undefined); });
  }

  function refresh() {
    if (disposed) return;
    const snapshot = player.read();
    if (snapshot.videoId !== (current?.videoId ?? null)) {
      if (current) stopSession(current, true);
      current = snapshot.videoId ? {
        id: host.crypto.randomUUID(), videoId: snapshot.videoId, alive: true,
        restoreDone: explicitTimestamp(host.location.href) !== null, restoreTarget: null,
        sequence: 0, hasPlayed: false, needsClaim: true, lastQueuedAt: 0,
        lastPosition: null, running: false, synchronization: 0, retries: new Set(),
      } : null;
      openingError = null;
      if (current) void synchronize(current);
    }
    const session = current;
    // Record where this video was when first confirmed. Attaching to a tab that was already
    // playing, or one YouTube already positioned, must not seek back to a saved checkpoint.
    if (session && session.startPosition === undefined && snapshot.confirmed && snapshot.media) {
      session.startPosition = snapshot.media.currentTime;
    }
    if (session?.opened && !session.restoreDone && snapshot.confirmed && snapshot.media) {
      session.restoreDone = true;
      const saved = session.opened.saved;
      if (session.opened.policy.autoResume && saved && !saved.isCompleted && (session.startPosition ?? 0) <= 5 &&
        saved.lastWatched > 5 && saved.lastWatched < snapshot.media.duration - 5) {
        session.restoreTarget = saved.lastWatched;
        snapshot.media.currentTime = saved.lastWatched;
      }
    }
    if (session?.opened && !session.opened.policy.autoResume) session.restoreDone = true;
    if (session && snapshot.confirmed && snapshot.media && !snapshot.media.paused) session.hasPlayed = true;
    render();
  }

  async function processJob(session: Session, job: Job) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const reply = await saveCheckpoint(job.checkpoint);
        if (!session.alive || current !== session) throw new Error("The playback session changed before this save finished.");
        if (session.opened) {
          if (session.opened.policy.revision !== reply.policy.revision) cancelPending(session);
          session.opened.policy = reply.policy;
          session.opened.selected = reply.selected;
        }
        if (reply.status === "saved") {
          session.lastPosition = reply.position;
          session.needsClaim = false;
          session.error = undefined;
          if (session.opened) session.opened.removed = false;
          session.feedback = "saved";
          job.resolve?.({ ...getStatus(), state: "saved", position: reply.position, message: `Saved at ${timeLabel(reply.position)}.` });
        } else {
          if (reply.reason === "removed" && session.opened) session.opened.removed = true;
          if (reply.reason === "another-tab") session.feedback = "another-tab";
          if (job.reject) throw new Error(`Could not save (${reply.reason}). Try saving again.`);
        }
        return;
      } catch (failure) {
        if (attempt === 0 && session.alive && job.checkpoint.policyRevision === session.opened?.policy.revision) {
          await waitToRetry(session);
          if (session.alive && job.checkpoint.policyRevision === session.opened?.policy.revision) continue;
        }
        const error = failure instanceof Error ? failure : new Error("Could not save progress.");
        if (session.alive && current === session) session.error = error.message;
        job.reject?.(error);
        return;
      }
    }
  }

  async function drain(session: Session) {
    if (session.running) return;
    session.running = true;
    render();
    while (session.alive && (session.auto || session.manual)) {
      const job = !session.auto ? session.manual! : !session.manual ? session.auto
        : session.auto.checkpoint.sequence < session.manual.checkpoint.sequence ? session.auto : session.manual;
      if (job === session.auto) session.auto = undefined; else session.manual = undefined;
      session.inFlight = processJob(session, job);
      await session.inFlight;
    }
    session.inFlight = undefined;
    session.running = false;
    if (!disposed && current === session) render();
  }

  function capture(reason: CheckpointReason, manual?: Pick<Job, "resolve" | "reject">) {
    const session = current;
    const snapshot = player.read();
    const media = snapshot.media;
    if (!session?.opened || !snapshot.confirmed || snapshot.videoId !== session.videoId || !media ||
      !session.restoreDone || !Number.isFinite(media.currentTime) || media.currentTime < 0 ||
      media.currentTime > media.duration + 1 || session.restoreTarget !== null) return false;
    const interactionAt = reason === "manual" ? Date.now() : session.interactionAt !== undefined &&
      Date.now() - session.interactionAt < 3000 ? session.interactionAt : undefined;
    const position = Math.min(Math.floor(media.currentTime), Math.floor(media.duration));
    if (position === 0 && reason !== "manual" && !(reason === "seek" && interactionAt !== undefined)) return false;
    if (reason === "ended" && media.currentTime < media.duration - 1) return false;
    const video: VideoProgress = {
      videoId: session.videoId, lastWatched: position, duration: media.duration,
      updatedAt: new Date().toISOString(), title: snapshot.title,
      ...(snapshot.music !== "unknown" ? { isMusic: snapshot.music === "music" } : {}),
    };
    session.lastCandidate = video;
    if (reason !== "manual" && session.opened.removed) return false;
    const policy = session.opened.policy;
    if (reason !== "manual" && !session.opened.selected &&
      (policy.saveMode === "selected" || (snapshot.music === "music" && !policy.includeMusic))) return false;
    if (reason === "tick" && Date.now() - session.lastQueuedAt < 5000) return false;
    session.lastQueuedAt = Date.now();
    const checkpoint: PlaybackCheckpoint = {
      sessionId: session.id, sequence: ++session.sequence, policyRevision: policy.revision,
      reason: session.needsClaim && session.hasPlayed && (reason === "tick" || reason === "pause" || reason === "hidden") ? "play" : reason,
      video, interactionAt,
    };
    if (manual) session.manual = { checkpoint, ...manual }; else session.auto = { checkpoint };
    void drain(session);
    return true;
  }

  async function saveNow(): Promise<PlaybackStatus> {
    if (current && !current.opened) {
      await synchronize(current);
      if (!current?.opened) throw new Error(openingError || "Waiting for the player. Try saving again in a moment.");
    }
    return new Promise((resolve, reject) => {
      if (!getStatus().canSave || !capture("manual", { resolve, reject })) {
        reject(new Error("Wait for a supported, non-advertisement video before saving."));
      }
    });
  }

  const mediaEvents = ["loadstart", "emptied", "loadedmetadata", "durationchange", "play", "pause", "seeking", "seeked", "timeupdate", "ended"];
  const onMedia = (event: Event) => {
    const media = event.target as HTMLVideoElement | null;
    if (media?.tagName !== "VIDEO") return;
    player.mediaEvent(media, event.type);
    const before = player.read();
    if (current && before.media === media && !before.isAd && event.type === "seeking") {
      if (current.restoreTarget === null || Math.abs(media.currentTime - current.restoreTarget) > 1) {
        current.restoreDone = true;
        current.restoreTarget = null;
      }
    }
    refresh();
    const session = current;
    if (!session || player.read().media !== media) return;
    if (event.type === "seeked" && session.restoreTarget !== null) {
      session.restoreTarget = null;
      return;
    }
    if (event.type === "timeupdate" && session.restoreTarget !== null && Math.abs(media.currentTime - session.restoreTarget) < 1) session.restoreTarget = null;
    if (event.type === "play") { session.hasPlayed = true; capture("play"); }
    if (event.type === "pause") capture("pause");
    if (event.type === "seeked") capture("seek");
    if (event.type === "ended") capture("ended");
    if (event.type === "timeupdate" && !media.paused) capture("tick");
  };
  for (const type of mediaEvents) doc.addEventListener(type, onMedia, true);
  const onInput = (event: Event) => {
    if (!current || !event.isTrusted) return;
    const target = event.target as Element | null;
    const key = (event as KeyboardEvent).key;
    if (!target?.closest?.("#movie_player") && ![" ", "k", "j", "l", "ArrowLeft", "ArrowRight"].includes(key)) return;
    current.interactionAt = Date.now();
    current.restoreDone = true;
    current.restoreTarget = null;
  };
  doc.addEventListener("pointerdown", onInput, true);
  doc.addEventListener("keydown", onInput, true);
  const onHidden = () => { if (doc.visibilityState === "hidden") capture("hidden"); };
  const onLeave = () => { capture("leave"); };
  doc.addEventListener("visibilitychange", onHidden);
  host.addEventListener("pagehide", onLeave);
  doc.addEventListener("fullscreenchange", render);
  const unobserve = player.observe(refresh);
  const unwatchSettings = watchSettings(() => { if (current) void synchronize(current); });
  const unwatchVideos = watchVideos(() => { if (current) void synchronize(current); });
  const timer = setInterval(() => {
    refresh();
    if (!player.read().media?.paused) capture("tick");
  }, 5000);

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (current) stopSession(current, false);
    clearInterval(timer);
    unobserve();
    unwatchSettings();
    unwatchVideos();
    for (const type of mediaEvents) doc.removeEventListener(type, onMedia, true);
    doc.removeEventListener("pointerdown", onInput, true);
    doc.removeEventListener("keydown", onInput, true);
    doc.removeEventListener("visibilitychange", onHidden);
    host.removeEventListener("pagehide", onLeave);
    doc.removeEventListener("fullscreenchange", render);
    control.dispose();
    mounted.delete(doc);
  }
  const controller = { refresh, getStatus, saveNow, dispose };
  mounted.set(doc, controller);
  refresh();
  return controller;
}
