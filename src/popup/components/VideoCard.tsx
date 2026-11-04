import { useState } from "react";
import { FiBookmark, FiCheck, FiLoader, FiPlay, FiStar, FiTrash2 } from "react-icons/fi";
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
        <div className="thumbnail-fallback" aria-hidden="true"><FiPlay /></div>
        {!imageFailed && <img src={`https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`} alt="" loading="lazy" onError={() => setImageFailed(true)} />}
        <button className="favorite-button" aria-pressed={!!video.isFavorite} disabled={pending}
          aria-label={`${video.isFavorite ? "Remove from favorites" : "Add to favorites"}: ${title}`}
          title={video.isFavorite ? "Remove from favorites" : "Add to favorites"} onClick={() => onToggleFavorite(videoId)}>
          <FiStar aria-hidden="true" />
        </button>
        <span className="video-duration">{formatTime(video.duration ?? video.lastWatched)}</span>
      </div>
      <div className="video-copy">
        <h2 className="video-title" title={title}>{title}</h2>
        <button className={`choose-button${video.isSelected ? " is-chosen" : ""}`} aria-pressed={!!video.isSelected} disabled={pending}
          aria-label={`${video.isSelected ? "Stop choosing" : "Choose"}: ${title}`}
          title="Chosen videos keep updating in Only videos I choose mode" onClick={() => onToggleSelection(videoId)}>
          {pending ? <FiLoader className="spin" aria-hidden="true" /> : video.isSelected ? <FiCheck aria-hidden="true" /> : <FiBookmark aria-hidden="true" />}
          {video.isSelected ? "Chosen video" : "Choose video"}{video.isCompleted && <span className="completed-label"> · Finished</span>}
        </button>
        <div className="video-position"><span>{formatTime(video.lastWatched)}{video.duration ? ` / ${formatTime(video.duration)}` : " saved"}</span>{video.duration && <span>{Math.round(progress)}%</span>}</div>
        {video.duration && <div className="video-progress" role="progressbar" aria-label={`Watch progress: ${title}`} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}
          aria-valuetext={`${formatTime(video.lastWatched)} of ${formatTime(video.duration)}`}><span style={{ width: `${progress}%` }} /></div>}
      </div>
      <div className="video-actions">
        <a className="icon-button resume-button" href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${resumeAt}s`} target="_blank" rel="noreferrer"
          aria-label={video.isCompleted ? `Watch again: ${title}` : `Resume ${title} at ${formatTime(resumeAt)}`} title={video.isCompleted ? "Watch again" : "Resume video"}><FiPlay aria-hidden="true" /></a>
        <button className="icon-button remove-button" disabled={pending} onClick={() => onDelete(videoId)} aria-label={`Remove saved video: ${title}`} title="Remove saved video"><FiTrash2 aria-hidden="true" /></button>
      </div>
    </li>
  );
}
