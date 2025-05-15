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
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-[600px] w-[400px] bg-gray-50 text-gray-900 flex flex-col">
      <div className="bg-blue-600 text-white p-3 shadow-md">
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
            className="text-blue-600"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <h2 className="text-lg font-semibold">Recent Saves</h2>
        </div>

        {Object.keys(videos).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
            <p>No saved videos yet.</p>
            <p className="text-sm mt-2">Videos you watch will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {Object.entries(videos).map(([id, video]) => (
              <li
                key={id}
                className="rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="flex">
                  <div className="relative w-32 h-20 bg-gray-200 flex-shrink-0">
                    <img
                      src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                      {formatTime(video.lastWatched)}
                    </div>
                  </div>

                  <div className="flex-1 p-2 flex flex-col justify-between">
                    <div>
                      <h3 className="font-medium text-sm line-clamp-2">
                        {video.title || "Untitled Video"}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Saved at {formatTime(video.lastWatched)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center pr-3">
                    <a
                      href={`https://www.youtube.com/watch?v=${id}&t=${Math.floor(
                        video.lastWatched
                      )}s`}
                      target="_blank"
                      className="rounded-full bg-blue-600 text-white p-2 hover:bg-blue-700 transition-colors"
                      aria-label="Play video"
                    >
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

      <div className="p-3 text-center text-xs text-gray-500 border-t border-gray-200">
        smartseek helps you continue videos where you left off
      </div>
    </div>
  );
}
