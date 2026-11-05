import { STORAGE_KEYS } from "@/library/keys";
import { requestLibrary } from "@/shared/libraryProtocol";
import type { Settings } from "./types";

export type { Settings } from "./types";

export function getSettings(): Promise<Settings> {
  return requestLibrary({ type: "settings.get" });
}

export async function saveSettings(settings: Settings): Promise<void> {
  await requestLibrary({ type: "settings.save", settings });
}

export function watchSettings(onChange: () => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && changes[STORAGE_KEYS.settings]) onChange();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
