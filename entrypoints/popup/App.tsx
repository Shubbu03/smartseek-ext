import { VideoProgress } from "@/model/VideoProgress";
import { useEffect, useState } from "react";

export default function App() {
  const [videos, setVideos] = useState<Record<string, VideoProgress>>({});

  useEffect(() => {
    chrome.storage.local.get("video_progress", (data) => {
      setVideos(data.video_progress || {});
    });
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-[600px] w-[400px] bg-[#f4f2ee] text-[#2d3133] flex flex-col font-sans">
      {" "}
      <div className="bg-[#2d3133] text-[#f4f2ee] p-3 shadow-md">
        {" "}
        <div className="flex justify-center items-center">
          <h1 className="text-xl font-bold">smartseek</h1>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-4">
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
          <h2 className="text-lg font-semibold text-[#2d3133]">Recent Saves</h2>{" "}
        </div>

        {Object.keys(videos).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-[#313536]">
            {" "}
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
            <p className="font-medium">No saved videos yet.</p>
            <p className="text-sm mt-1">Videos you watch will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {" "}
            {Object.entries(videos).map(([id, video]) => (
              <li
                key={id}
                className="rounded-lg bg-white border border-[#d1d5db] shadow-sm overflow-hidden transition-shadow hover:shadow-md"
              >
                <div className="flex">
                  <div className="relative w-32 h-20 bg-gray-300 flex-shrink-0">
                    {" "}
                    <img
                      src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
                      alt={video.title || "Video thumbnail"}
                      className="w-full h-full object-cover"
                      onError={(e) =>
                        (e.currentTarget.src =
                          "https://via.placeholder.com/128x72.png?text=No+Thumbnail")
                      }
                    />
                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-[11px] px-1.5 py-0.5 rounded">
                      {" "}
                      {formatTime(video.lastWatched)}{" "}
                    </div>
                  </div>

                  <div className="flex-1 p-3 flex flex-col justify-between">
                    {" "}
                    <div>
                      <h3 className="font-semibold text-sm text-[#2d3133] line-clamp-2 leading-tight">
                        {" "}
                        {video.title || "Untitled Video"}
                      </h3>
                      <p className="text-xs text-[#313536] mt-1">
                        {" "}
                        Watched up to {formatTime(video.lastWatched)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center pr-3">
                    {" "}
                    <a
                      href={`https://www.youtube.com/watch?v=${id}&t=${Math.floor(
                        video.lastWatched
                      )}s`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-[#2d3133] text-[#f4f2ee] p-2.5 hover:bg-[#313536] transition-colors"
                      aria-label="Play video"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="0"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="p-3 text-center text-xs text-[#313536] border-t border-[#e5e7eb]">
        {" "}
        smartseek helps you continue videos where you left off
      </div>
    </div>
  );
}
