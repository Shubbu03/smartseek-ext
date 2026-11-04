import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";

export default function PrivacyView() {
  return <main className="popup-content information-content"><div className="page-heading"><h1>Your data, on this device.</h1><p>A clear view of what SmartSeek keeps.</p></div>
    <div className="information-symbol"><ShieldCheckIcon aria-hidden="true" /></div>
    <section className="information-section"><h2>Saved locally</h2><p>Video IDs, titles, positions, durations, favorites, chosen videos and preferences live in this browser profile. This release has no account or device sync.</p></section>
    <section className="information-section"><h2>When you share a report</h2><p>Diagnostics are prepared locally and exclude saved titles, video IDs, URLs and watch history. You can review, copy or download a report. Nothing is sent automatically.</p></section>
    <section className="information-section"><h2>Backups and recovery</h2><p>Backup and recovery files contain your library data. Keep them somewhere private. Recovery copies from an upgrade stay on this device until you clear your saved library.</p></section>
    <section className="information-section"><h2>Outside connections</h2><p>Video thumbnails load from YouTube. Feedback and support links open external websites with their own privacy practices.</p></section>
    <section className="information-section"><h2>Removing your data</h2><p>Remove individual videos or clear the library in Settings. Auto-delete is optional and keeps favorites. Uninstalling SmartSeek can remove its local data, so export a backup first if you want to keep it.</p></section>
  </main>;
}
