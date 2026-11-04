export type Settings = {
  saveMusicVideosOnly: boolean;
  defaultView?: "recent" | "music" | "favourites" | "selected" | "completed";
  saveMode?: "automatic" | "selected";
  autoResume?: boolean;
  showSaveButton?: boolean;
  retentionDays?: 45 | null;
};

export const DEFAULT_SETTINGS: Settings = {
  saveMusicVideosOnly: false,
  defaultView: "recent",
};
