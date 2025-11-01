import { VideoProgress } from "@/model/VideoProgress";
import { useEffect, useMemo, useState } from "react";
import { deleteVideo, getTimestamp, saveTimestamp } from "../../lib/storage";

type SortOption =
  | "default"
  | "titleAsc"
  | "titleDesc"
  | "progressDesc"
  | "progressAsc";

export default function App() {
  const [videos, setVideos] = useState<Record<string, VideoProgress>>({});
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<SortOption>("default");
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);

  useEffect(() => {
    chrome.storage.local.get("video_progress", (data) => {
      setVideos(data.video_progress || {});
    });

    const storageChangeListener = (changes: any, areaName: string) => {
      if (areaName === "local" && changes.video_progress) {
        setVideos(changes.video_progress.newValue || {});
      }
    };
    chrome.storage.onChanged.addListener(storageChangeListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageChangeListener);
    };
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const calculateProgress = (video: VideoProgress): number => {
    if (!video.duration || video.duration === 0) return 0;
    return Math.min(100, (video.lastWatched / video.duration) * 100);
  };

  const getProgressColor = (progress: number): string => {
    if (progress >= 90) return "bg-red-500";
    if (progress >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  const handleSearchIconClick = () => {
    const newVisibility = !isSearchVisible;
    setIsSearchVisible(newVisibility);
    if (!newVisibility) {
      setSearchTerm("");
      setSortOrder("default");
    }
  };

  const handleDeleteVideo = async (videoId: string, videoTitle?: string) => {
    const title = videoTitle || "this video";
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      await deleteVideo(videoId);
      chrome.storage.local.get("video_progress", (data) => {
        setVideos(data.video_progress || {});
      });
    }
  };

  const filteredAndSortedVideos = useMemo(() => {
    let videoEntries = Object.entries(videos).filter(([id, video]) =>
      (video.title || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch (sortOrder) {
      case "titleAsc":
        videoEntries.sort(([, a], [, b]) =>
          (a.title || "").localeCompare(b.title || "")
        );
        break;
      case "titleDesc":
        videoEntries.sort(([, a], [, b]) =>
          (b.title || "").localeCompare(a.title || "")
        );
        break;
      case "progressDesc":
        videoEntries.sort(([, a], [, b]) => b.lastWatched - a.lastWatched);
        break;
      case "progressAsc":
        videoEntries.sort(([, a], [, b]) => a.lastWatched - b.lastWatched);
        break;
      case "default":
      default:
        videoEntries.sort(([, a], [, b]) => {
          const dateA = new Date(a.updatedAt).getTime();
          const dateB = new Date(b.updatedAt).getTime();
          return dateB - dateA;
        });
        break;
    }
    return videoEntries;
  }, [videos, searchTerm, sortOrder]);

  const SortButton: React.FC<{ value: SortOption; label: string }> = ({
    value,
    label,
  }) => (
    <button
      onClick={() => setSortOrder(value)}
      className={`px-3 py-1.5 text-xs rounded-md transition-colors
        ${sortOrder === value
          ? "bg-[#2d3133] text-[#f4f2ee]"
          : "bg-gray-200 text-[#2d3133] hover:bg-gray-300"
        }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-[600px] w-[400px] bg-[#f4f2ee] text-[#2d3133] flex flex-col font-sans">
      <div className="bg-[#2d3133] text-[#f4f2ee] p-3 shadow-md">
        <div className="flex justify-center items-center">
          <h1 className="text-xl font-bold">smartseek</h1>
        </div>
      </div>

      {isSearchVisible && (
        <div className="p-4 border-b border-gray-300">
          <input
            type="text"
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 mb-3 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2d3133] focus:border-[#2d3133] outline-none"
            autoFocus
          />
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-[#313536] mr-1">
              Sort by:
            </span>
            <SortButton value="default" label="Default" />
            <SortButton value="titleAsc" label="Title A-Z" />
            <SortButton value="titleDesc" label="Title Z-A" />
            <SortButton value="progressDesc" label="Most Watched" />
            <SortButton value="progressAsc" label="Least Watched" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          {" "}
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#2d3133]"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <h2 className="text-lg font-semibold text-[#2d3133]">
              {isSearchVisible || searchTerm ? `Results` : "Recent Saves"} (
              {filteredAndSortedVideos.length})
            </h2>
          </div>
          <button
            onClick={handleSearchIconClick}
            className="p-1.5 rounded-full hover:bg-gray-200 active:bg-gray-300 transition-colors cursor-pointer"
            aria-label={isSearchVisible ? "Hide search" : "Show search"}
          >
            {isSearchVisible ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#2d3133]"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#2d3133]"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            )}
          </button>
        </div>

        {filteredAndSortedVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-[#313536]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-3 text-[#313536] opacity-70"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <p className="font-medium">
              {searchTerm
                ? "No videos match your search."
                : "No saved videos yet."}
            </p>
            <p className="text-sm mt-1">
              {searchTerm
                ? "Try a different search term or clear filters."
                : "Videos you watch will appear here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredAndSortedVideos.map(([id, video]) => {
              const progress = calculateProgress(video);
              const progressColor = getProgressColor(progress);

              return (
                <li
                  key={id}
                  className="rounded-lg bg-white border border-[#d1d5db] shadow-sm overflow-hidden transition-all hover:shadow-md hover:scale-[1.01]"
                >
                  <div className="flex items-stretch">
                    <div className="relative w-32 h-24 bg-gray-300 flex-shrink-0 overflow-hidden rounded-l-lg">
                      <img
                        src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
                        alt={video.title || "Video thumbnail"}
                        className="w-full h-full object-cover"
                        onError={(e) =>
                        (e.currentTarget.src =
                          "https://via.placeholder.com/128x72.png?text=No+Thumb")
                        }
                      />
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
                        href={`https://www.youtube.com/watch?v=${id}&t=${Math.floor(
                          video.lastWatched
                        )}s`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-[#2d3133] text-[#f4f2ee] p-1.5 hover:bg-[#3e4244] transition-colors flex items-center justify-center"
                        aria-label="Play video"
                        title="Play video"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      </a>
                      <button
                        onClick={() => handleDeleteVideo(id, video.title)}
                        className="rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-100 p-1.5 transition-colors flex items-center justify-center cursor-pointer"
                        aria-label="Delete video"
                        title="Delete video"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="p-3 text-center text-xs text-[#313536] border-t border-[#e5e7eb]">
        smartseek helps you continue videos where you left off
      </div>
    </div>
  );
}
