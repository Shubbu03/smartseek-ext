import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import type { PopupView } from "../types";

type HeaderProps = {
  currentView: PopupView;
  setup?: boolean;
  onViewChange: (view: PopupView) => void;
};

export default function Header({ currentView, setup = false, onViewChange }: HeaderProps) {
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
        <button className="icon-button" aria-label="Open settings" title="Settings" onClick={() => onViewChange("settings")}><GearSixIcon aria-hidden="true" /></button>
      ) : <span className="brand-mark brand-mark-small" aria-label="SmartSeek"><BookmarkSimpleIcon aria-hidden="true" /></span>}
    </header>
  );
}
