import { useEffect, useRef, useState } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { ArrowUUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { deleteAllVideos, deleteVideo, setFavorite, setSelected } from "@/library/storage";
import { useSettings } from "./hooks/useSettings";
import { useVideos } from "./hooks/useVideos";
import { useRemoval } from "./hooks/useRemoval";
import type { ImportSummary } from "@/shared/libraryData";
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
  const [confirmation, setConfirmation] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const preferences = useSettings();
  const library = useVideos();
  const removal = useRemoval();
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
    await deleteAllVideos();
    await library.reload();
    setNotice("Your saved library has been cleared.");
  };
  const undo = async () => {
    try {
      const result = await removal.undo();
      if (!result) return;
      await library.reload();
      setNotice(result.status === "restored" ? "Video restored to your library." : "This video is already saved. Its current progress was kept.");
      setActionError(null);
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : "Could not restore this video. Try again."); }
  };
  const imported = async (summary: ImportSummary) => {
    await Promise.all([library.reload(), preferences.reload()]);
    setNotice(`Import complete. ${summary.total} ${summary.total === 1 ? "video" : "videos"} in your library.`);
  };
  const retry = () => { void library.reload(); void preferences.reload(); };
  const error = library.error || preferences.error;
  const saveError = preferences.saveError || actionError || removal.error;

  return (
    <div className="smartseek-app h-150 w-100">
      <Header currentView={currentView} mode={preferences.settings?.saveMode ?? "automatic"}
        disabled={preferences.loading || !!preferences.error} saving={preferences.saving} onViewChange={setCurrentView}
        onModeChange={(saveMode) => { void preferences.update({ saveMode }); }} />
      {saveError && <div className="notice-banner error-banner" role="alert"><WarningCircleIcon aria-hidden="true" /><p>{saveError}</p>
        <button className="icon-button" aria-label="Dismiss error" onClick={() => { setActionError(null); preferences.dismissSaveError(); removal.dismissError(); }}><XIcon aria-hidden="true" /></button></div>}

      {preferences.loading || library.loading ? <LoadingLibrary /> : error || !preferences.settings ? (
        <main className="popup-content load-error"><div className="empty-symbol"><WarningCircleIcon aria-hidden="true" /></div>
          <h1>Couldn’t load SmartSeek</h1><p role="alert">{error || "Your preferences could not be loaded."}</p>
          <button className="button button-primary" onClick={retry}><ArrowClockwiseIcon aria-hidden="true" />Try again</button></main>
      ) : currentView === "settings" ? (
        <SettingsView settings={preferences.settings} saving={preferences.saving} savedCount={allVideos.length}
          onChange={preferences.update} onClear={() => setConfirmation(true)} onImported={imported} />
      ) : (
        <main className="popup-content" id="main-content">
          <div className="page-heading"><h1>Continue watching</h1></div>
          <CurrentVideo />
          {library.warnings.length > 0 && <details className="migration-notice"><summary>Some saved data needs attention ({library.warnings.length})</summary><ul>{library.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
          <SearchBar searchTerm={searchTerm} sortOrder={sortOrder} onSearchChange={setSearchTerm} onSortChange={setSortOrder} />
          <ViewDropdown viewType={viewType} counts={counts} onViewChange={setViewType} />
          <div className="list-meta"><span>{searchTerm ? `${videos.length} search ${videos.length === 1 ? "result" : "results"}` : `${videos.length} ${videos.length === 1 ? "video" : "videos"} · ${VIEW_LABELS[viewType]}`}</span><span>{SORT_LABELS[sortOrder]}</span></div>
          {videos.length > 0 ? <VideoList videos={videos} pendingIds={pendingIds}
            onDelete={(id) => { void videoAction(id, async () => { await deleteVideo(id); }); }}
            onToggleFavorite={(id) => { void videoAction(id, () => setFavorite(id, !library.videos[id]?.isFavorite)); }}
            onToggleSelection={(id) => { void videoAction(id, () => setSelected(id, !library.videos[id]?.isSelected)); }} />
            : <EmptyState view={viewType} searching={!!searchTerm} selectedMode={preferences.settings.saveMode === "selected"} libraryEmpty={allVideos.length === 0}
              onReset={() => { if (searchTerm) setSearchTerm(""); else setViewType("recent"); }} />}
        </main>
      )}

      <footer className="popup-footer"><span><ShieldCheckIcon aria-hidden="true" />{preferences.saving ? "Saving preferences…" : "Stored on this device"}</span><span>{library.loading ? "Loading library…" : library.error ? "Library unavailable" : `${allVideos.length} saved${counts.favourites > 0 ? ` · ${counts.favourites} ${counts.favourites === 1 ? "favorite" : "favorites"}` : ""}`}</span></footer>
      {removal.receipt ? <div className="toast undo-toast" role="status"><span className="toast-message" title={removal.receipt.title}>Removed “{removal.receipt.title}”</span>
        <button className="undo-button" disabled={removal.busy} onClick={() => { void undo(); }} aria-label={`Undo removal of ${removal.receipt.title}`}>
          {removal.busy ? <CircleNotchIcon className="spin" aria-hidden="true" /> : <ArrowUUpLeftIcon aria-hidden="true" />}{removal.busy ? "Restoring…" : "Undo"}</button>
        <button className="icon-button" aria-label="Dismiss Undo" disabled={removal.busy} onClick={() => { void removal.dismiss(); }}><XIcon aria-hidden="true" /></button>
      </div> : notice && <div className="toast" role="status"><span>{notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><XIcon aria-hidden="true" /></button></div>}
      {confirmation && <ConfirmDialog title="Clear your saved library?"
        description="This permanently removes saved videos, favorites and recovery copies from this device. Your preferences stay. This cannot be undone."
        confirmLabel="Clear saved videos" onConfirm={removeConfirmed} onClose={() => setConfirmation(false)} />}
    </div>
  );
}
