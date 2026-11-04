export type VideoProgress = {
  videoId: string;
  title?: string;
  lastWatched: number;
  duration?: number;
  updatedAt: string;
  isMusic?: boolean;
  isFavorite?: boolean;
};
