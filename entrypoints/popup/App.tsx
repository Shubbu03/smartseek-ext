import { useState, useEffect } from "react";
import { useVideos } from "./hooks/useVideos";
import { useVideoFiltering } from "./hooks/useVideoFiltering";
import { SortOption, VideoViewType } from "./types";
import { getSettings } from "../../lib/settings";
import { toggleFavorite } from "../../lib/storage";
import Header from "./components/Header";
import SettingsView from "./components/SettingsView";
import SearchBar from "./components/SearchBar";
import VideoList from "./components/VideoList";

export default function App() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<SortOption>("default");
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<"home" | "settings">("home");
  const [viewType, setViewType] = useState<VideoViewType>("recent");
  const [isMusicToggleEnabled, setIsMusicToggleEnabled] = useState<boolean>(false);

  const { videos, handleDeleteVideo, cleanupCompletedVideos } = useVideos();

  useEffect(() => {
    getSettings().then((settings) => {
      setIsMusicToggleEnabled(settings.saveMusicVideosOnly);
      if (settings.defaultView) {
        setViewType(settings.defaultView);
      }
    });

    const listener = (changes: any, areaName: string) => {
      if (areaName === "local" && changes.smartseek_settings) {
        const newSettings = changes.smartseek_settings.newValue;
        if (newSettings) {
          setIsMusicToggleEnabled(newSettings.saveMusicVideosOnly || false);
          if (newSettings.defaultView) {
            setViewType(newSettings.defaultView);
          }
        }
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  const filteredAndSortedVideos = useVideoFiltering(
    videos,
    searchTerm,
    sortOrder,
    viewType,
    cleanupCompletedVideos
  );

  const handleSearchIconClick = () => {
    const newVisibility = !isSearchVisible;
    setIsSearchVisible(newVisibility);
    if (!newVisibility) {
      setSearchTerm("");
      setSortOrder("default");
    }
  };

  const handleToggleFavorite = async (videoId: string) => {
    try {
      await toggleFavorite(videoId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Extension context invalidated")) {
        alert("Extension was reloaded. Please refresh the extension and try again.");
        return;
      }
      console.error("[SmartSeek] Error toggling favorite:", error);
    }
  };

  return (
    <div className="h-[600px] w-[400px] bg-[#f4f2ee] text-[#2d3133] flex flex-col font-sans">
      <Header currentView={currentView} onViewChange={setCurrentView} />

      {currentView === "settings" ? (
        <SettingsView />
      ) : (
        <>
          {isSearchVisible && (
            <SearchBar
              searchTerm={searchTerm}
              sortOrder={sortOrder}
              onSearchChange={setSearchTerm}
              onSortChange={setSortOrder}
            />
          )}

          <VideoList
            videos={filteredAndSortedVideos}
            searchTerm={searchTerm}
            isSearchVisible={isSearchVisible}
            viewType={viewType}
            isMusicToggleEnabled={isMusicToggleEnabled}
            onSearchToggle={handleSearchIconClick}
            onViewChange={setViewType}
            onDeleteVideo={handleDeleteVideo}
            onToggleFavorite={handleToggleFavorite}
          />

          <div className="p-3 text-center text-xs text-[#313536] border-t border-[#e5e7eb]">
            smartseek helps you continue videos where you left off
          </div>
        </>
      )}
    </div>
  );
}
