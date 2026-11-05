import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackStatus } from "@/playback/playerControl";
import { activePlayback } from "../playback";

export function useCurrentVideo() {
  const [status, setStatus] = useState<PlaybackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const request = useRef(0);
  const alive = useRef(false);
  const busy = useRef(false);
  const polling = useRef<number | null>(null);

  const reload = useCallback(async () => {
    if (busy.current || polling.current !== null) return;
    const current = ++request.current;
    polling.current = current;
    try {
      const player = await activePlayback("status");
      if (alive.current && current === request.current) { setStatus(player); setError(null); }
    } catch (failure) {
      if (alive.current && current === request.current) setError(failure instanceof Error ? failure.message : "Could not reach this video.");
    } finally {
      if (polling.current === current) polling.current = null;
      if (alive.current && current === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void reload();
    const timer = setInterval(() => { void reload(); }, 1000);
    return () => { alive.current = false; request.current++; polling.current = null; clearInterval(timer); };
  }, [reload]);

  const save = async () => {
    if (busy.current) return;
    busy.current = true;
    polling.current = null;
    const current = ++request.current;
    setSaving(true);
    setSaveError(null);
    try {
      const player = await activePlayback("save");
      if (alive.current && current === request.current) { setStatus(player); setError(null); }
    } catch (failure) {
      if (alive.current && current === request.current) setSaveError(failure instanceof Error ? failure.message : "Could not save your place. Try again.");
    } finally {
      busy.current = false;
      if (alive.current && current === request.current) setSaving(false);
    }
  };

  return { status, loading, saving, error: saveError ?? error, save, reload };
}
