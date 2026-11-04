import { useEffect, useState, useRef } from "react";
import { getSettings, saveSettings, type Settings } from "@/settings/storage";
import { deleteAllVideos } from "@/library/storage";
import type { VideoViewType } from "../types";
import { FiChevronDown, FiExternalLink, FiCoffee } from "react-icons/fi";

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings>({ saveMusicVideosOnly: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    getSettings().then((loadedSettings) => {
      if (active) setSettings(loadedSettings);
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : "Could not load settings.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    };

    if (isViewDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isViewDropdownOpen]);

  const persist = async (newSettings: Settings) => {
    setSaving(true);
    try {
      await saveSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error("[SmartSeek] Error saving settings:", error);
      setError(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = () => persist({ ...settings, saveMusicVideosOnly: !settings.saveMusicVideosOnly });

  const handleDefaultViewChange = async (view: VideoViewType) => {
    setIsViewDropdownOpen(false);
    await persist({ ...settings, defaultView: view });
  };

  const getViewLabel = (view?: VideoViewType): string => {
    switch (view) {
      case "music":
        return "Music Videos";
      case "favourites":
        return "Favourites";
      case "selected":
        return "Chosen Videos";
      case "completed":
        return "Completed";
      default:
        return "Recent Saves";
    }
  };

  const viewOptions: { value: VideoViewType; label: string }[] = [
    { value: "recent", label: "Recent Saves" },
    { value: "music", label: "Music Videos" },
    { value: "favourites", label: "Favourites" },
    { value: "selected", label: "Chosen Videos" },
    { value: "completed", label: "Completed" },
  ];

  const handleDeleteAll = async () => {
    const confirmed = window.confirm(
      "⚠️ WARNING: This will permanently delete ALL saved videos (including favorites and music videos).\n\nThis action cannot be undone!\n\nAre you sure you want to delete all videos?"
    );

    if (confirmed) {
      try {
        await deleteAllVideos();
        alert("All videos have been deleted successfully.");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("Extension context invalidated")) {
          alert("Extension was reloaded. Please refresh the extension and try again.");
          return;
        }
        console.error("[SmartSeek] Error deleting all videos:", error);
        alert("An error occurred while deleting videos. Please try again.");
      }
    }
  };

  if (error) {
    return <p className="flex-1 p-4 text-sm" role="alert">{error} Close settings and try again.</p>;
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#2d3133] mb-4">Preferences</h2>

          <fieldset disabled={saving} className="mb-4 space-y-4 rounded-lg border border-[#d1d5db] bg-white p-4 text-sm shadow-sm">
            <legend className="px-1 font-medium">Playback and saving</legend>
            <label className="block space-y-1">
              <span>Save videos</span>
              <select value={settings.saveMode ?? "automatic"} className="w-full rounded border border-gray-300 p-2"
                onChange={(event) => { void persist({ ...settings, saveMode: event.target.value as "automatic" | "selected" }); }}>
                <option value="automatic">Automatically save eligible videos</option>
                <option value="selected">Only videos I choose</option>
              </select>
            </label>
            <p className="text-xs text-gray-500">Choosing a video saves its current position and keeps updating it as you watch.</p>
            <label className="flex items-center justify-between gap-3">
              Resume saved videos automatically
              <input type="checkbox" checked={settings.autoResume ?? true}
                onChange={(event) => { void persist({ ...settings, autoResume: event.target.checked }); }} />
            </label>
            <label className="flex items-center justify-between gap-3">
              Show the save button on YouTube
              <input type="checkbox" checked={settings.showSaveButton ?? true}
                onChange={(event) => { void persist({ ...settings, showSaveButton: event.target.checked }); }} />
            </label>
            <label className="block space-y-1">
              <span>Keep ordinary saves</span>
              <select value={settings.retentionDays === null ? "forever" : "45"} className="w-full rounded border border-gray-300 p-2"
                onChange={(event) => { void persist({ ...settings, retentionDays: event.target.value === "forever" ? null : 45 }); }}>
                <option value="45">For 45 days without an update</option>
                <option value="forever">Until I delete them</option>
              </select>
            </label>
            <p className="text-xs text-gray-500">Favorites are always kept until you remove them.</p>
          </fieldset>

          <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-[#d1d5db] shadow-sm mb-4">
            <div className="flex-1 mr-4">
              <h3 className="font-medium text-[#2d3133] mb-1">
                Automatically Include Music
              </h3>
              <p className="text-sm text-gray-500">
                Include detected music in Automatic mode. Videos you choose are saved regardless.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={settings.saveMusicVideosOnly}
                disabled={saving}
                aria-label="Automatically include music videos"
                onChange={() => { void handleToggle(); }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#2d3133] peer-focus:ring-opacity-20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d3133]"></div>
            </label>
          </div>

          <div className="p-4 bg-white rounded-lg border border-[#d1d5db] shadow-sm">
            <h3 className="font-medium text-[#2d3133] mb-3">
              Default View
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Choose which view to show when opening the extension
            </p>
            <div className="relative" ref={viewDropdownRef}>
              <button
                disabled={saving}
                onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:border-[#2d3133] transition-colors text-[#2d3133]"
              >
                <span>{getViewLabel(settings.defaultView)}</span>
                <FiChevronDown
                  size={16}
                  className={`text-[#2d3133] transition-transform ${isViewDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isViewDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  {viewOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleDefaultViewChange(option.value)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${(settings.defaultView === option.value) ||
                        (!settings.defaultView && option.value === "recent")
                        ? "bg-[#2d3133] text-[#f4f2ee]"
                        : "text-[#2d3133] hover:bg-gray-100"
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#d1d5db]">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2">⚠️ Danger Zone</h3>
            <p className="text-sm text-red-700 mb-4">
              This action will permanently delete <strong>ALL</strong> saved videos including favorites and music videos. This cannot be undone.
            </p>
            <button
              disabled={saving}
              onClick={handleDeleteAll}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-sm"
            >
              Delete All Videos
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[#d1d5db]">
          <div className="space-y-3">
            <a
              href="https://forms.gle/6JQwnkcHYBHN5Fz9A"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#d1d5db] shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-2">
                <FiExternalLink size={18} className="text-gray-500 group-hover:text-[#2d3133] transition-colors" />
                <span className="text-sm text-[#2d3133]">Request a Feature</span>
              </div>
              <FiExternalLink size={14} className="text-gray-400" />
            </a>

            <a
              href="https://buymeacoffee.com/shubbu"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#d1d5db] shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-2">
                <FiCoffee size={18} className="text-yellow-500 group-hover:text-yellow-600 transition-colors" />
                <span className="text-sm text-[#2d3133]">Support SmartSeek</span>
              </div>
              <span className="text-xs text-gray-400">☕</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
