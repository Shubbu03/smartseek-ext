import type { VideoProgress } from "@/library/types";
import VideoCard from "./VideoCard";

type VideoListProps = {
  videos: [string, VideoProgress][];
  pendingIds: ReadonlySet<string>;
  onDelete: (videoId: string) => void;
  onToggleFavorite: (videoId: string) => void;
  onToggleSelection: (videoId: string) => void;
};

export default function VideoList({ videos, pendingIds, onDelete, onToggleFavorite, onToggleSelection }: VideoListProps) {
  return <ul className="video-list" aria-label="Saved videos">{videos.map(([id, video]) => <VideoCard key={id} videoId={id} video={video} pending={pendingIds.has(id)}
    onDelete={onDelete} onToggleFavorite={onToggleFavorite} onToggleSelection={onToggleSelection} />)}</ul>;
}
