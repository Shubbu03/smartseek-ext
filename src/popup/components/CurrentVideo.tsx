import { useEffect, useRef, useState } from "react";
import { getSettings, saveSettings, watchSettings } from "@/settings/storage";
import type { PlaybackStatus } from "@/playback/playerControl";
import { activePlayback } from "../playback";

export default function CurrentVideo() {
  const [mode, setMode] = useState<"automatic" | "selected">("automatic");
  const [status, setStatus] = useState<PlaybackStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const loadedRef = useRef(false);
  const request = useRef(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const current = ++request.current;
      try {
        const [settings, player] = await Promise.all([getSettings(), activePlayback("status")]);
        if (active && current === request.current) { setMode(settings.saveMode ?? "automatic"); if (!busyRef.current) setStatus(player); setError(null); }
      } catch (failure) {
        if (active && current === request.current) setError(failure instanceof Error ? failure.message : "Could not load this video.");
      } finally {
        loadedRef.current = true;
        if (active) setLoading(false);
      }
    };
    const unwatch = watchSettings(() => { void load(); });
    const timer = setInterval(() => {
      if (busyRef.current || !loadedRef.current) return;
      const current = ++request.current;
      activePlayback("status").then((player) => {
        if (active && !busyRef.current && current === request.current) {
          setStatus(player);
          if (player?.state !== "error") setError(null);
        }
      }).catch((failure: unknown) => {
        if (active && current === request.current) setError(failure instanceof Error ? failure.message : "Could not reach this video.");
      });
    }, 1000);
    void load();
    return () => { active = false; clearInterval(timer); unwatch(); };
  }, []);

  const changeMode = async (next: "automatic" | "selected") => {
    busyRef.current = true;
    request.current++;
    setBusy(true);
    try {
      await saveSettings({ ...await getSettings(), saveMode: next });
      setMode(next);
      setStatus(await activePlayback("status"));
      setError(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not change saving mode."); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const save = async () => {
    busyRef.current = true;
    request.current++;
    setBusy(true);
    try { setStatus(await activePlayback("save")); setError(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save progress."); }
    finally { busyRef.current = false; setBusy(false); }
  };

  return (
    <div className="mx-4 mt-3 rounded-lg border border-gray-300 bg-white p-3 space-y-2">
      <label className="flex items-center justify-between gap-3 text-xs font-medium">
        Saving mode
        <select value={mode} disabled={busy || loading} onChange={(event) => { void changeMode(event.target.value as "automatic" | "selected"); }}
          className="max-w-[220px] rounded border border-gray-300 p-1.5 text-xs">
          <option value="automatic">Automatic</option>
          <option value="selected">Only videos I choose</option>
        </select>
      </label>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-600" role="status">{loading ? "Checking the current video…" : status?.message ?? "Open a YouTube watch page to save this video."}</p>
        {status?.supported && <button onClick={() => { void save(); }} disabled={busy || !status.canSave}
          className="shrink-0 rounded-md bg-[#2d3133] px-2.5 py-2 text-xs text-white disabled:opacity-50">
          {busy ? "Saving…" : status.state === "error" ? "Retry save" : status.selected ? "Save progress" : "Save this video"}
        </button>}
      </div>
      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}
