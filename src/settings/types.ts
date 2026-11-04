export type Settings = {
  saveMusicVideosOnly: boolean;
  defaultView?: "recent" | "music" | "favourites" | "selected" | "completed";
  saveMode?: "automatic" | "selected";
  autoResume?: boolean;
  showSaveButton?: boolean;
  retentionDays?: RetentionDays | null;
  theme?: Theme;
  density?: Density;
};

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = typeof THEMES[number];
export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = typeof DENSITIES[number];
export function isTheme(value: unknown): value is Theme { return THEMES.some((theme) => theme === value); }
export function isDensity(value: unknown): value is Density { return DENSITIES.some((density) => density === value); }

export const DEFAULT_SETTINGS: Settings = {
  saveMusicVideosOnly: false,
  defaultView: "recent",
};
export const RETENTION_DAYS = [30, 60, 90] as const;
export type RetentionDays = typeof RETENTION_DAYS[number];

export function isRetentionDays(value: unknown): value is RetentionDays {
  return RETENTION_DAYS.some((days) => days === value);
}
