import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings, saveSettings, watchSettings } from "@/settings/storage";
import type { Settings } from "@/settings/types";

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const request = useRef(0);
  const savingRef = useRef(false);

  const reload = useCallback(async () => {
    const current = ++request.current;
    try {
      const value = await getSettings();
      if (current !== request.current) return;
      setSettings(value);
      setError(null);
    } catch (failure) {
      if (current === request.current) setError(failure instanceof Error ? failure.message : "Could not load your preferences.");
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unwatch = watchSettings(() => { void reload(); });
    void reload();
    return () => { unwatch(); request.current++; };
  }, [reload]);

  const update = async (patch: Partial<Settings>): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await saveSettings({ ...await getSettings(), ...patch });
      await reload();
      return true;
    } catch (failure) {
      setSaveError(failure instanceof Error ? failure.message : "Your change could not be saved. Please try again.");
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return { settings, loading, error, saveError, saving, reload, update, dismissSaveError: () => setSaveError(null) };
}
