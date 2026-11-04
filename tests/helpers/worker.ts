import { fakeBrowser } from "wxt/testing/fake-browser";
import { registerLibraryMessages } from "@/background/libraryMessages";

export function restartWorker() {
  // Replace worker listeners/globals, preserving the external durable storage.
  fakeBrowser.runtime.onMessage.removeAllListeners();
  return registerLibraryMessages();
}
