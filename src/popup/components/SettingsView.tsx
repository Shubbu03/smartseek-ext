import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CoffeeIcon } from "@phosphor-icons/react/dist/csr/Coffee";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { LifebuoyIcon } from "@phosphor-icons/react/dist/csr/Lifebuoy";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { isDensity, isRetentionDays, isTheme, RETENTION_DAYS } from "@/settings/types";
import type { Settings } from "@/settings/types";
import { isViewType, VIEW_LABELS } from "../types";
import SettingToggle from "./SettingToggle";
import LibraryDataTools from "./LibraryDataTools";
import type { ImportSummary } from "@/shared/libraryData";
import type { PopupView } from "../types";

type SettingsViewProps = { settings: Settings; saving: boolean; savedCount: number; onChange: (patch: Partial<Settings>) => Promise<boolean>; onClear: () => void; onImported: (summary: ImportSummary) => Promise<void>; onNavigate: (view: PopupView) => void };

export default function SettingsView({ settings, saving, savedCount, onChange, onClear, onImported, onNavigate }: SettingsViewProps) {
  const autoDelete = settings.retentionDays !== undefined && settings.retentionDays !== null;
  return (
    <main className="popup-content settings-content" id="main-content">
      <div className="page-heading"><h1>Preferences</h1><p>A few things, just the way you like them.</p></div>
      <section className="settings-section" aria-labelledby="playback-heading">
        <h2 id="playback-heading" className="section-heading">Playback</h2>
        <div className="settings-card">
          <div className="setting-block">
            <label htmlFor="settings-mode">Which videos should we remember?</label><p>In manual mode, click Save progress once for each video you want to track.</p>
            <div className="setting-select"><select id="settings-mode" disabled={saving} value={settings.saveMode ?? "automatic"}
              onChange={(event) => { if (event.target.value === "automatic" || event.target.value === "selected") void onChange({ saveMode: event.target.value }); }}>
              <option value="automatic">Automatic saving</option><option value="selected">Manual saving</option>
            </select><CaretDownIcon aria-hidden="true" /></div>
          </div>
          <SettingToggle id="auto-resume" label="Pick up where I left off" description="Resume a saved video automatically when you return." checked={settings.autoResume ?? true} disabled={saving} onChange={(autoResume) => { void onChange({ autoResume }); }} />
          <SettingToggle id="page-save-button" label="Show the YouTube save button" description="You can always save from the SmartSeek popup, too." checked={settings.showSaveButton ?? true} disabled={saving} onChange={(showSaveButton) => { void onChange({ showSaveButton }); }} />
          <SettingToggle id="include-music" label="Automatically include music" description="Only affects automatic mode. Music you save manually is always tracked." checked={settings.saveMusicVideosOnly} disabled={saving} onChange={(saveMusicVideosOnly) => { void onChange({ saveMusicVideosOnly }); }} />
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
            </select><CaretDownIcon aria-hidden="true" /></div>
          </div>
          <SettingToggle id="auto-delete" label="Auto-delete old videos" description="Remove saves after a period without watching. Favorites are always kept." checked={autoDelete} disabled={saving}
            onChange={(enabled) => { void onChange({ retentionDays: enabled ? 30 : null }); }} />
          {autoDelete && <div className="retention-options">
            <label htmlFor="retention-days">Delete after</label>
            <div className="setting-select"><select id="retention-days" value={settings.retentionDays ?? 30} disabled={saving}
              onChange={(event) => { const days = Number(event.target.value); if (isRetentionDays(days)) void onChange({ retentionDays: days }); }}>
              {RETENTION_DAYS.map((days) => <option key={days} value={days}>{days} days</option>)}
            </select><CaretDownIcon aria-hidden="true" /></div>
            <p>Counted from each video’s last progress update.</p>
          </div>}
        </div>
        <div className="privacy-note"><ShieldCheckIcon aria-hidden="true" /><p>Your library stays on this device. No account required.</p></div>
        <LibraryDataTools disabled={saving} onImported={onImported} />
        <button className="clear-library-button" onClick={onClear} disabled={saving}><TrashIcon aria-hidden="true" /><span>Clear saved videos</span><span className="muted">{savedCount}</span></button>
      </section>
      <section className="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="section-heading">Appearance</h2>
        <div className="settings-card">
          <div className="setting-block"><label htmlFor="theme">Theme</label><p>Use a light or dark theme, or follow your device.</p>
            <div className="setting-select"><select id="theme" disabled={saving} value={settings.theme ?? "system"} onChange={(event) => { if (isTheme(event.target.value)) void onChange({ theme: event.target.value }); }}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select><CaretDownIcon aria-hidden="true" /></div>
          </div>
          <div className="setting-block"><label htmlFor="density">Video list density</label><p>Choose a little more room or a little more library.</p>
            <div className="setting-select"><select id="density" disabled={saving} value={settings.density ?? "comfortable"} onChange={(event) => { if (isDensity(event.target.value)) void onChange({ density: event.target.value }); }}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select><CaretDownIcon aria-hidden="true" /></div>
          </div>
        </div>
      </section>
      <section className="settings-section about-section" aria-labelledby="about-heading">
        <h2 id="about-heading" className="section-heading">A little about SmartSeek</h2>
        <div className="settings-card">
          <button className="support-link settings-navigation" onClick={() => onNavigate("support")}><LifebuoyIcon aria-hidden="true" /><span>Help, report an issue & recovery</span><CaretRightIcon aria-hidden="true" /></button>
          <button className="support-link settings-navigation" onClick={() => onNavigate("whats-new")}><SparkleIcon aria-hidden="true" /><span>What’s new in v3</span><CaretRightIcon aria-hidden="true" /></button>
          <button className="support-link settings-navigation" onClick={() => onNavigate("privacy")}><ShieldCheckIcon aria-hidden="true" /><span>Your data & privacy</span><CaretRightIcon aria-hidden="true" /></button>
          <a href="https://forms.gle/6JQwnkcHYBHN5Fz9A" target="_blank" rel="noreferrer" className="support-link"><ChatCircleIcon aria-hidden="true" /><span>Share feedback or an idea</span><ArrowSquareOutIcon aria-hidden="true" /></a>
          <a href="https://buymeacoffee.com/shubbu" target="_blank" rel="noreferrer" className="support-link"><CoffeeIcon aria-hidden="true" /><span>Support SmartSeek</span><ArrowSquareOutIcon aria-hidden="true" /></a>
        </div>
        <p className="version-label">SmartSeek {chrome.runtime.getManifest().version} <span>·</span> Made for a better pause.</p>
      </section>
    </main>
  );
}
