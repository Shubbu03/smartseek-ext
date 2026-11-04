import { useRef, useState } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { requestLibrary } from "@/shared/libraryProtocol";
import { downloadFile } from "../download";

export default function RecoveryActions() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const working = useRef(false);
  const save = async () => {
    if (working.current) return;
    working.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const snapshot = await requestLibrary({ type: "recovery.export" });
      downloadFile(JSON.stringify(snapshot), `smartseek-recovery-${new Date().toISOString().slice(0, 10)}.json`);
      setMessage("Recovery download started. Keep this file private.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not read recovery data. Keep SmartSeek installed and try again."); }
    finally { working.current = false; setBusy(false); }
  };
  return <div className="recovery-actions">
    <p>This file includes saved video IDs, titles, progress and any recovery copies. It is for recovery help and cannot be imported as a normal backup.</p>
    <button className="button button-secondary" disabled={busy} onClick={() => { void save(); }}>{busy ? <CircleNotchIcon className="spin" aria-hidden="true" /> : <DownloadSimpleIcon aria-hidden="true" />}{busy ? "Preparing recovery data…" : "Export recovery data"}</button>
    {error && <p className="inline-error" role="alert">{error}</p>}{message && <p className="inline-success" role="status">{message}</p>}
  </div>;
}
