import { useCallback, useEffect, useRef, useState } from "react";
import { requestLibrary } from "@/shared/libraryProtocol";
import { STORAGE_KEYS } from "@/library/keys";
import type { Experience } from "@/shared/experienceTypes";

export function useExperience() {
  const [experience, setExperience] = useState<Experience | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const request = useRef(0);
  const busy = useRef(false);
  const reload = useCallback(async () => {
    const current = ++request.current;
    try {
      const value = await requestLibrary({ type: "experience.get" });
      if (current === request.current) { setExperience(value); setError(null); }
    } catch (failure) { if (current === request.current) setError(failure instanceof Error ? failure.message : "Could not prepare SmartSeek."); }
    finally { if (current === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes[STORAGE_KEYS.experience]) void reload();
    };
    chrome.storage.onChanged.addListener(listener);
    void reload();
    return () => { request.current++; chrome.storage.onChanged.removeListener(listener); };
  }, [reload]);
  const complete = async (saveMode?: "automatic" | "selected") => {
    if (busy.current) return false;
    busy.current = true; setSaving(true); setSaveError(null);
    try {
      const value = await requestLibrary({ type: "experience.complete", saveMode });
      setExperience(value); return true;
    } catch (failure) { setSaveError(failure instanceof Error ? failure.message : "Your setup could not be saved. Try again."); return false; }
    finally { busy.current = false; setSaving(false); }
  };
  return { experience, loading, error, saveError, saving, reload, complete };
}
