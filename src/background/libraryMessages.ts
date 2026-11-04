import { createLibraryCoordinator } from "@/library/coordinator";
import { LIBRARY_CHANNEL, isRecord, parseCommand } from "@/shared/libraryProtocol";
import type { LibraryCommand, LibraryReply } from "@/shared/libraryProtocol";

function isAllowed(command: LibraryCommand, sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || !sender.url) return false;
  if (sender.url.startsWith(chrome.runtime.getURL("/"))) return true;
  if (!sender.tab || sender.frameId !== 0) return false;
  let url: URL;
  try { url = new URL(sender.url); } catch { return false; }
  if (url.origin !== "https://www.youtube.com") return false;
  if (command.type === "settings.get") return true;
  const videoId = url.pathname === "/watch" ? url.searchParams.get("v")
    : url.pathname.startsWith("/shorts/") ? url.pathname.split("/")[2] : null;
  if (command.type === "library.get") return command.videoId === videoId;
  if (command.type === "session.open") return command.videoId === videoId;
  if (command.type === "session.checkpoint" || command.type === "session.close") return true;
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
    if (!isAllowed(command, sender)) {
      sendResponse({ ok: false, code: "FORBIDDEN", message: "This page cannot perform that SmartSeek operation." });
      return;
    }
    coordinator.execute(command, sender.tab?.id === undefined ? undefined : {
      tabId: sender.tab.id, documentId: sender.documentId ?? `tab-${sender.tab.id}`,
    }).then(
      (data) => sendResponse({ ok: true, data }),
      (error: unknown) => sendResponse({
        ok: false, code: "STORAGE_ERROR",
        message: error instanceof Error ? error.message : "SmartSeek could not commit the storage operation.",
      }),
    );
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
