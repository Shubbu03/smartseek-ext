const SETTINGS_KEY = "smartseek_settings";

export type Settings = {
    saveMusicVideosOnly: boolean;
};

const DEFAULT_SETTINGS: Settings = {
    saveMusicVideosOnly: false,
};

export async function getSettings(): Promise<Settings> {
    try {
        const data = await chrome.storage.local.get(SETTINGS_KEY);
        return data[SETTINGS_KEY] || DEFAULT_SETTINGS;
    } catch (error) {
        console.error("[SmartSeek] Error loading settings:", error);
        return DEFAULT_SETTINGS;
    }
}

export async function saveSettings(settings: Settings): Promise<void> {
    try {
        await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    } catch (error) {
        console.error("[SmartSeek] Error saving settings:", error);
        throw error;
    }
}

