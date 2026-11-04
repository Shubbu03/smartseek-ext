import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import type { PopupView } from "../types";

type HeaderProps = {
  currentView: PopupView;
  setup?: boolean;
  mode: "automatic" | "selected";
  disabled: boolean;
  saving: boolean;
  onViewChange: (view: PopupView) => void;
  onModeChange: (mode: "automatic" | "selected") => void;
};

export default function Header({ currentView, setup = false, mode, disabled, saving, onViewChange, onModeChange }: HeaderProps) {
  const title = { home: "", settings: "Settings", support: "Help & recovery", privacy: "Privacy", "whats-new": "What’s new" }[currentView];
  const backTo = currentView === "settings" ? "home" : "settings";
  return (
    <header className="popup-header">
      {currentView === "home" || setup ? (
        <div className="brand"><span className="brand-mark"><BookmarkSimpleIcon aria-hidden="true" /></span><span>smartseek</span></div>
      ) : (
        <div className="header-back"><button className="icon-button" aria-label={backTo === "home" ? "Back to library" : "Back to settings"} onClick={() => onViewChange(backTo)}><ArrowLeftIcon aria-hidden="true" /></button><span>{title}</span></div>
      )}
      {setup ? null : currentView === "home" ? (
        <div className="header-actions">
          <label className="mode-picker" title="Choose which videos SmartSeek remembers">
            {saving ? <CircleNotchIcon className="spin" aria-hidden="true" /> : <LightningIcon aria-hidden="true" />}
            <select aria-label="Saving mode" value={mode} disabled={disabled || saving}
              onChange={(event) => { if (event.target.value === "automatic" || event.target.value === "selected") onModeChange(event.target.value); }}>
              <option value="automatic">Automatic</option><option value="selected">Only videos I choose</option>
            </select>
            <CaretDownIcon aria-hidden="true" />
          </label>
          <button className="icon-button" aria-label="Open settings" title="Settings" onClick={() => onViewChange("settings")}><GearSixIcon aria-hidden="true" /></button>
        </div>
      ) : <span className="brand-mark brand-mark-small" aria-label="SmartSeek"><BookmarkSimpleIcon aria-hidden="true" /></span>}
    </header>
  );
}
