import { copyProgress, isRecord, isVideoId, isVideoProgress } from "@/shared/validation";
import { UNDO_WINDOW_MS } from "@/shared/libraryData";
import type { RemovalReceipt, UndoResult } from "@/shared/libraryData";
import type { VideoProgress } from "./types";
import { DATA_KEYS } from "./dataKeys";
import { STORAGE_KEYS } from "./keys";
import { commitDataMutation } from "./dataMutation";
import { readSettingsRecord, readVideo } from "./records";

type Removal = RemovalReceipt & { video: VideoProgress; order: number; restored: boolean };

function isRemoval(value: unknown): value is Removal {
  return isRecord(value) && isVideoId(value.id) && isVideoId(value.videoId) && typeof value.title === "string" &&
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt) && isVideoProgress(value.video) &&
    value.video.videoId === value.videoId && Number.isSafeInteger(value.order) && typeof value.restored === "boolean";
}

async function currentRemovals(): Promise<Removal[]> {
  const stored: Record<string, unknown> = await chrome.storage.session.get(null);
  const expired: string[] = [];
  const receipts: Removal[] = [];
  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith(DATA_KEYS.undoPrefix)) continue;
    if (!isRemoval(value) || value.expiresAt <= Date.now()) expired.push(key);
    else receipts.push(value);
  }
  if (expired.length) await chrome.storage.session.remove(expired);
  return receipts.sort((a, b) => b.order - a.order);
}

function receipt(removal: Removal): RemovalReceipt {
  return { id: removal.id, videoId: removal.videoId, title: removal.title, expiresAt: removal.expiresAt };
}

export async function pendingRemoval(): Promise<RemovalReceipt | null> {
  for (const removal of await currentRemovals()) {
    if (!removal.restored && !await readVideo(removal.videoId)) return receipt(removal);
  }
  return null;
}

export async function removeWithUndo(videoId: string): Promise<RemovalReceipt | null> {
  const video = await readVideo(videoId);
  if (!video) return null;
  const removals = await currentRemovals();
  if (removals.length >= 20) await chrome.storage.session.remove(removals.slice(19).map((item) => DATA_KEYS.undo(item.id)));
  const removal: Removal = {
    id: crypto.randomUUID(), videoId, title: video.title || "Untitled video", video,
    expiresAt: Date.now() + UNDO_WINDOW_MS, order: (removals[0]?.order ?? 0) + 1, restored: false,
  };
  await chrome.storage.session.set({ [DATA_KEYS.undo(removal.id)]: removal });
  const settings = await readSettingsRecord();
  await commitDataMutation({ version: 1,
    writes: { [STORAGE_KEYS.settings]: { ...settings, revision: settings.revision + 1 } },
    removals: [STORAGE_KEYS.progress(videoId), STORAGE_KEYS.preferences(videoId)],
    invalidate: [{ videoId, removalId: removal.id }], restore: [], clearUndo: false,
  });
  return receipt(removal);
}

export async function undoRemoval(id: string): Promise<UndoResult> {
  const removal = (await currentRemovals()).find((entry) => entry.id === id);
  if (!removal) throw new Error("The Undo window has expired. You can save this video again from YouTube.");
  if (removal.restored) return { status: "restored", videoId: removal.videoId };
  if (await readVideo(removal.videoId)) {
    await chrome.storage.session.remove(DATA_KEYS.undo(id));
    return { status: "already-saved", videoId: removal.videoId };
  }
  const settings = await readSettingsRecord();
  const { video, videoId } = removal;
  await commitDataMutation({ version: 1,
    writes: {
      [STORAGE_KEYS.settings]: { ...settings, revision: settings.revision + 1 },
      [STORAGE_KEYS.progress(videoId)]: copyProgress(video),
      [STORAGE_KEYS.preferences(videoId)]: {
        ...(video.isFavorite !== undefined ? { isFavorite: video.isFavorite } : {}),
        ...(video.isSelected !== undefined ? { isSelected: video.isSelected } : {}),
      },
    }, removals: [], invalidate: [], restore: [{ videoId, removalId: id }], clearUndo: false, consumeUndo: id,
  });
  return { status: "restored", videoId };
}

export async function dismissRemoval(id: string): Promise<void> {
  await chrome.storage.session.remove(DATA_KEYS.undo(id));
}
