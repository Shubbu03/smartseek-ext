import { useEffect, useState, useRef } from "react";
import { getSettings, saveSettings, Settings } from "../../../lib/settings";
import { deleteAllVideos } from "../../../lib/storage";
import { VideoViewType } from "../types";
import { FiChevronDown } from "react-icons/fi";

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings>({ saveMusicVideosOnly: false });
  const [loading, setLoading] = useState(true);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
      setLoading(false);
    });
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

  const handleToggle = async (key: keyof Settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    try {
      await saveSettings(newSettings);
    } catch (error) {
      console.error("[SmartSeek] Error saving settings:", error);
      setSettings(settings);
    }
  };

  const handleDefaultViewChange = async (view: VideoViewType) => {
    const newSettings = { ...settings, defaultView: view };
    setSettings(newSettings);
    setIsViewDropdownOpen(false);
    try {
      await saveSettings(newSettings);
    } catch (error) {
      console.error("[SmartSeek] Error saving settings:", error);
      setSettings(settings);
    }
  };

  const getViewLabel = (view?: VideoViewType): string => {
    switch (view) {
      case "music":
        return "Music Videos";
      case "favourites":
        return "Favourites";
      default:
        return "Recent Saves";
    }
  };

  const viewOptions: { value: VideoViewType; label: string }[] = [
    { value: "recent", label: "Recent Saves" },
    { value: "music", label: "Music Videos" },
    { value: "favourites", label: "Favourites" },
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

          <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-[#d1d5db] shadow-sm mb-4">
            <div className="flex-1 mr-4">
              <h3 className="font-medium text-[#2d3133] mb-1">
                Save Music Videos
              </h3>
              <p className="text-sm text-gray-500">
                When enabled, music videos will also be saved.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={settings.saveMusicVideosOnly}
                onChange={() => handleToggle("saveMusicVideosOnly")}
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
              onClick={handleDeleteAll}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-sm"
            >
              Delete All Videos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
