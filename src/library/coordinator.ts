import { copyProgress, copySettings, isRecord } from "@/shared/libraryProtocol";
import type { LibraryCommand, LibraryReplies, MigrationStatus } from "@/shared/libraryProtocol";
import { isVideoKey, STORAGE_KEYS } from "./keys";
import { initializeLibrary } from "./migration";
import { advancePolicyRevision, listVideos, readPolicy, readSettingsRecord, readVideo } from "./records";
import { closeTabPlayback, invalidatePlayback, runPlayback } from "./playbackSessions";
import type { PlaybackSource } from "./playbackSessions";
import { applyPreparedImport, cancelPreparedImport, exportLibraryBackup, prepareLibraryImport } from "./transfer";
import { clearRemovalReceipts, recoverDataMutation } from "./dataMutation";
import { dismissRemoval, pendingRemoval, removeWithUndo, undoRemoval } from "./removals";
import { DATA_KEYS } from "./dataKeys";
import { completeExperience, readExperience } from "./experience";
import { collectDiagnostics, exportRecoverySnapshot } from "@/support/diagnostics";
import { ensurePlaybackAttached } from "@/playback/attachment";

const CLEANUP_BATCH_SIZE = 100;

// Instantiate only in the background worker. The queue includes initialization and reads,
// so callers cannot observe a half-migrated library or race a read-modify-write operation.
export function createLibraryCoordinator() {
  let tail: Promise<unknown> = Promise.resolve();
  let status: MigrationStatus | undefined;

  async function run(command: LibraryCommand, source?: PlaybackSource): Promise<LibraryReplies[keyof LibraryReplies]> {
    if (command.type === "playback.attach") { await ensurePlaybackAttached(command.tabId); return null; }
    if (command.type === "diagnostics.get") return collectDiagnostics();
    if (command.type === "recovery.export") return exportRecoverySnapshot();
    status ??= await initializeLibrary();
    await recoverDataMutation();
    switch (command.type) {
      case "experience.get":
        return readExperience(status);
      case "experience.complete": {
        const experience = await readExperience(status);
        if (experience.step === "ready") return experience;
        if (experience.step === "welcome" && command.saveMode === undefined) throw new Error("Choose a saving mode to finish setup.");
        return completeExperience(experience.step === "welcome" ? command.saveMode : undefined);
      }
      case "library.get":
        return readVideo(command.videoId);
      case "library.list":
        return listVideos();
      case "library.export":
        return exportLibraryBackup();
      case "library.import.preview":
        return prepareLibraryImport(command.backup, command.mode, command.includeSettings);
      case "library.import.apply":
        return applyPreparedImport(command.previewId);
      case "library.import.cancel":
        await cancelPreparedImport(command.previewId);
        return null;
      case "migration.status":
        return status;
      case "progress.save": {
        const previous = await readVideo(command.video.videoId);
        await chrome.storage.local.set({
          [STORAGE_KEYS.progress(command.video.videoId)]: {
            ...(previous ? copyProgress(previous) : {}), ...copyProgress(command.video),
          },
        });
        return null;
      }
      case "favorite.set":
      case "selection.set":
        if (await readVideo(command.videoId)) {
          if (command.type === "selection.set") await advancePolicyRevision();
          const key = STORAGE_KEYS.preferences(command.videoId);
          const previous = (await chrome.storage.local.get(key))[key];
          await chrome.storage.local.set({
            [key]: {
              ...(isRecord(previous) ? previous : {}),
              ...(command.type === "favorite.set" ? { isFavorite: command.favorite } : { isSelected: command.selected }),
            },
          });
        }
        return null;
      case "video.remove":
        return removeWithUndo(command.videoId);
      case "removal.pending":
        return pendingRemoval();
      case "removal.undo":
        return undoRemoval(command.id);
      case "removal.dismiss":
        await dismissRemoval(command.id);
        return null;
      case "videos.clear": {
        await advancePolicyRevision();
        await invalidatePlayback();
        await clearRemovalReceipts();
        await chrome.storage.session.remove(DATA_KEYS.preview);
        const stored = await chrome.storage.local.get(null);
        // The old snapshot and migration backup can contain videos the user is deleting.
        await chrome.storage.local.remove([
          ...Object.keys(stored).filter(isVideoKey), STORAGE_KEYS.backup, DATA_KEYS.importResult, "video_progress",
        ]);
        const clearedStatus: MigrationStatus = { ...status, warnings: [] };
        await chrome.storage.local.set({ [STORAGE_KEYS.meta]: clearedStatus });
        status = clearedStatus;
        return null;
      }
      case "settings.get": {
        return copySettings(await readSettingsRecord());
      }
      case "settings.save": {
        const previous = await readSettingsRecord();
        await chrome.storage.local.set({ [STORAGE_KEYS.settings]: {
          ...previous, ...copySettings(command.settings), revision: previous.revision + 1,
        } });
        return null;
      }
      case "session.open":
      case "session.checkpoint":
      case "session.close":
        if (!source) throw new Error("This operation requires a YouTube playback session.");
        return runPlayback(command, source);
      case "maintenance": {
        const policy = await readPolicy();
        if (policy.retentionDays === null) return null;
        const videos = await listVideos();
        const expired = Object.values(videos).filter((video) => !video.isFavorite &&
          Date.now() - Date.parse(video.updatedAt) > policy.retentionDays! * 24 * 60 * 60 * 1000).slice(0, CLEANUP_BATCH_SIZE);
        if (expired.length) {
          await advancePolicyRevision();
          for (const video of expired) await invalidatePlayback(video.videoId);
          await chrome.storage.local.remove(expired.flatMap((video) => [
            STORAGE_KEYS.progress(video.videoId), STORAGE_KEYS.preferences(video.videoId),
          ]));
        }
        return null;
      }
    }
  }

  return {
    execute(command: LibraryCommand, source?: PlaybackSource) {
      const result = tail.then(() => run(command, source));
      // A rejected write must not poison later requests or be reported as committed.
      tail = result.catch(() => undefined);
      return result;
    },
    closeTab(tabId: number) {
      const result = tail.then(() => closeTabPlayback(tabId));
      tail = result.catch(() => undefined);
      return result;
    },
  };
}
