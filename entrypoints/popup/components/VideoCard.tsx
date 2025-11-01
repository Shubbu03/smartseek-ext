import { VideoProgress } from "@/model/VideoProgress";
import { FiPlay, FiTrash2, FiStar } from "react-icons/fi";
import { formatTime, calculateProgress, getProgressColor } from "../utils/videoUtils";

type VideoCardProps = {
  videoId: string;
  video: VideoProgress;
  onDelete: (videoId: string, videoTitle?: string) => void;
  onToggleFavorite: (videoId: string) => void;
};

export default function VideoCard({ videoId, video, onDelete, onToggleFavorite }: VideoCardProps) {
  const progress = calculateProgress(video);
  const progressColor = getProgressColor(progress);
  const isFavorite = video.isFavorite || false;

  return (
    <li className="rounded-lg bg-white border border-[#d1d5db] shadow-sm overflow-hidden transition-all hover:shadow-md hover:scale-[1.01]">
      <div className="flex items-stretch">
        <div className="relative w-32 h-24 bg-gray-300 flex-shrink-0 overflow-hidden rounded-l-lg group">
          <img
            src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
            alt={video.title || "Video thumbnail"}
            className="w-full h-full object-cover"
            onError={(e) =>
              (e.currentTarget.src =
                "https://via.placeholder.com/128x72.png?text=No+Thumb")
            }
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(videoId);
            }}
            className={`absolute top-1 right-1 p-1 rounded-full transition-all ${
              isFavorite
                ? "bg-yellow-400 text-yellow-900 opacity-100"
                : "bg-black bg-opacity-40 text-white opacity-70 group-hover:opacity-100"
            } hover:scale-110`}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <FiStar size={14} className={isFavorite ? "fill-current" : ""} />
          </button>
          {video.duration ? (
            <div className="absolute bottom-0.5 right-0.5 bg-black bg-opacity-75 text-white text-[10px] px-1 py-0.5 rounded-sm">
              {formatTime(video.duration)}
            </div>
          ) : (
            <div className="absolute bottom-0.5 right-0.5 bg-black bg-opacity-75 text-white text-[10px] px-1 py-0.5 rounded-sm">
              {formatTime(video.lastWatched)}
            </div>
          )}
        </div>
        <div className="flex-1 p-2.5 min-w-0">
          <h3 className="font-semibold text-sm text-[#2d3133] line-clamp-2 leading-tight break-words mb-1">
            {video.title || "Untitled Video"}
          </h3>

          {video.duration ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  {formatTime(video.lastWatched)} / {formatTime(video.duration)}
                </span>
                <span className="text-gray-500 font-medium">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${progressColor} transition-all duration-300 ease-out`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Watched up to {formatTime(video.lastWatched)}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end space-x-1 p-2 flex-shrink-0">
          <a
            href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(
              video.lastWatched
            )}s`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#2d3133] text-[#f4f2ee] p-1.5 hover:bg-[#3e4244] transition-colors flex items-center justify-center"
            aria-label="Play video"
            title="Play video"
          >
            <FiPlay size={16} />
          </a>
          <button
            onClick={() => onDelete(videoId, video.title)}
            className="rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-100 p-1.5 transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Delete video"
            title="Delete video"
          >
            <FiTrash2 size={16} />
          </button>
        </div>
      </div>
    </li>
  );
}

