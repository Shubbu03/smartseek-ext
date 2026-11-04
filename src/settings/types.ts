export type Settings = {
  saveMusicVideosOnly: boolean;
  defaultView?: "recent" | "music" | "favourites" | "selected" | "completed";
  saveMode?: "automatic" | "selected";
  autoResume?: boolean;
  showSaveButton?: boolean;
  retentionDays?: RetentionDays | null;
};

export const DEFAULT_SETTINGS: Settings = {
  saveMusicVideosOnly: false,
  defaultView: "recent",
};
export const RETENTION_DAYS = [30, 60, 90] as const;
export type RetentionDays = typeof RETENTION_DAYS[number];

export function isRetentionDays(value: unknown): value is RetentionDays {
  return RETENTION_DAYS.some((days) => days === value);
}
