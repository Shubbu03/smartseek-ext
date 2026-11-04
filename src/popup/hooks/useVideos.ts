import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoProgress } from "@/library/types";
import { getMigrationStatus, getVideos, watchVideos } from "@/library/storage";

export function useVideos() {
  const [videos, setVideos] = useState<Record<string, VideoProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const requestNumber = useRef(0);

  const reload = useCallback(async () => {
    const currentRequest = ++requestNumber.current;
    try {
      const [savedVideos, migration] = await Promise.all([getVideos(), getMigrationStatus()]);
      if (currentRequest !== requestNumber.current) return;
      setVideos(savedVideos);
      setWarnings(migration.warnings);
      setError(null);
    } catch (failure) {
      if (currentRequest !== requestNumber.current) return;
      setError(failure instanceof Error ? failure.message : "Could not load your saved videos.");
    } finally {
      if (currentRequest === requestNumber.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unwatch = watchVideos(() => { void reload(); });
    void reload();
    return () => {
      unwatch();
      requestNumber.current++;
    };
  }, [reload]);

  return { videos, loading, error, warnings, reload };
}
