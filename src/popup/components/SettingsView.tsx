import { FiChevronDown, FiCoffee, FiExternalLink, FiMessageCircle, FiShield, FiTrash2 } from "react-icons/fi";
import { isRetentionDays, RETENTION_DAYS } from "@/settings/types";
import type { Settings } from "@/settings/types";
import { isViewType, VIEW_LABELS } from "../types";
import SettingToggle from "./SettingToggle";

type SettingsViewProps = { settings: Settings; saving: boolean; savedCount: number; onChange: (patch: Partial<Settings>) => Promise<boolean>; onClear: () => void };

export default function SettingsView({ settings, saving, savedCount, onChange, onClear }: SettingsViewProps) {
  const autoDelete = settings.retentionDays !== undefined && settings.retentionDays !== null;
  return (
    <main className="popup-content settings-content" id="main-content">
      <div className="page-heading"><h1>Preferences</h1><p>A few things, just the way you like them.</p></div>
      <section className="settings-section" aria-labelledby="playback-heading">
        <h2 id="playback-heading" className="section-heading">Playback</h2>
        <div className="settings-card">
          <div className="setting-block">
            <label htmlFor="settings-mode">Which videos should we remember?</label><p>Choose once. We’ll keep their progress up to date.</p>
            <div className="setting-select"><select id="settings-mode" disabled={saving} value={settings.saveMode ?? "automatic"}
              onChange={(event) => { if (event.target.value === "automatic" || event.target.value === "selected") void onChange({ saveMode: event.target.value }); }}>
              <option value="automatic">Automatically save videos</option><option value="selected">Only videos I choose</option>
            </select><FiChevronDown aria-hidden="true" /></div>
          </div>
          <SettingToggle id="auto-resume" label="Pick up where I left off" description="Resume a saved video automatically when you return." checked={settings.autoResume ?? true} disabled={saving} onChange={(autoResume) => { void onChange({ autoResume }); }} />
          <SettingToggle id="page-save-button" label="Show the YouTube save button" description="You can always save from the SmartSeek popup, too." checked={settings.showSaveButton ?? true} disabled={saving} onChange={(showSaveButton) => { void onChange({ showSaveButton }); }} />
          <SettingToggle id="include-music" label="Automatically include music" description="Only affects Automatic mode. Music you choose is always saved." checked={settings.saveMusicVideosOnly} disabled={saving} onChange={(saveMusicVideosOnly) => { void onChange({ saveMusicVideosOnly }); }} />
        </div>
      </section>
      <section className="settings-section" aria-labelledby="library-heading">
        <h2 id="library-heading" className="section-heading">Your library</h2>
        <div className="settings-card">
          <div className="setting-block">
            <label htmlFor="default-view">Open SmartSeek to</label>
            <div className="setting-select"><select id="default-view" value={settings.defaultView ?? "recent"} disabled={saving}
              onChange={(event) => { if (isViewType(event.target.value)) void onChange({ defaultView: event.target.value }); }}>
              {Object.entries(VIEW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select><FiChevronDown aria-hidden="true" /></div>
          </div>
          <SettingToggle id="auto-delete" label="Auto-delete old videos" description="Remove saves after a period without watching. Favorites are always kept." checked={autoDelete} disabled={saving}
            onChange={(enabled) => { void onChange({ retentionDays: enabled ? 30 : null }); }} />
          {autoDelete && <div className="retention-options">
            <label htmlFor="retention-days">Delete after</label>
            <div className="setting-select"><select id="retention-days" value={settings.retentionDays ?? 30} disabled={saving}
              onChange={(event) => { const days = Number(event.target.value); if (isRetentionDays(days)) void onChange({ retentionDays: days }); }}>
              {RETENTION_DAYS.map((days) => <option key={days} value={days}>{days} days</option>)}
            </select><FiChevronDown aria-hidden="true" /></div>
            <p>Counted from each video’s last progress update.</p>
          </div>}
        </div>
        <div className="privacy-note"><FiShield aria-hidden="true" /><p>Your library stays on this device. No account required.</p></div>
        <button className="clear-library-button" onClick={onClear} disabled={saving}><FiTrash2 aria-hidden="true" /><span>Clear saved videos</span><span className="muted">{savedCount}</span></button>
      </section>
      <section className="settings-section about-section" aria-labelledby="about-heading">
        <h2 id="about-heading" className="section-heading">A little about SmartSeek</h2>
        <div className="settings-card">
          <a href="https://forms.gle/6JQwnkcHYBHN5Fz9A" target="_blank" rel="noreferrer" className="support-link"><FiMessageCircle aria-hidden="true" /><span>Share feedback or an idea</span><FiExternalLink aria-hidden="true" /></a>
          <a href="https://buymeacoffee.com/shubbu" target="_blank" rel="noreferrer" className="support-link"><FiCoffee aria-hidden="true" /><span>Support SmartSeek</span><FiExternalLink aria-hidden="true" /></a>
        </div>
        <p className="version-label">SmartSeek {chrome.runtime.getManifest().version} <span>·</span> Made for a better pause.</p>
      </section>
    </main>
  );
}
