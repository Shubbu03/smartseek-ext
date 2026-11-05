import { createLibraryCoordinator } from "@/library/coordinator";
import { LIBRARY_CHANNEL, isRecord, parseCommand } from "@/shared/libraryProtocol";
import type { LibraryCommand, LibraryReply } from "@/shared/libraryProtocol";

async function isAllowed(command: LibraryCommand, sender: chrome.runtime.MessageSender): Promise<boolean> {
  if (sender.id !== chrome.runtime.id || !sender.url) return false;
  if (sender.url.startsWith(chrome.runtime.getURL("/"))) return true;
  if (sender.tab?.id === undefined || sender.frameId !== 0) return false;
  let url: URL;
  try { url = new URL(sender.url); } catch { return false; }
  if (url.origin !== "https://www.youtube.com" || (sender.origin !== undefined && sender.origin !== url.origin)) return false;
  if (command.type === "settings.get") return true;
  if (command.type === "session.checkpoint" || command.type === "session.close") return true;
  if (command.type === "library.get" || command.type === "session.open") {
    // YouTube navigates without replacing the script context; sender.url can still
    // name the initial page. Authorize the video against the browser's current tab URL.
    try {
      const tab = await chrome.tabs.get(sender.tab.id);
      if (!tab.url) return false;
      const current = new URL(tab.url);
      if (current.origin !== url.origin) return false;
      const videoId = current.pathname === "/watch" ? current.searchParams.get("v")
        : current.pathname.startsWith("/shorts/") ? current.pathname.split("/")[2] : null;
      return command.videoId === videoId;
    } catch { return false; }
  }
  return false;
}

export function registerLibraryMessages() {
  const coordinator = createLibraryCoordinator();
  const listener = (message: unknown, sender: chrome.runtime.MessageSender,
    sendResponse: (response: LibraryReply) => void) => {
    if (!isRecord(message) || message.channel !== LIBRARY_CHANNEL) return;
    let command: LibraryCommand;
    try {
      command = parseCommand(message.command);
    } catch (error) {
      sendResponse({ ok: false, code: "INVALID_REQUEST", message: error instanceof Error ? error.message : "Invalid request." });
      return;
    }
    void isAllowed(command, sender).then(async (allowed) => {
      if (!allowed) {
        sendResponse({ ok: false, code: "FORBIDDEN", message: "This page cannot perform that SmartSeek operation." });
        return;
      }
      const data = await coordinator.execute(command, sender.tab?.id === undefined ? undefined : {
        tabId: sender.tab.id, documentId: sender.documentId ?? `tab-${sender.tab.id}`,
      });
      sendResponse({ ok: true, data });
    }).catch((error: unknown) => sendResponse({
        ok: false, code: "STORAGE_ERROR",
        message: error instanceof Error ? error.message : "SmartSeek could not commit the storage operation.",
      }));
    return true;
  };
  // Register synchronously, before any migration IO or lifecycle initialization.
  chrome.runtime.onMessage.addListener(listener);
  return {
    initialize: () => coordinator.execute({ type: "migration.status" }),
    maintain: () => coordinator.execute({ type: "maintenance" }),
    closeTab: (tabId: number) => coordinator.closeTab(tabId),
    dispose: () => chrome.runtime.onMessage.removeListener(listener),
  };
}
