import { useEffect, useRef, useState } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { exportLibrary } from "@/library/data";
import type { ImportSummary, LibraryBackup } from "@/shared/libraryData";
import { downloadBackup, readBackupFile } from "../backup";
import ImportDialog from "./ImportDialog";

type LibraryDataToolsProps = { disabled: boolean; onImported: (summary: ImportSummary) => Promise<void> };

export default function LibraryDataTools({ disabled, onImported }: LibraryDataToolsProps) {
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(false);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState<"export" | "read" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ backup: LibraryBackup; name: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const saveBackup = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("export"); setError(null); setMessage(null);
    try { downloadBackup(await exportLibrary()); if (alive.current) setMessage("Backup download started."); }
    catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Could not export your library."); }
    finally { busyRef.current = false; if (alive.current) setBusy(null); }
  };
  const chooseBackup = async (file: File) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("read"); setError(null); setMessage(null);
    try { const backup = await readBackupFile(file); if (alive.current) setSelected({ backup, name: file.name }); }
    catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Could not read this backup."); }
    finally { busyRef.current = false; if (alive.current) setBusy(null); }
  };

  return (
    <div className="library-data-tools">
      <div className="backup-actions">
        <button className="button button-secondary" disabled={disabled || !!busy} onClick={() => { void saveBackup(); }}>
          {busy === "export" ? <CircleNotchIcon className="spin" aria-hidden="true" /> : <DownloadSimpleIcon aria-hidden="true" />}{busy === "export" ? "Exporting…" : "Export backup"}
        </button>
        <button className="button button-secondary" disabled={disabled || !!busy} onClick={() => input.current?.click()}>
          {busy === "read" ? <CircleNotchIcon className="spin" aria-hidden="true" /> : <UploadSimpleIcon aria-hidden="true" />}{busy === "read" ? "Reading…" : "Import backup"}
        </button>
      </div>
      <p className="backup-hint">Back up saved places, favorites, choices and preferences as JSON.</p>
      <input ref={input} type="file" className="sr-only" aria-label="Choose a SmartSeek backup file" accept=".json,application/json" tabIndex={-1}
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void chooseBackup(file); }} />
      {error && <p className="error-copy backup-message" role="alert">{error}</p>}
      {message && <p className="backup-message" role="status">{message}</p>}
      {selected && <ImportDialog backup={selected.backup} fileName={selected.name} onImported={onImported} onClose={() => setSelected(null)} />}
    </div>
  );
}
