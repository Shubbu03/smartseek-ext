import { useEffect, useState } from "react";
import { VideoProgress } from "../../model/VideoProgress";

export default function App() {
  const [videos, setVideos] = useState<Record<string, VideoProgress>>({});

  useEffect(() => {
    chrome.storage.local.get("video_progress", (data) => {
      setVideos(data.video_progress || {});
    });
  }, []);

  return (
    <div className="h-[600px] w-[400px] bg-white text-black p-4">
      <h1 className="text-xl font-bold mb-4">SmartSeek</h1>
      {Object.keys(videos).length === 0 ? (
        <p>No saved videos yet.</p>
      ) : (
        <ul className="space-y-3">
          {Object.entries(videos).map(([id, v]) => (
            <li key={id} className="border p-2 rounded bg-gray-100">
              <div className="font-medium">{v.title || "Untitled"}</div>
              <div className="text-xs text-gray-600">
                Timestamp: {Math.floor(v.lastWatched)}s
              </div>
              <a
                className="text-blue-500 text-xs underline"
                href={`https://www.youtube.com/watch?v=${id}&t=${Math.floor(
                  v.lastWatched
                )}s`}
                target="_blank"
              >
                Resume on YouTube
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
