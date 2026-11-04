import { isRecord } from "@/shared/validation";
import type { Experience } from "@/shared/experienceTypes";
import type { MigrationStatus } from "@/shared/libraryProtocol";
import { STORAGE_KEYS } from "./keys";
import { readSettingsRecord } from "./records";

export async function readExperience(migration: MigrationStatus): Promise<Experience> {
  const saved: unknown = (await chrome.storage.local.get(STORAGE_KEYS.experience))[STORAGE_KEYS.experience];
  if (isRecord(saved) && saved.version === 3 && typeof saved.completedAt === "string" && Number.isFinite(Date.parse(saved.completedAt))) return { step: "ready" };
  return { step: migration.installation === "new" ? "welcome" : "upgrade" };
}

export async function completeExperience(saveMode?: "automatic" | "selected"): Promise<Experience> {
  if (saveMode !== undefined) {
    const previous = await readSettingsRecord();
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: { ...previous, saveMode, revision: previous.revision + 1 } });
  }
  // A failed settings write must never mark setup complete.
  await chrome.storage.local.set({ [STORAGE_KEYS.experience]: { version: 3, completedAt: new Date().toISOString() } });
  return { step: "ready" };
}
