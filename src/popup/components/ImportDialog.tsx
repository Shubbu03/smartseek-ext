import { useEffect, useId, useRef, useState } from "react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { FileArrowUpIcon } from "@phosphor-icons/react/dist/csr/FileArrowUp";
import { applyLibraryImport, cancelLibraryImport, previewLibraryImport } from "@/library/data";
import type { ImportMode, ImportPreview, ImportSummary, LibraryBackup } from "@/shared/libraryData";
import SettingToggle from "./SettingToggle";

type ImportDialogProps = { backup: LibraryBackup; fileName: string; onImported: (summary: ImportSummary) => Promise<void>; onClose: () => void };

export default function ImportDialog({ backup, fileName, onImported, onClose }: ImportDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [mode, setMode] = useState<ImportMode>("merge");
  const [includeSettings, setIncludeSettings] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => { dialog.current?.showModal(); cancel.current?.focus(); }, []);
  useEffect(() => {
    let active = true;
    let id: string | undefined;
    setLoading(true);
    setPreview(null);
    setError(null);
    previewLibraryImport(backup, mode, includeSettings).then((next) => {
      id = next.id;
      if (active) setPreview(next);
      else void cancelLibraryImport(next.id).catch(() => undefined);
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : "Could not prepare an import preview.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (id) void cancelLibraryImport(id).catch(() => undefined); };
  }, [backup, mode, includeSettings, refresh]);

  const apply = async () => {
    if (!preview || applyingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    setError(null);
    try { await onImported(await applyLibraryImport(preview.id)); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Import could not finish. Your pending change can be retried."); }
    finally { applyingRef.current = false; setApplying(false); }
  };

  return (
    <dialog ref={dialog} className="confirm-dialog import-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); if (!applyingRef.current) onClose(); }}>
      <div className="dialog-symbol import-symbol"><FileArrowUpIcon aria-hidden="true" /></div>
      <h2 id={titleId}>Bring your library back</h2>
      <p id={descriptionId}>Review this backup before making any changes.</p>
      <div className="import-file"><span title={fileName}>{fileName}</span><span>{backup.videos.length} {backup.videos.length === 1 ? "video" : "videos"}</span></div>
      <fieldset className="import-modes" disabled={applying}>
        <legend>How should we import it?</legend>
        <label className={mode === "merge" ? "is-selected" : ""}><input type="radio" name="import-mode" value="merge" checked={mode === "merge"} onChange={() => setMode("merge")} /><span><strong>Merge libraries</strong><small>Keep newer progress, plus favorites and manually saved videos from both.</small></span></label>
        <label className={mode === "replace" ? "is-selected" : ""}><input type="radio" name="import-mode" value="replace" checked={mode === "replace"} onChange={() => setMode("replace")} /><span><strong>Replace my library</strong><small>Use the backup’s videos and choices. Other saved videos will be removed.</small></span></label>
      </fieldset>
      <SettingToggle id="import-preferences" label="Also import preferences" description="Apply this backup’s saving, resume and auto-delete settings." checked={includeSettings} disabled={applying} onChange={setIncludeSettings} />
      {includeSettings && <p className="import-preferences-note">Saving: {backup.settings.saveMode === "selected" ? "Manual" : "Automatic"}. Auto-delete: {backup.settings.retentionDays ? `${backup.settings.retentionDays} days` : "off"}.</p>}
      <div className="import-preview" aria-busy={loading}>
        {loading ? <p role="status"><CircleNotchIcon className="spin" aria-hidden="true" />Preparing your preview…</p> : preview ? <>
          <div className="import-counts"><div><strong>{preview.added}</strong><span>to add</span></div><div><strong>{preview.updated}</strong><span>to update</span></div><div className={preview.removed ? "error-copy" : ""}><strong>{preview.removed}</strong><span>to remove</span></div></div>
          <p>{preview.total} saved after import · {preview.favorites} favorites · {preview.selected} manually saved</p>
          {!includeSettings && <p>Your current preferences will stay the same.</p>}
        </> : null}
      </div>
      {error && <div className="import-error" role="alert"><p>{error}</p><button className="text-button" disabled={applying} onClick={() => setRefresh((value) => value + 1)}><ArrowClockwiseIcon aria-hidden="true" />Refresh preview</button></div>}
      <div className="dialog-actions">
        <button ref={cancel} className="button button-secondary" disabled={applying} onClick={onClose}>Cancel</button>
        <button className={`button ${mode === "replace" ? "button-danger" : "button-primary"}`} disabled={loading || applying || !preview} onClick={() => { void apply(); }}>
          {applying && <CircleNotchIcon className="spin" aria-hidden="true" />}{applying ? "Importing…" : mode === "replace" ? "Replace library" : "Import videos"}
        </button>
      </div>
    </dialog>
  );
}
