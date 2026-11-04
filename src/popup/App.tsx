import { useState, useEffect } from "react";
import { useVideos } from "./hooks/useVideos";
import { useVideoFiltering } from "./hooks/useVideoFiltering";
import type { SortOption, VideoViewType } from "./types";
import { getSettings, watchSettings } from "@/settings/storage";
import { setFavorite, setSelected } from "@/library/storage";
import Header from "./components/Header";
import SettingsView from "./components/SettingsView";
import SearchBar from "./components/SearchBar";
import VideoList from "./components/VideoList";
import CurrentVideo from "./components/CurrentVideo";

export default function App() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<SortOption>("default");
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<"home" | "settings">("home");
  const [viewType, setViewType] = useState<VideoViewType>("recent");
  const [isMusicToggleEnabled, setIsMusicToggleEnabled] = useState<boolean>(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

  const { videos, loading, error, warnings, handleDeleteVideo } = useVideos();

  useEffect(() => {
    let active = true;
    let lastDefaultView: VideoViewType | undefined;
    const loadSettings = async () => {
      try {
        const settings = await getSettings();
        if (!active) return;
        setIsMusicToggleEnabled(settings.saveMusicVideosOnly);
        if (settings.defaultView && settings.defaultView !== lastDefaultView) setViewType(settings.defaultView);
        lastDefaultView = settings.defaultView;
        setSettingsError(null);
      } catch (failure) {
        if (active) setSettingsError(failure instanceof Error ? failure.message : "Could not load settings.");
      }
    };
    const unwatch = watchSettings(() => { void loadSettings(); });
    void loadSettings();
    return () => {
      active = false;
      unwatch();
    };
  }, []);

  const filteredAndSortedVideos = useVideoFiltering(
    videos,
    searchTerm,
    sortOrder,
    viewType
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
      await setFavorite(videoId, !videos[videoId]?.isFavorite);
      setFavoriteError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Extension context invalidated")) {
        alert("Extension was reloaded. Please refresh the extension and try again.");
        return;
      }
      console.error("[SmartSeek] Error toggling favorite:", error);
      setFavoriteError(errorMessage);
    }
  };

  const handleToggleSelection = async (videoId: string) => {
    try {
      await setSelected(videoId, !videos[videoId]?.isSelected);
      setFavoriteError(null);
    } catch (failure) {
      setFavoriteError(failure instanceof Error ? failure.message : "Could not change tracking selection.");
    }
  };

  return (
    <div className="h-[600px] w-[400px] bg-[#f4f2ee] text-[#2d3133] flex flex-col font-sans">
      <Header currentView={currentView} onViewChange={setCurrentView} />

      {error || settingsError ? (
        <div className="flex-1 p-4 space-y-3" role="alert">
          <p className="font-semibold">Your saved library could not be loaded.</p>
          <p className="text-sm">{error || settingsError}</p>
          <button className="rounded border border-gray-400 px-3 py-2" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      ) : loading ? (
        <p className="flex-1 p-4 text-sm" role="status">Preparing your saved library…</p>
      ) : currentView === "settings" ? (
        <SettingsView />
      ) : (
        <>
          <CurrentVideo />
          {favoriteError && <p className="mx-3 mt-3 text-xs text-red-700" role="alert">{favoriteError}</p>}
          {warnings.length > 0 && (
            <details className="mx-3 mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs">
              <summary>Some existing data needs attention ({warnings.length})</summary>
              <ul className="mt-2 space-y-1">
                {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
              </ul>
            </details>
          )}
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
            onToggleSelection={handleToggleSelection}
          />

          <div className="p-3 text-center text-xs text-[#313536] border-t border-[#e5e7eb]">
            smartseek helps you continue videos where you left off
          </div>
        </>
      )}
    </div>
  );
}
