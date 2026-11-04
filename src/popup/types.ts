export type SortOption =
    | "default"
    | "titleAsc"
    | "titleDesc"
    | "progressDesc"
    | "progressAsc";

export type VideoViewType = "recent" | "music" | "favourites" | "selected" | "completed";

export const VIEW_LABELS = {
    recent: "Continue",
    favourites: "Favorites",
    selected: "Chosen videos",
    music: "Music",
    completed: "Completed",
} satisfies Record<VideoViewType, string>;

export const SORT_LABELS = {
    default: "Most recent",
    titleAsc: "Title A–Z",
    titleDesc: "Title Z–A",
    progressDesc: "Most watched",
    progressAsc: "Least watched",
} satisfies Record<SortOption, string>;

export function isViewType(value: string): value is VideoViewType {
    return Object.hasOwn(VIEW_LABELS, value);
}

export function isSortOption(value: string): value is SortOption {
    return Object.hasOwn(SORT_LABELS, value);
}

