import { useCallback, useEffect, useRef, useState } from "react";
import { dismissVideoRemoval, getPendingRemoval, undoVideoRemoval, watchRemovals } from "@/library/storage";
import type { RemovalReceipt } from "@/shared/libraryData";

export function useRemoval() {
  const [receipt, setReceipt] = useState<RemovalReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const busyRef = useRef(false);
  const reload = useCallback(async () => {
    const current = ++request.current;
    try {
      const pending = await getPendingRemoval();
      if (current === request.current) { setReceipt(pending); setError(null); }
    } catch (failure) {
      if (current === request.current) setError(failure instanceof Error ? failure.message : "Could not check the last removal.");
    }
  }, []);

  useEffect(() => {
    const unwatch = watchRemovals(() => { void reload(); });
    void reload();
    return () => { unwatch(); request.current++; };
  }, [reload]);
  useEffect(() => {
    if (!receipt) return;
    const timer = setTimeout(() => { setReceipt(null); void reload(); }, Math.max(0, receipt.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [receipt?.id, receipt?.expiresAt, reload]);

  const undo = async () => {
    if (!receipt || busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    try { const result = await undoVideoRemoval(receipt.id); setReceipt(null); await reload(); return result; }
    finally { busyRef.current = false; setBusy(false); }
  };
  const dismiss = async () => {
    if (!receipt || busyRef.current) return;
    try { await dismissVideoRemoval(receipt.id); setReceipt(null); await reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not dismiss this removal."); }
  };
  return { receipt, busy, error, undo, dismiss, dismissError: () => setError(null) };
}
