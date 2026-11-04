import { useEffect, useRef, useState } from "react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { prepareSupportReport } from "../supportReport";
import type { IssueDetails } from "../supportReport";
import { downloadFile } from "../download";
import RecoveryActions from "./RecoveryActions";

export default function SupportView() {
  const [issue, setIssue] = useState<IssueDetails>({ doing: "", expected: "", happened: "" });
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState<"prepare" | "copy" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const working = useRef(false);
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const prepare = async () => {
    if (working.current) return;
    working.current = true; setBusy("prepare"); setError(null); setMessage(null); setReport(null);
    try { const value = await prepareSupportReport(issue); if (alive.current) setReport(value); }
    catch { if (alive.current) setError("Could not prepare diagnostics. Try again, or export recovery data below if your library will not load."); }
    finally { working.current = false; if (alive.current) setBusy(null); }
  };
  const copy = async () => {
    if (!report || working.current) return;
    working.current = true; setBusy("copy"); setError(null); setMessage(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(report);
      if (alive.current) setMessage("Report copied. You can paste it into your feedback.");
    } catch { if (alive.current) setError("Could not copy the report. Download it or select the text below to copy it manually."); }
    finally { working.current = false; if (alive.current) setBusy(null); }
  };
  const update = (key: keyof IssueDetails, value: string) => { setIssue((previous) => ({ ...previous, [key]: value })); setReport(null); setMessage(null); };
  return <main className="popup-content support-content">
    <div className="page-heading"><h1>Let’s get you unstuck.</h1><p>A few checks, then a report you can review.</p></div>
    <section className="help-card" aria-labelledby="quick-help"><h2 id="quick-help">Try these first</h2>
      <ul><li>After an update or reload, refresh open YouTube tabs.</li><li>In “Only videos I choose”, save each video once to start tracking it.</li><li>Regular YouTube watch pages are supported. Shorts, live streams and YouTube Music are not supported in this release.</li></ul>
      <p>Automatic saves happen about every 5 seconds while playing, plus pause and page-exit events when available. “Pick up where I left off” controls automatic resume.</p>
    </section>
    <section className="settings-section" aria-labelledby="report-heading"><h2 id="report-heading" className="section-heading">Prepare an issue report</h2>
      <p className="support-description">Includes version, preferences, storage health and player state. Saved titles, video IDs, URLs and watch history are excluded. Nothing is sent automatically.</p>
      <form className="report-form" onSubmit={(event) => { event.preventDefault(); void prepare(); }}>
        <label htmlFor="issue-doing">What were you doing?<textarea id="issue-doing" maxLength={2000} rows={2} value={issue.doing} disabled={!!busy} onChange={(event) => update("doing", event.target.value)} placeholder="For example, switching to the next video in a playlist" /></label>
        <label htmlFor="issue-expected">What did you expect?<textarea id="issue-expected" maxLength={2000} rows={2} value={issue.expected} disabled={!!busy} onChange={(event) => update("expected", event.target.value)} /></label>
        <label htmlFor="issue-happened">What happened instead?<textarea id="issue-happened" maxLength={2000} rows={2} value={issue.happened} disabled={!!busy} onChange={(event) => update("happened", event.target.value)} /></label>
        <p className="field-hint">Avoid private information in your description. Review the report before sharing.</p>
        <button type="submit" className="button button-primary" disabled={!!busy}>{busy === "prepare" && <CircleNotchIcon className="spin" aria-hidden="true" />}{busy === "prepare" ? "Preparing report…" : report ? "Refresh diagnostics" : "Prepare report"}</button>
      </form>
      {report && <div className="prepared-report"><label htmlFor="support-report">Review your report</label><textarea id="support-report" rows={9} readOnly value={report} spellCheck={false} />
        <div className="backup-actions"><button className="button button-secondary" disabled={!!busy} onClick={() => { void copy(); }}><CopyIcon aria-hidden="true" />{busy === "copy" ? "Copying…" : "Copy report"}</button>
          <button className="button button-secondary" disabled={!!busy} onClick={() => { downloadFile(report, `smartseek-report-${new Date().toISOString().slice(0, 10)}.json`); setMessage("Report download started."); }}><DownloadSimpleIcon aria-hidden="true" />Download report</button></div>
        <a className="support-link" href="https://forms.gle/6JQwnkcHYBHN5Fz9A" target="_blank" rel="noreferrer"><span>Open feedback form</span><ArrowSquareOutIcon aria-hidden="true" /></a>
      </div>}
      {error && <p className="inline-error" role="alert">{error}</p>}{message && <p className="inline-success" role="status">{message}</p>}
    </section>
    <section className="settings-section recovery-section" aria-labelledby="recovery-heading"><h2 id="recovery-heading" className="section-heading">Library recovery</h2>
      <p className="support-description">If an upgrade or library change keeps failing, keep SmartSeek installed. Avoid clearing its storage. Retry loading, then preserve a recovery file before asking for help.</p>
      <RecoveryActions />
    </section>
  </main>;
}
