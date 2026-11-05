import { useState } from "react";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/csr/DotsThree";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import type { VideoProgress } from "@/library/types";
import { calculateProgress, formatTime } from "../utils/videoUtils";

type VideoCardProps = {
  videoId: string;
  video: VideoProgress;
  pending: boolean;
  onDelete: (videoId: string) => void;
  onToggleFavorite: (videoId: string) => void;
  onToggleSelection: (videoId: string) => void;
};

export default function VideoCard({ videoId, video, pending, onDelete, onToggleFavorite, onToggleSelection }: VideoCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const progress = calculateProgress(video);
  const title = video.title || "Untitled video";
  const resumeAt = video.isCompleted ? 0 : Math.floor(video.lastWatched);

  return (
    <li className="video-row" aria-busy={pending}>
      <div className="video-thumbnail">
        <div className="thumbnail-fallback" aria-hidden="true"><PlayIcon /></div>
        {!imageFailed && <img src={`https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`} alt="" loading="lazy" onError={() => setImageFailed(true)} />}
        <button className="favorite-button" aria-pressed={!!video.isFavorite} disabled={pending}
          aria-label={`${video.isFavorite ? "Remove from favorites" : "Add to favorites"}: ${title}`}
          title={video.isFavorite ? "Remove from favorites" : "Add to favorites"} onClick={() => onToggleFavorite(videoId)}>
          <StarIcon weight={video.isFavorite ? "fill" : "regular"} aria-hidden="true" />
        </button>
        <span className="video-duration">{formatTime(video.duration ?? video.lastWatched)}</span>
      </div>
      <div className="video-copy">
        <h2 className="video-title" title={title}>{title}</h2>
        <div className="video-position"><span>{formatTime(video.lastWatched)}{video.duration ? ` / ${formatTime(video.duration)}` : " saved"}</span>{video.isCompleted && <span>Finished</span>}</div>
        {video.duration && <div className="video-progress" role="progressbar" aria-label={`Watch progress: ${title}`} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}
          aria-valuetext={`${formatTime(video.lastWatched)} of ${formatTime(video.duration)}`}><span style={{ width: `${progress}%` }} /></div>}
      </div>
      <div className="video-actions">
        <a className="icon-button resume-button" href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${resumeAt}s`} target="_blank" rel="noreferrer"
          aria-label={video.isCompleted ? `Watch again: ${title}` : `Resume ${title} at ${formatTime(resumeAt)}`} title={video.isCompleted ? "Watch again" : "Resume video"}><PlayIcon aria-hidden="true" /></a>
        <details className="video-options" name="video-options"
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
          <summary className="icon-button" aria-label={`Video options: ${title}`} title="Video options"><DotsThreeIcon aria-hidden="true" /></summary>
          <div className="video-options-panel">
            <button className="choose-button" aria-pressed={!!video.isSelected} disabled={pending}
              aria-label={`${video.isSelected ? "Stop saving in manual mode" : "Save in manual mode"}: ${title}`}
              title="Manually saved videos keep updating as you watch, even in manual mode" onClick={(event) => {
                const options = event.currentTarget.closest("details");
                if (options) { options.open = false; options.querySelector("summary")?.focus(); }
                onToggleSelection(videoId);
              }}>
              {video.isSelected ? <CheckIcon aria-hidden="true" /> : <BookmarkSimpleIcon aria-hidden="true" />}
              {video.isSelected ? "Stop saving in manual mode" : "Save in manual mode"}
            </button>
            <button className="remove-button" disabled={pending} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); onDelete(videoId); }} aria-label={`Remove saved video: ${title}`}><TrashIcon aria-hidden="true" />Remove video</button>
          </div>
        </details>
      </div>
    </li>
  );
}
