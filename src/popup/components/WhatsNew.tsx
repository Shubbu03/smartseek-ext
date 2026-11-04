import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";

type WhatsNewProps = { busy?: boolean; error?: string | null; returning?: boolean; onContinue: () => void };
const improvements = [
  ["Choose what gets saved", "Switch between automatic saving and only the videos you choose."],
  ["A clearer saved library", "Find favorites, chosen videos and completed watches in the new Cobalt layout."],
  ["More control over your data", "Export a backup, review imports, and undo an accidental video removal."],
  ["Make it comfortable", "Follow your system theme or pick Light or Dark, with two list densities."],
];
export default function WhatsNew({ busy = false, error, returning = false, onContinue }: WhatsNewProps) {
  return <main className="popup-content intro-content whats-new">
    <div className="intro-symbol"><SparkleIcon aria-hidden="true" /></div>
    <p className="overline">Welcome to SmartSeek v3</p><h1>A fresh start for your saved places.</h1>
    <p className="intro-description">{returning ? "Your existing saving preferences stay as they are. Here’s what’s new." : "A quieter interface, clearer feedback, and more control over your library."}</p>
    <ul className="improvement-list">{improvements.map(([title, description]) => <li key={title}><CheckCircleIcon aria-hidden="true" /><div><strong>{title}</strong><p>{description}</p></div></li>)}</ul>
    {returning && <p className="intro-footnote">Auto-delete stays off unless you enabled it. Refresh open YouTube tabs after updating.</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <button className="button button-primary intro-continue" disabled={busy} onClick={onContinue}>{busy && <CircleNotchIcon className="spin" aria-hidden="true" />}{busy ? "Opening your library…" : "Continue to my library"}</button>
  </main>;
}
