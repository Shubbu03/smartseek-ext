import { useState } from "react";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";

type OnboardingProps = {
  ready: boolean; initialMode: "automatic" | "selected"; savedMode: "automatic" | "selected"; busy: boolean; error: string | null;
  onSave: (mode: "automatic" | "selected") => void; onContinue: () => void;
};
export default function Onboarding({ ready, initialMode, savedMode, busy, error, onSave, onContinue }: OnboardingProps) {
  const [mode, setMode] = useState(initialMode);
  return <main className="popup-content intro-content">
    <div className="intro-symbol">{ready ? <CheckCircleIcon aria-hidden="true" /> : <BookmarkSimpleIcon aria-hidden="true" />}</div>
    <p className="eyebrow">{ready ? "All set" : "Welcome to SmartSeek"}</p>
    <h1>{ready ? "Your next video is a good place to start." : "Keep your place.\nMake it yours."}</h1>
    <p className="intro-description">{ready ? "Open a YouTube video, then use the SmartSeek button below the player or open this popup." : "Pick which videos we remember. You can change this any time in settings."}</p>
    {ready ? <div className="intro-tip"><strong>{savedMode === "selected" ? "Save once, keep watching." : "Watch as usual."}</strong><p>{savedMode === "selected" ? "Click Save progress once per video. Its resume position keeps updating as you watch." : "Progress saves while you watch, and when you pause or leave. You can also click Save progress at any time."}</p><p>Your library stays on this device. Auto-delete starts off.</p></div> : <fieldset className="mode-options" disabled={busy}>
      <legend className="sr-only">Which videos should SmartSeek remember?</legend>
      <label className={mode === "automatic" ? "is-selected" : ""}><input type="radio" name="welcome-mode" value="automatic" checked={mode === "automatic"} onChange={() => setMode("automatic")} /><LightningIcon aria-hidden="true" /><span><strong>Save automatically</strong><small>Remember progress as you watch. Music is excluded unless you enable it or save a video manually.</small></span></label>
      <label className={mode === "selected" ? "is-selected" : ""}><input type="radio" name="welcome-mode" value="selected" checked={mode === "selected"} onChange={() => setMode("selected")} /><BookmarkSimpleIcon aria-hidden="true" /><span><strong>Save manually</strong><small>Click Save progress once per video. We’ll keep its position up to date from there.</small></span></label>
    </fieldset>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <button className="button button-primary intro-continue" disabled={busy} onClick={() => ready ? onContinue() : onSave(mode)}>{busy && <CircleNotchIcon className="spin" aria-hidden="true" />}{busy ? "Saving your choice…" : ready ? "Go to my library" : "Save my choice"}</button>
  </main>;
}
