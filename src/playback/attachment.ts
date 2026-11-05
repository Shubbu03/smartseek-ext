import { isRecord } from "@/shared/validation";
import { isMissingPlayer, isPlaybackStatus, PLAYER_CHANNEL } from "@/shared/playerProtocol";

const attaching = new Map<number, Promise<void>>();

async function connect(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || new URL(tab.url).origin !== "https://www.youtube.com") throw new Error("SmartSeek can only connect to YouTube tabs.");
  try {
    const reply: unknown = await chrome.tabs.sendMessage(tabId, { channel: PLAYER_CHANNEL, type: "status" }, { frameId: 0 });
    if (isRecord(reply) && reply.ok === true && isPlaybackStatus(reply.data)) return;
  } catch (error) { if (!isMissingPlayer(error)) throw error; }
  const files = chrome.runtime.getManifest().content_scripts?.find((script) => script.js?.includes("content-scripts/content.js"))?.js;
  if (!files?.length) throw new Error("The YouTube connection script is missing. Reload the built extension.");
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files });
}

export function ensurePlaybackAttached(tabId: number): Promise<void> {
  const pending = attaching.get(tabId);
  if (pending) return pending;
  const task = connect(tabId).finally(() => { attaching.delete(tabId); });
  attaching.set(tabId, task);
  return task;
}

export async function attachOpenYouTubeTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
  // Closed, discarded or inaccessible tabs must not prevent other tabs from attaching.
  await Promise.allSettled(tabs.filter((tab) => tab.id !== undefined).map((tab) => ensurePlaybackAttached(tab.id!)));
}
