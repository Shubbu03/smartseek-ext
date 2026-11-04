const PREFIX = "smartseek:v3:";

export const STORAGE_KEYS = {
  meta: `${PREFIX}meta`,
  backup: `${PREFIX}legacy-backup`,
  settings: `${PREFIX}settings`,
  progressPrefix: `${PREFIX}progress:`,
  preferencesPrefix: `${PREFIX}preferences:`,
  progress: (videoId: string) => `${PREFIX}progress:${videoId}`,
  preferences: (videoId: string) => `${PREFIX}preferences:${videoId}`,
};

export function isVideoKey(key: string): boolean {
  return key.startsWith(STORAGE_KEYS.progressPrefix) ||
    key.startsWith(STORAGE_KEYS.preferencesPrefix);
}
