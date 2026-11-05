import { useEffect, useRef, useState } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { ArrowUUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { deleteAllVideos, deleteVideo, setFavorite, setSelected } from "@/library/storage";
import { useSettings } from "./hooks/useSettings";
import { useVideos } from "./hooks/useVideos";
import { useRemoval } from "./hooks/useRemoval";
import { useExperience } from "./hooks/useExperience";
import { useAppearance } from "./hooks/useAppearance";
import type { ImportSummary } from "@/shared/libraryData";
import { useVideoFiltering } from "./hooks/useVideoFiltering";
import type { PopupView, SortOption, VideoViewType } from "./types";
import Header from "./components/Header";
import SettingsView from "./components/SettingsView";
import SearchBar from "./components/SearchBar";
import ViewDropdown from "./components/ViewDropdown";
import VideoList from "./components/VideoList";
import CurrentVideo from "./components/CurrentVideo";
import EmptyState from "./components/EmptyState";
import ConfirmDialog from "./components/ConfirmDialog";
import Onboarding from "./components/Onboarding";
import WhatsNew from "./components/WhatsNew";
import LibraryRecovery from "./components/LibraryRecovery";
import SupportView from "./components/SupportView";
import PrivacyView from "./components/PrivacyView";

function LoadingLibrary() {
  return <main className="popup-content library-loading" aria-busy="true" aria-label="Loading your saved library">
    <p className="preparing-copy" role="status">Preparing your library and checking saved data…</p>
    <div className="skeleton skeleton-heading" />
    {[0, 1, 2].map((key) => <div key={key} className="skeleton-row" aria-hidden="true"><div className="skeleton skeleton-thumb" /><div><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /></div></div>)}
  </main>;
}

export default function App() {
  const [currentView, setCurrentView] = useState<PopupView>("home");
  const [setupReady, setSetupReady] = useState(false);
  const [setupMode, setSetupMode] = useState<"automatic" | "selected" | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const [sortOrder, setSortOrder] = useState<SortOption>("default");
  const [viewType, setViewType] = useState<VideoViewType>("recent");
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const pendingRef = useRef(new Set<string>());
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const retryingRef = useRef(false);
  const preferences = useSettings();
  const library = useVideos();
  const removal = useRemoval();
  const experience = useExperience();
  useAppearance(preferences.settings);
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
  const retry = async () => {
    if (retryingRef.current) return;
    retryingRef.current = true; setRetrying(true);
    try { await Promise.all([library.reload(), preferences.reload(), experience.reload()]); }
    finally { retryingRef.current = false; setRetrying(false); }
  };
  const error = library.error || preferences.error || experience.error;
  const saveError = preferences.saveError || actionError || removal.error;
  const onboarding = experience.experience?.step === "welcome" || setupReady || (experience.saving && setupMode !== null);
  const upgrading = experience.experience?.step === "upgrade";
  const utilityView = currentView === "support" || currentView === "privacy" || currentView === "whats-new";
  const setup = !error && (onboarding || upgrading) && !utilityView;
  const loading = preferences.loading || library.loading || experience.loading;
  const focusKey = utilityView ? currentView : loading ? "loading" : error ? "error" : onboarding ? setupReady ? "setup-ready" : "welcome" : upgrading ? "upgrade" : currentView;
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>("main h1");
    if (heading) { heading.tabIndex = -1; heading.focus(); }
  }, [focusKey]);
  const finishSetup = async (mode: "automatic" | "selected") => {
    setSetupMode(mode);
    if (await experience.complete(mode)) { setSetupReady(true); await preferences.reload(); }
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchTerm("");
    setSortOrder("default");
    searchToggle.current?.focus();
  };

  function renderContent() {
    if (currentView === "support") return <SupportView />;
    if (currentView === "privacy") return <PrivacyView />;
    if (currentView === "whats-new") return <WhatsNew onContinue={() => setCurrentView("home")} />;
    if (loading) return <LoadingLibrary />;
    if (error || !preferences.settings) return <LibraryRecovery message={error || "Your preferences could not be loaded."} retrying={retrying} onRetry={() => { void retry(); }} onHelp={() => setCurrentView("support")} />;
    if (onboarding) return <Onboarding ready={setupReady} initialMode={preferences.settings.saveMode ?? "automatic"} savedMode={setupMode ?? "automatic"} busy={experience.saving} error={experience.saveError} onSave={(mode) => { void finishSetup(mode); }} onContinue={() => setSetupReady(false)} />;
    if (upgrading) return <WhatsNew returning busy={experience.saving} error={experience.saveError} onContinue={() => { void experience.complete(); }} />;
    if (currentView === "settings") return <SettingsView settings={preferences.settings} saving={preferences.saving} savedCount={allVideos.length}
      onChange={preferences.update} onClear={() => setConfirmation(true)} onImported={imported} onNavigate={setCurrentView} />;
    return <main className="popup-content" id="main-content">
          <div className="library-heading">
            <ViewDropdown viewType={viewType} counts={counts} onViewChange={setViewType} />
            <CurrentVideo />
            <button ref={searchToggle} className={`icon-button${searchOpen ? " is-active" : ""}`} aria-label={searchOpen ? "Close search and sorting" : "Search and sort videos"}
              title={searchOpen ? "Close search" : "Search and sort"} aria-expanded={searchOpen} aria-controls="library-search"
              onClick={() => { if (searchOpen) closeSearch(); else setSearchOpen(true); }}>{searchOpen ? <XIcon aria-hidden="true" /> : <MagnifyingGlassIcon aria-hidden="true" />}</button>
          </div>
          {library.warnings.length > 0 && <details className="migration-notice"><summary>Some saved data needs attention ({library.warnings.length})</summary><p>Valid saves are available below. Original upgrade data is kept for recovery.</p><ul>{library.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul><button className="text-button" onClick={() => setCurrentView("support")}>Get recovery help</button></details>}
          {searchOpen && <div onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }}>
            <SearchBar searchTerm={searchTerm} sortOrder={sortOrder} onSearchChange={setSearchTerm} onSortChange={setSortOrder} />
            {searchTerm && <p className="search-results" role="status">{videos.length} {videos.length === 1 ? "match" : "matches"}</p>}
          </div>}
          {videos.length > 0 ? <VideoList videos={videos} pendingIds={pendingIds}
            onDelete={(id) => { void videoAction(id, async () => { await deleteVideo(id); }); }}
            onToggleFavorite={(id) => { void videoAction(id, () => setFavorite(id, !library.videos[id]?.isFavorite)); }}
            onToggleSelection={(id) => { void videoAction(id, async () => {
              const selected = !library.videos[id]?.isSelected;
              await setSelected(id, selected);
              setNotice(selected ? "Saved for manual mode." : "Stopped saving in manual mode.");
            }); }} />
            : <EmptyState view={viewType} searching={!!searchTerm} selectedMode={preferences.settings.saveMode === "selected"} libraryEmpty={allVideos.length === 0}
              onReset={() => { if (searchTerm) setSearchTerm(""); else setViewType("recent"); }} />}
        </main>;
  }

  return (
    <div className="smartseek-app h-150 w-100">
      <Header currentView={currentView} setup={setup} onViewChange={setCurrentView} />
      {saveError && <div className="notice-banner error-banner" role="alert"><WarningCircleIcon aria-hidden="true" /><p>{saveError}</p>
        <button className="icon-button" aria-label="Dismiss error" onClick={() => { setActionError(null); preferences.dismissSaveError(); removal.dismissError(); }}><XIcon aria-hidden="true" /></button></div>}
      {renderContent()}

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
