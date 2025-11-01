import { useState, useRef, useEffect } from "react";
import { VideoProgress } from "@/model/VideoProgress";
import { FiClock, FiSearch, FiX, FiMusic, FiChevronDown } from "react-icons/fi";
import { VideoViewType } from "../types";
import VideoCard from "./VideoCard";
import EmptyState from "./EmptyState";

type VideoListProps = {
  videos: [string, VideoProgress][];
  searchTerm: string;
  isSearchVisible: boolean;
  viewType: VideoViewType;
  isMusicToggleEnabled: boolean;
  onSearchToggle: () => void;
  onViewChange: (view: VideoViewType) => void;
  onDeleteVideo: (videoId: string, videoTitle?: string) => void;
};

export default function VideoList({
  videos,
  searchTerm,
  isSearchVisible,
  viewType,
  isMusicToggleEnabled,
  onSearchToggle,
  onViewChange,
  onDeleteVideo,
}: VideoListProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const showMusicToggleWarning = viewType === "music" && !isMusicToggleEnabled;

  const options: { value: VideoViewType; label: string }[] = [
    { value: "recent", label: "Recent Saves" },
    { value: "music", label: "Music Videos" },
  ];

  const currentLabel = viewType === "music" ? "Music Videos" : "Recent Saves";

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          {viewType === "music" ? (
            <FiMusic size={20} className="text-[#2d3133]" />
          ) : (
            <FiClock size={20} className="text-[#2d3133]" />
          )}
          {!isSearchVisible && !searchTerm ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <h2 className="text-lg font-semibold text-[#2d3133]">
                  {currentLabel} ({videos.length})
                </h2>
                <FiChevronDown
                  size={16}
                  className={`text-[#2d3133] transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px]">
                  {options.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onViewChange(option.value);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${viewType === option.value
                        ? "bg-[#2d3133] text-[#f4f2ee]"
                        : "text-[#2d3133] hover:bg-gray-100"
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <h2 className="text-lg font-semibold text-[#2d3133]">
              Results ({videos.length})
            </h2>
          )}
        </div>
        <button
          onClick={onSearchToggle}
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

      {showMusicToggleWarning ? (
        <EmptyState
          hasSearchTerm={false}
          isMusicToggleDisabled={true}
          viewType={viewType}
        />
      ) : videos.length === 0 ? (
        <EmptyState hasSearchTerm={!!searchTerm} />
      ) : (
        <ul className="space-y-3">
          {videos.map(([id, video]) => (
            <VideoCard
              key={id}
              videoId={id}
              video={video}
              onDelete={onDeleteVideo}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

