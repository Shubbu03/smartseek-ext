import { registerLibraryMessages } from "./libraryMessages";
import { attachOpenYouTubeTabs } from "@/playback/attachment";

export function startBackground() {
  const library = registerLibraryMessages();
  const reportFailure = (error: unknown) => console.error("[SmartSeek] Storage initialization failed:", error);

  chrome.runtime.setUninstallURL("https://forms.gle/QGixqWqdrdxABfYx9", () => {
    if (chrome.runtime.lastError) console.error("Error setting uninstall URL:", chrome.runtime.lastError);
  });
  chrome.runtime.onInstalled.addListener(() => {
    library.initialize().catch(reportFailure);
    void attachOpenYouTubeTabs().catch(() => undefined);
  });
  chrome.runtime.onStartup.addListener(() => {
    library.maintain().catch(reportFailure);
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    library.closeTab(tabId).catch(reportFailure);
  });
}
