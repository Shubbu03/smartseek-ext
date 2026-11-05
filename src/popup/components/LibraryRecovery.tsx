import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import RecoveryActions from "./RecoveryActions";

type LibraryRecoveryProps = { message: string; retrying: boolean; onRetry: () => void; onHelp: () => void };
export default function LibraryRecovery({ message, retrying, onRetry, onHelp }: LibraryRecoveryProps) {
  return <main className="popup-content load-error">
    <div className="empty-symbol"><WarningCircleIcon aria-hidden="true" /></div><h1>Couldn’t load SmartSeek</h1><p role="alert">{message}</p>
    <p className="recovery-guidance">Keep SmartSeek installed and avoid clearing extension storage. Retry first; if it keeps failing, export recovery data before troubleshooting.</p>
    <button className="button button-primary" disabled={retrying} onClick={onRetry}><ArrowClockwiseIcon className={retrying ? "spin" : undefined} aria-hidden="true" />{retrying ? "Retrying…" : "Try again"}</button>
    <RecoveryActions /><button className="text-button" onClick={onHelp}>Get recovery help</button>
  </main>;
}
