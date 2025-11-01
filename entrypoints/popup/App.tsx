import { VideoProgress } from "@/model/VideoProgress";
import { useEffect, useMemo, useState } from "react";
import { deleteVideo, getTimestamp, saveTimestamp } from "../../lib/storage";
import { FiSettings, FiArrowLeft, FiClock, FiSearch, FiX, FiPlay, FiTrash2 } from "react-icons/fi";

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
  const [currentView, setCurrentView] = useState<"home" | "settings">("home");

  useEffect(() => {
    try {
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
        try {
          chrome.storage.onChanged.removeListener(storageChangeListener);
        } catch (error) {
          // Extension context invalidated, ignore
        }
      };
    } catch (error) {
      console.error("[SmartSeek] Error accessing storage:", error);
      setVideos({});
    }
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
      try {
        await deleteVideo(videoId);
        chrome.storage.local.get("video_progress", (data) => {
          setVideos(data.video_progress || {});
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("Extension context invalidated")) {
          alert("Extension was reloaded. Please refresh the extension and try again.");
          return;
        }
        console.error("[SmartSeek] Error deleting video:", error);
      }
    }
  };

  const filteredAndSortedVideos = useMemo(() => {
    // Filter out videos at 100% progress and remove them from storage
    const videosToRemove: string[] = [];
    let videoEntries = Object.entries(videos).filter(([id, video]) => {
      const progress = calculateProgress(video);
      if (progress >= 100) {
        videosToRemove.push(id);
        return false; // Exclude from list
      }
      return (video.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Remove 100% videos from storage (async, don't block rendering)
    if (videosToRemove.length > 0) {
      // Use setTimeout to avoid blocking the render
      setTimeout(() => {
        videosToRemove.forEach((videoId) => {
          deleteVideo(videoId).catch((error) => {
            if (error.message?.includes("Extension context invalidated")) {
              // Extension reloaded, ignore this error
              return;
            }
            console.error(`[SmartSeek] Error removing 100% video ${videoId}:`, error);
          });
        });
      }, 0);
    }

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
        videoEntries.sort(([, a], [, b]) => {
          const progressA = calculateProgress(a);
          const progressB = calculateProgress(b);
          return progressB - progressA;
        });
        break;
      case "progressAsc":
        videoEntries.sort(([, a], [, b]) => {
          const progressA = calculateProgress(a);
          const progressB = calculateProgress(b);
          return progressA - progressB;
        });
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
        <div className="flex items-center relative">
          {currentView === "settings" ? (
            <button
              onClick={() => setCurrentView("home")}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity absolute left-0"
              aria-label="Back to home"
            >
              <FiArrowLeft size={20} />
              <span className="text-sm font-medium">Back</span>
            </button>
          ) : null}
          <h1 className="text-xl font-bold flex-1 text-center">{currentView === "settings" ? "Settings" : "smartseek"}</h1>
          {currentView === "home" ? (
            <button
              onClick={() => setCurrentView("settings")}
              className="p-1.5 hover:bg-[#3e4244] rounded-full transition-colors cursor-pointer absolute right-0"
              aria-label="Open settings"
              title="Settings"
            >
              <FiSettings size={20} />
            </button>
          ) : null}
        </div>
      </div>

      {currentView === "settings" ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col items-center justify-center h-full text-[#313536]">
            <FiSettings size={64} className="mb-4 text-[#313536] opacity-50" />
            <p className="text-lg font-medium mb-2">Settings</p>
            <p className="text-sm text-center text-gray-500">
              Settings options will be available here soon.
            </p>
          </div>
        </div>
      ) : (
        <>
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
                <FiClock size={20} className="text-[#2d3133]" />
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
                  <FiX size={20} className="text-[#2d3133]" />
                ) : (
                  <FiSearch size={20} className="text-[#2d3133]" />
                )}
              </button>
            </div>

            {filteredAndSortedVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#313536]">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                  <span className="text-2xl font-bold text-gray-400">i</span>
                </div>
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
                            <FiPlay size={16} />
                          </a>
                          <button
                            onClick={() => handleDeleteVideo(id, video.title)}
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
                })}
              </ul>
            )}
          </div>
          <div className="p-3 text-center text-xs text-[#313536] border-t border-[#e5e7eb]">
            smartseek helps you continue videos where you left off
          </div>
        </>
      )}
    </div>
  );
}
