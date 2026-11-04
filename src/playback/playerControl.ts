import type { BrowserWindow } from "@/youtube/player";
import bookmarkSvg from "@phosphor-icons/core/assets/regular/bookmark-simple.svg?raw";
import checkSvg from "@phosphor-icons/core/assets/regular/check-circle.svg?raw";
import warningSvg from "@phosphor-icons/core/assets/regular/warning-circle.svg?raw";
import savingSvg from "@phosphor-icons/core/assets/regular/circle-notch.svg?raw";

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
  const text = host.document.createElement("span");
  const iconSlot = host.document.createElement("span");
  iconSlot.style.cssText = "display:inline-flex;width:16px;height:16px;flex-shrink:0";
  iconSlot.setAttribute("aria-hidden", "true");
  button.append(iconSlot, text);
  let previousIcon = "";
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
      const labelChanged = label !== previousLabel;
      if (labelChanged) { text.textContent = label; previousLabel = label; }
      const icon = status.state === "saving" ? savingSvg : status.state === "error" ? warningSvg : status.selected ? checkSvg : bookmarkSvg;
      if (icon !== previousIcon) {
        // These are bundled Phosphor assets, never file/import/user markup.
        const svg = new host.DOMParser().parseFromString(icon, "image/svg+xml").documentElement;
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("focusable", "false");
        iconSlot.replaceChildren(host.document.importNode(svg, true));
        previousIcon = icon;
      }
      if (status.message !== previousTitle || labelChanged) {
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
