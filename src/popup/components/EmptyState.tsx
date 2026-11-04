import React from "react";
import type { VideoViewType } from "../types";

interface EmptyStateProps {
  hasSearchTerm?: boolean;
  isMusicToggleDisabled?: boolean;
  viewType?: VideoViewType;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  hasSearchTerm = false,
  isMusicToggleDisabled = false,
  viewType,
}) => {
  if (isMusicToggleDisabled && viewType === "music") {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-[#313536]">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
          <span className="text-2xl font-bold text-gray-400">i</span>
        </div>
        <p className="font-medium text-center px-4">
          No music videos saved here yet
        </p>
        <p className="text-sm mt-1 text-center px-4">
          Choose a music video explicitly, or enable "Automatically Include Music" in settings.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-40 text-[#313536]">
      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
        <span className="text-2xl font-bold text-gray-400">i</span>
      </div>
      <p className="font-medium">
        {hasSearchTerm
          ? "No videos match your search."
          : viewType === "selected" ? "No chosen videos yet."
          : viewType === "completed" ? "No completed videos yet."
          : "No saved videos here yet."}
      </p>
      <p className="text-sm mt-1">
        {hasSearchTerm
          ? "Try a different search term or clear filters."
          : viewType === "completed" ? "Finished videos stay available here."
          : "Watch in Automatic mode, or choose Save this video."}
      </p>
    </div>
  );
};

export default EmptyState;
