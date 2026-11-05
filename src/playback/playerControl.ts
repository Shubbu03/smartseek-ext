import type { BrowserWindow } from "@/youtube/player";
import bookmarkSvg from "@phosphor-icons/core/assets/regular/bookmark-simple.svg?raw";
import chosenSvg from "@phosphor-icons/core/assets/fill/bookmark-simple-fill.svg?raw";
import checkSvg from "@phosphor-icons/core/assets/regular/check-circle.svg?raw";
import warningSvg from "@phosphor-icons/core/assets/regular/warning-circle.svg?raw";
import savingSvg from "@phosphor-icons/core/assets/regular/circle-notch.svg?raw";

const CONTROL_ID = "smartseek-manual-save-button";
const STYLE_ID = "smartseek-save-control-style";
const CONTROL_STYLES = `
#${CONTROL_ID}{display:inline-flex;align-items:center;justify-content:center;gap:7px;flex-shrink:0;height:36px;border:0;border-radius:999px;padding:0 14px;margin:0 8px 0 0;background:#f2f2f2;color:#0f0f0f;font:500 14px/1 Roboto,Arial,sans-serif;cursor:pointer;white-space:nowrap;outline:none;transition:background-color 140ms,color 140ms}
#${CONTROL_ID}:hover{background:#e5e5e5}#${CONTROL_ID}:focus,#${CONTROL_ID}:focus-visible{outline:none;box-shadow:none}
#${CONTROL_ID}[data-state="saved"]{background:#e8efff;color:#3155b8}#${CONTROL_ID}[data-state="error"]{background:#ffebee;color:#a12c42}
#${CONTROL_ID}:disabled{cursor:default;opacity:.65}#${CONTROL_ID}[data-state="saving"]{opacity:1;cursor:progress}
#${CONTROL_ID}[hidden]{display:none}#${CONTROL_ID} svg{display:block;width:18px;height:18px;flex-shrink:0}
#${CONTROL_ID}[data-state="saving"] svg{animation:smartseek-save-spin .8s linear infinite}
html[dark] #${CONTROL_ID}{background:#272727;color:#f1f1f1}html[dark] #${CONTROL_ID}:hover{background:#3f3f3f}
html[dark] #${CONTROL_ID}[data-state="saved"]{background:#24375a;color:#b4c7ff}html[dark] #${CONTROL_ID}[data-state="error"]{background:#44252d;color:#ffb6c3}
@keyframes smartseek-save-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){#${CONTROL_ID}{transition:none}#${CONTROL_ID} svg{animation:none!important}}
`;

export type PlaybackStatus = {
  supported: boolean;
  videoId: string | null;
  title: string;
  state: "waiting" | "ready" | "saving" | "saved" | "not-tracking" | "removed" | "another-tab" | "error";
  selected: boolean;
  canSave: boolean;
  position: number | null;
  message: string;
};

export function createPlayerControl(host: BrowserWindow, save: () => Promise<PlaybackStatus>) {
  const styles = host.document.createElement("style");
  styles.id = STYLE_ID;
  styles.textContent = CONTROL_STYLES;
  host.document.getElementById(STYLE_ID)?.remove();
  (host.document.head || host.document.documentElement).append(styles);
  const button = host.document.createElement("button");
  button.id = CONTROL_ID;
  button.type = "button";
  button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); void saveFromControl(); });
  const text = host.document.createElement("span");
  text.setAttribute("aria-live", "polite");
  const iconSlot = host.document.createElement("span");
  iconSlot.style.cssText = "display:inline-flex;width:18px;height:18px;flex-shrink:0";
  iconSlot.setAttribute("aria-hidden", "true");
  button.append(iconSlot, text);
  let previousIcon = "";
  let previousLabel = "";
  let previousTitle = "";
  let status: PlaybackStatus | undefined;
  let visible = false;
  let disposed = false;
  let feedback: { state: "saving" | "saved" | "error"; position?: number | null; message?: string } | null = null;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  function clearFeedback() { clearTimeout(feedbackTimer); feedback = null; }
  async function saveFromControl() {
    if (!status?.canSave || feedback?.state === "saving" || disposed) return;
    const videoId = status.videoId;
    clearFeedback(); feedback = { state: "saving" }; paint();
    try {
      const saved = await save();
      if (disposed || status.videoId !== videoId) return;
      feedback = { state: "saved", position: saved.position };
      paint();
      feedbackTimer = setTimeout(() => { feedback = null; paint(); }, 1800);
    } catch (failure) {
      if (disposed || status.videoId !== videoId) return;
      feedback = { state: "error", message: failure instanceof Error ? failure.message : "Could not save. Try again." };
      paint();
    }
  }

  function paint() {
    if (!status || disposed) return;
    for (const duplicate of host.document.querySelectorAll(`[id="${CONTROL_ID}"]`)) {
      if (duplicate !== button) duplicate.remove();
    }
    if (!visible || !status.supported) { button.remove(); return; }
    const anchor = host.document.querySelector("ytd-watch-metadata #actions #flexible-actions, ytd-watch-metadata #actions #top-level-buttons-computed, #meta-contents #actions #top-level-buttons-computed");
    if (anchor && button.parentElement !== anchor) anchor.prepend(button);
    const phase = feedback?.state ?? (status.state === "error" ? "error" : "idle");
    const position = feedback?.position;
    const savedLabel = typeof position === "number" ? `Saved · ${Math.floor(position / 60)}:${String(Math.floor(position % 60)).padStart(2, "0")}` : "Saved";
    const label = phase === "saving" ? "Saving…" : phase === "saved" ? savedLabel : phase === "error" ? "Retry save" : "Save progress";
    const labelChanged = label !== previousLabel;
    if (labelChanged) { text.textContent = label; previousLabel = label; }
    const icon = phase === "saving" ? savingSvg : phase === "saved" ? checkSvg : phase === "error" ? warningSvg : status.selected ? chosenSvg : bookmarkSvg;
    if (icon !== previousIcon) {
      // These are bundled Phosphor assets, never file/import/user markup.
      const svg = new host.DOMParser().parseFromString(icon, "image/svg+xml").documentElement;
      svg.setAttribute("width", "18"); svg.setAttribute("height", "18"); svg.setAttribute("focusable", "false");
      iconSlot.replaceChildren(host.document.importNode(svg, true)); previousIcon = icon;
    }
    const message = feedback?.message ?? (phase === "saved" ? savedLabel : phase === "idle" && status.canSave ? "Save the current position. Progress will keep updating as you watch." : status.message);
    if (message !== previousTitle || labelChanged) {
      button.title = message; button.setAttribute("aria-label", `${label}. ${message}`); previousTitle = message;
    }
    if (button.dataset.state !== phase) button.dataset.state = phase;
    button.setAttribute("aria-busy", String(phase === "saving"));
    button.disabled = !status.canSave || phase === "saving";
    const hidden = !!host.document.fullscreenElement;
    if (button.hidden !== hidden) button.hidden = hidden;
  }
  return {
    update(next: PlaybackStatus, show: boolean) {
      if (status?.videoId !== next.videoId) clearFeedback();
      status = next; visible = show; paint();
    },
    dispose: () => { disposed = true; clearFeedback(); button.remove(); styles.remove(); },
  };
}
