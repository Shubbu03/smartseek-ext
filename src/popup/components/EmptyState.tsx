import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { MusicNotesIcon } from "@phosphor-icons/react/dist/csr/MusicNotes";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import type { VideoViewType } from "../types";

type EmptyStateProps = { view: VideoViewType; searching: boolean; selectedMode: boolean; libraryEmpty: boolean; onReset: () => void };

export default function EmptyState({ view, searching, selectedMode, libraryEmpty, onReset }: EmptyStateProps) {
  const Icon = searching ? MagnifyingGlassIcon : view === "favourites" ? StarIcon : view === "completed" ? CheckCircleIcon : view === "music" ? MusicNotesIcon : BookmarkSimpleIcon;
  const title = searching ? "No matching videos" : libraryEmpty ? "Your next video starts here" : view === "favourites" ? "Keep your favorites close" : view === "selected" ? "No manually saved videos" : view === "completed" ? "Nothing finished just yet" : view === "music" ? "No saved music yet" : "You’re all caught up";
  const description = searching ? "Try another title, or clear your search." : view === "favourites" && !libraryEmpty ? "Star a video to find it here. Favorites are always kept until you remove them." : view === "completed" && !libraryEmpty ? "Videos you finish stay available in this view." : view === "selected" || selectedMode ? "Click Save progress on YouTube, or select Save in manual mode in a video’s options." : view === "music" ? "Save a music video manually, or include music in automatic mode." : "Watch a YouTube video and we’ll remember where you pause.";
  return (
    <section className="empty-state" aria-label={title}>
      <div className="empty-symbol"><Icon aria-hidden="true" /></div><h2>{title}</h2><p>{description}</p>
      {searching ? <button className="button button-secondary" onClick={onReset}>Clear search</button> : libraryEmpty ? <a className="button button-primary" href="https://www.youtube.com" target="_blank" rel="noreferrer">Open YouTube</a> : view !== "recent" ? <button className="text-button" onClick={onReset}>Back to recent saves</button> : null}
    </section>
  );
}
