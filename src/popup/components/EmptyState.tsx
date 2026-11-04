import { FiBookmark, FiCheckCircle, FiMusic, FiSearch, FiStar } from "react-icons/fi";
import type { VideoViewType } from "../types";

type EmptyStateProps = { view: VideoViewType; searching: boolean; selectedMode: boolean; libraryEmpty: boolean; onReset: () => void };

export default function EmptyState({ view, searching, selectedMode, libraryEmpty, onReset }: EmptyStateProps) {
  const Icon = searching ? FiSearch : view === "favourites" ? FiStar : view === "completed" ? FiCheckCircle : view === "music" ? FiMusic : FiBookmark;
  const title = searching ? "No matching videos" : libraryEmpty ? "Your next video starts here" : view === "favourites" ? "Keep your favorites close" : view === "selected" ? "A little more intentional" : view === "completed" ? "Nothing finished just yet" : view === "music" ? "No saved music yet" : "You’re all caught up";
  const description = searching ? "Try another title, or clear your search." : view === "favourites" && !libraryEmpty ? "Star a video to find it here. Favorites are always kept until you remove them." : view === "completed" && !libraryEmpty ? "Videos you finish stay available in this view." : view === "selected" || selectedMode ? "Choose Save this video on YouTube, or choose a video already in your library." : view === "music" ? "Choose a music video to keep its place, or include music in Automatic mode." : "Watch a YouTube video and we’ll remember where you pause.";
  return (
    <section className="empty-state" aria-label={title}>
      <div className="empty-symbol"><Icon aria-hidden="true" /></div><h2>{title}</h2><p>{description}</p>
      {searching ? <button className="button button-secondary" onClick={onReset}>Clear search</button> : libraryEmpty ? <a className="button button-primary" href="https://www.youtube.com" target="_blank" rel="noreferrer">Open YouTube</a> : view !== "recent" ? <button className="text-button" onClick={onReset}>Back to Continue</button> : null}
    </section>
  );
}
