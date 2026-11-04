import { useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiRefreshCw, FiShield, FiX } from "react-icons/fi";
import { deleteAllVideos, deleteVideo, setFavorite, setSelected } from "@/library/storage";
import { useSettings } from "./hooks/useSettings";
import { useVideos } from "./hooks/useVideos";
import { useVideoFiltering } from "./hooks/useVideoFiltering";
import { SORT_LABELS, VIEW_LABELS } from "./types";
import type { SortOption, VideoViewType } from "./types";
import Header from "./components/Header";
import SettingsView from "./components/SettingsView";
import SearchBar from "./components/SearchBar";
import ViewDropdown from "./components/ViewDropdown";
import VideoList from "./components/VideoList";
import CurrentVideo from "./components/CurrentVideo";
import EmptyState from "./components/EmptyState";
import ConfirmDialog from "./components/ConfirmDialog";

type Confirmation = { kind: "all" } | { kind: "video"; id: string; title: string };

function LoadingLibrary() {
  return <main className="popup-content library-loading" aria-busy="true" aria-label="Loading your saved library">
    <p className="sr-only" role="status">Loading your saved videos…</p>
    <div className="skeleton skeleton-heading" /><div className="skeleton skeleton-current" />
    {[0, 1, 2].map((key) => <div key={key} className="skeleton-row" aria-hidden="true"><div className="skeleton skeleton-thumb" /><div><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /></div></div>)}
  </main>;
}

export default function App() {
  const [currentView, setCurrentView] = useState<"home" | "settings">("home");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOption>("default");
  const [viewType, setViewType] = useState<VideoViewType>("recent");
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const pendingRef = useRef(new Set<string>());
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const preferences = useSettings();
  const library = useVideos();
  const defaultView = preferences.settings?.defaultView;
  const videos = useVideoFiltering(library.videos, searchTerm, sortOrder, viewType);

  useEffect(() => { if (defaultView) setViewType(defaultView); }, [defaultView]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const allVideos = Object.values(library.videos);
  const counts: Record<VideoViewType, number> = { recent: 0, favourites: 0, selected: 0, music: 0, completed: 0 };
  for (const video of allVideos) {
    counts[video.isCompleted ? "completed" : "recent"]++;
    if (video.isFavorite) counts.favourites++;
    if (video.isSelected) counts.selected++;
    if (video.isMusic) counts.music++;
  }

  const videoAction = async (id: string, action: () => Promise<void>) => {
    if (pendingRef.current.has(id)) return;
    pendingRef.current.add(id);
    setPendingIds(new Set(pendingRef.current));
    try { await action(); await library.reload(); setActionError(null); }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : "That change could not be saved. Try again."); }
    finally { pendingRef.current.delete(id); setPendingIds(new Set(pendingRef.current)); }
  };

  const removeConfirmed = async () => {
    if (!confirmation) return;
    if (confirmation.kind === "all") await deleteAllVideos(); else await deleteVideo(confirmation.id);
    await library.reload();
    setNotice(confirmation.kind === "all" ? "Your saved library has been cleared." : "Video removed from your library.");
  };
  const retry = () => { void library.reload(); void preferences.reload(); };
  const error = library.error || preferences.error;
  const saveError = preferences.saveError || actionError;

  return (
    <div className="smartseek-app h-150 w-100">
      <Header currentView={currentView} mode={preferences.settings?.saveMode ?? "automatic"}
        disabled={preferences.loading || !!preferences.error} saving={preferences.saving} onViewChange={setCurrentView}
        onModeChange={(saveMode) => { void preferences.update({ saveMode }); }} />
      {saveError && <div className="notice-banner error-banner" role="alert"><FiAlertCircle aria-hidden="true" /><p>{saveError}</p>
        <button className="icon-button" aria-label="Dismiss error" onClick={() => { setActionError(null); preferences.dismissSaveError(); }}><FiX aria-hidden="true" /></button></div>}

      {preferences.loading || library.loading ? <LoadingLibrary /> : error || !preferences.settings ? (
        <main className="popup-content load-error"><div className="empty-symbol"><FiAlertCircle aria-hidden="true" /></div>
          <h1>Couldn’t load SmartSeek</h1><p role="alert">{error || "Your preferences could not be loaded."}</p>
          <button className="button button-primary" onClick={retry}><FiRefreshCw aria-hidden="true" />Try again</button></main>
      ) : currentView === "settings" ? (
        <SettingsView settings={preferences.settings} saving={preferences.saving} savedCount={allVideos.length}
          onChange={preferences.update} onClear={() => setConfirmation({ kind: "all" })} />
      ) : (
        <main className="popup-content" id="main-content">
          <div className="page-heading"><h1>Continue watching</h1></div>
          <CurrentVideo />
          {library.warnings.length > 0 && <details className="migration-notice"><summary>Some saved data needs attention ({library.warnings.length})</summary><ul>{library.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
          <SearchBar searchTerm={searchTerm} sortOrder={sortOrder} onSearchChange={setSearchTerm} onSortChange={setSortOrder} />
          <ViewDropdown viewType={viewType} counts={counts} onViewChange={setViewType} />
          <div className="list-meta"><span>{searchTerm ? `${videos.length} search ${videos.length === 1 ? "result" : "results"}` : `${videos.length} ${videos.length === 1 ? "video" : "videos"} · ${VIEW_LABELS[viewType]}`}</span><span>{SORT_LABELS[sortOrder]}</span></div>
          {videos.length > 0 ? <VideoList videos={videos} pendingIds={pendingIds}
            onDelete={(id) => setConfirmation({ kind: "video", id, title: library.videos[id]?.title || "this video" })}
            onToggleFavorite={(id) => { void videoAction(id, () => setFavorite(id, !library.videos[id]?.isFavorite)); }}
            onToggleSelection={(id) => { void videoAction(id, () => setSelected(id, !library.videos[id]?.isSelected)); }} />
            : <EmptyState view={viewType} searching={!!searchTerm} selectedMode={preferences.settings.saveMode === "selected"} libraryEmpty={allVideos.length === 0}
              onReset={() => { if (searchTerm) setSearchTerm(""); else setViewType("recent"); }} />}
        </main>
      )}

      <footer className="popup-footer"><span><FiShield aria-hidden="true" />{preferences.saving ? "Saving preferences…" : "Stored on this device"}</span><span>{library.loading ? "Loading library…" : library.error ? "Library unavailable" : `${allVideos.length} saved${counts.favourites > 0 ? ` · ${counts.favourites} ${counts.favourites === 1 ? "favorite" : "favorites"}` : ""}`}</span></footer>
      {notice && <div className="toast" role="status"><span>{notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><FiX aria-hidden="true" /></button></div>}
      {confirmation && <ConfirmDialog key={confirmation.kind === "all" ? "all" : confirmation.id}
        title={confirmation.kind === "all" ? "Clear your saved library?" : "Remove this saved video?"}
        description={confirmation.kind === "all" ? "This permanently removes saved videos, favorites and recovery copies from this device. Your preferences stay. This cannot be undone." : `“${confirmation.title}” will be removed, along with its saved place and tracking choice.`}
        confirmLabel={confirmation.kind === "all" ? "Clear saved videos" : "Remove video"} onConfirm={removeConfirmed} onClose={() => setConfirmation(null)} />}
    </div>
  );
}
