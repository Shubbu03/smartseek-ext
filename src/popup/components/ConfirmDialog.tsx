import { useEffect, useId, useRef, useState } from "react";
import { FiAlertCircle, FiLoader } from "react-icons/fi";

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

export default function ConfirmDialog({ title, description, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    cancel.current?.focus();
  }, []);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try { await onConfirm(); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Your videos could not be removed. Try again."); }
    finally { setBusy(false); }
  };

  return (
    <dialog ref={dialog} className="confirm-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <div className="dialog-symbol"><FiAlertCircle aria-hidden="true" /></div>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      {error && <p className="error-copy" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button ref={cancel} type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="button button-danger" disabled={busy} onClick={() => { void confirm(); }}>
          {busy && <FiLoader className="spin" aria-hidden="true" />}{busy ? "Removing…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
