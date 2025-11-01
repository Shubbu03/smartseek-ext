import { useEffect, useState } from "react";
import { getSettings, saveSettings, Settings } from "../../../lib/settings";

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings>({ saveMusicVideosOnly: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
      setLoading(false);
    });
  }, []);

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

          <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-[#d1d5db] shadow-sm">
            <div className="flex-1 mr-4">
              <h3 className="font-bold text-[#2d3133] mb-1">
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
        </div>
      </div>
    </div>
  );
}
