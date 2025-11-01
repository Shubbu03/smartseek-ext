import React from "react";
import { VideoViewType } from "../types";

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
          Music videos are disabled
        </p>
        <p className="text-sm mt-1 text-center px-4">
          Enable "Save Music Videos" in settings to view music videos here.
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
          : "No saved videos yet."}
      </p>
      <p className="text-sm mt-1">
        {hasSearchTerm
          ? "Try a different search term or clear filters."
          : "Videos you watch will appear here."}
      </p>
    </div>
  );
};

export default EmptyState;
