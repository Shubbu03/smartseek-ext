import { cleanupOldTimestamps } from "../../lib/storage";

export default defineBackground(() => {
  console.log("SmartSeek background started", { id: browser.runtime.id });

  chrome.runtime.onInstalled.addListener(() => {
    console.log("SmartSeek installed/updated.");
    cleanupOldTimestamps().catch((error) => {
      console.error("Error during initial cleanup on install/update:", error);
    });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message &&
      typeof message === "object" &&
      message.action === "cleanup"
    ) {
      console.log(
        "Cleanup action triggered by message from:",
        sender.tab ? `tab ${sender.tab.id}` : "extension process"
      );

      cleanupOldTimestamps()
        .then(() => {
          console.log("Cleanup completed successfully via message.");
          sendResponse({
            success: true,
            message: "Storage cleanup completed successfully.",
          });
        })
        .catch((error) => {
          console.error("Error during cleanup triggered by message:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          sendResponse({
            success: false,
            message: `Storage cleanup failed: ${errorMessage}`,
          });
        });

      return true;
    }
  });
});
