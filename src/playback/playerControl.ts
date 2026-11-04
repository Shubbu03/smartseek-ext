import type { BrowserWindow } from "@/youtube/player";

const CONTROL_ID = "smartseek-manual-save-button";

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

export function createPlayerControl(host: BrowserWindow, save: () => void) {
  const button = host.document.createElement("button");
  button.id = CONTROL_ID;
  button.type = "button";
  button.style.cssText = "display:inline-flex;align-items:center;gap:6px;border:1px solid #c5cde2;border-radius:20px;padding:9px 14px;margin:0 8px 0 0;background:#eef2fc;color:#243c85;font:500 14px Roboto,Arial,sans-serif;cursor:pointer;white-space:nowrap";
  button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); save(); });
  let previousLabel = "";
  let previousTitle = "";
  return {
    update(status: PlaybackStatus, visible: boolean) {
      for (const duplicate of host.document.querySelectorAll(`[id="${CONTROL_ID}"]`)) {
        if (duplicate !== button) duplicate.remove();
      }
      if (!visible || !status.supported) { button.remove(); return; }
      const anchor = host.document.querySelector("ytd-watch-metadata #actions #flexible-actions, ytd-watch-metadata #actions #top-level-buttons-computed, #meta-contents #actions #top-level-buttons-computed");
      if (anchor && button.parentElement !== anchor) anchor.prepend(button);
      const label = status.state === "saving" ? "Saving…" : status.state === "error" ? "Retry save" : status.selected ? "Save progress" : "Save this video";
      if (label !== previousLabel) { button.textContent = label; previousLabel = label; }
      if (status.message !== previousTitle) {
        button.title = status.message;
        button.setAttribute("aria-label", `${label}. ${status.message}`);
        previousTitle = status.message;
      }
      if (button.disabled === status.canSave) button.disabled = !status.canSave;
      const hidden = !!host.document.fullscreenElement;
      if (button.hidden !== hidden) button.hidden = hidden;
      const display = hidden ? "none" : "inline-flex";
      if (button.style.display !== display) button.style.display = display;
    },
    dispose: () => button.remove(),
  };
}
