import { saveTimestamp, getTimestamp } from "~/lib/storage";
import type { ContentScriptContext } from "#imports";

let progressIntervalId: NodeJS.Timeout | number | null = null;
const MANUAL_SAVE_BUTTON_ID = "smartseek-manual-save-button";
let fullscreenListenerAdded = false;

export default defineContentScript({
  matches: ["*://*.youtube.com/*"],
  runAt: "document_idle",
  cssInjectionMode: "ui",
  main: async (_ctx: ContentScriptContext) => {
    observeUrlChange(() => {
      if (progressIntervalId !== null) {
        clearInterval(progressIntervalId);
        progressIntervalId = null;
        console.log(
          "[SmartSeek] Cleared previous progress tracking interval due to URL change."
        );
      }
      initSmartSeek();
    });

    initSmartSeek();
    addFullscreenListener();
  },
});

function observeUrlChange(onChange: () => void) {
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onChange();
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });
}

function getVideoId(): string | null {
  const urlParams = new URLSearchParams(location.search);
  if (location.pathname.startsWith("/watch")) {
    return urlParams.get("v");
  }

  if (location.pathname.startsWith("/shorts/")) {
    const parts = location.pathname.split("/");
    return parts[parts.indexOf("shorts") + 1] || null;
  }
  return null;
}

function waitForElement<T extends Element>(
  selector: string,
  timeout = 10000,
  interval = 500
): Promise<T | null> {
  return new Promise((resolve) => {
    let elapsedTime = 0;
    const check = () => {
      const element = document.querySelector<T>(selector);
      if (element) {
        resolve(element);
      } else {
        elapsedTime += interval;
        if (elapsedTime < timeout) {
          setTimeout(check, interval);
        } else {
          resolve(null);
        }
      }
    };
    check();
  });
}

async function waitForVideo(): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 20;
    const check = () => {
      const video = document.querySelector("video");
      if (video) {
        resolve(video);
      } else {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          console.warn(
            "[SmartSeek] Video element not found after multiple attempts."
          );
          reject(new Error("Video element not found."));
        }
      }
    };
    check();
  });
}

async function initSmartSeek() {
  if (progressIntervalId !== null) {
    clearInterval(progressIntervalId);
    progressIntervalId = null;
    console.log(
      "[SmartSeek] Cleared progress tracking interval at initSmartSeek."
    );
  }

  removeManualSaveButton();

  const videoId = getVideoId();
  if (!videoId) {
    console.log(
      "[SmartSeek] No video ID found on this page. Stopping tracking."
    );
    return;
  }

  console.log(`[SmartSeek] Initializing for video ID: ${videoId}`);

  try {
    const video = await waitForVideo();

    await setupManualSaveButton(video, videoId);
    await restoreProgress(video, videoId);
    trackProgress(video, videoId);
  } catch (error) {
    console.error("[SmartSeek] Error initializing smart seek:", error);
    if (progressIntervalId !== null) {
      clearInterval(progressIntervalId);
      progressIntervalId = null;
    }
  }
}

async function restoreProgress(video: HTMLVideoElement, videoId: string) {
  const saved = await getTimestamp(videoId);
  if (saved) {
    const tryRestore = () => {
      if (
        video.duration &&
        isFinite(video.duration) &&
        saved.lastWatched > 5 &&
        saved.lastWatched < video.duration - 5
      ) {
        video.currentTime = saved.lastWatched;
        console.log(`[SmartSeek] Restored ${videoId} to ${saved.lastWatched}s`);
      } else if (!video.duration || !isFinite(video.duration)) {
        console.log(
          `[SmartSeek] Video duration not yet available for ${videoId}. Cannot restore.`
        );
      }
    };

    if (video.readyState >= 1) {
      tryRestore();
    } else {
      console.log(`[SmartSeek] Waiting for metadata to restore ${videoId}...`);
      video.addEventListener("loadedmetadata", tryRestore, { once: true });
    }
  }
}

function trackProgress(video: HTMLVideoElement, videoId: string) {
  if (progressIntervalId !== null) {
    clearInterval(progressIntervalId);
    console.warn(
      "[SmartSeek] Overwriting an existing interval in trackProgress. This shouldn't happen frequently."
    );
  }

  progressIntervalId = window.setInterval(() => {
    const currentPageVideoId = getVideoId();
    if (currentPageVideoId !== videoId) {
      console.log(
        `[SmartSeek] Stale interval for ${videoId} detected on page for ${currentPageVideoId}. Clearing self.`
      );
      if (progressIntervalId !== null) clearInterval(progressIntervalId);
      progressIntervalId = null;
      return;
    }

    const currentVideoElement = document.querySelector("video");
    if (
      !currentVideoElement ||
      (video !== currentVideoElement && !document.body.contains(video))
    ) {
      console.warn(
        `[SmartSeek] Original video element for ${videoId} is stale or gone. Trying current video element.`
      );
      if (!currentVideoElement) {
        console.error(
          `[SmartSeek] No video element found on page for ${videoId}. Stopping tracking.`
        );
        if (progressIntervalId !== null) clearInterval(progressIntervalId);
        progressIntervalId = null;
        return;
      }
    }

    if (video.duration > 0 && !video.paused) {
      const progressData = {
        videoId,
        lastWatched: Math.floor(video.currentTime),
        updatedAt: new Date().toISOString(),
        title: document.title,
      };
      saveTimestamp(progressData);
    }
  }, 5000);

  console.log(
    `[SmartSeek] Started progress tracking for video ID: ${videoId} with interval ID: ${progressIntervalId}`
  );
}

// --- Manual Save Button Logic ---

function createManualSaveButtonElement(
  initialVideoElement: HTMLVideoElement,
  videoId: string
): HTMLButtonElement {
  const button = document.createElement("button");
  button.id = MANUAL_SAVE_BUTTON_ID;
  button.textContent = "Save Timestamp";

  button.style.padding = "0 16px";
  button.style.marginLeft = "8px";
  button.style.height = "36px";
  button.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "18px";
  button.style.cursor = "pointer";
  button.style.fontSize = "14px";
  button.style.fontWeight = "500";
  button.style.lineHeight = "36px";
  button.setAttribute("role", "button");

  button.onmouseover = () =>
    (button.style.backgroundColor = "rgba(255, 255, 255, 0.2)");
  button.onmouseout = () =>
    (button.style.backgroundColor = "rgba(255, 255, 255, 0.1)");

  button.onclick = async (e) => {
    e.stopPropagation();

    const currentVideoElement =
      document.querySelector("video.html5-main-video") ||
      document.querySelector("video[src]");
    const currentVideoId = getVideoId();

    if (!currentVideoElement || !currentVideoId) {
      button.textContent = "Error!";
      setTimeout(() => {
        if (document.getElementById(MANUAL_SAVE_BUTTON_ID))
          button.textContent = "Save Timestamp";
      }, 2000);
      return;
    }

    try {
      const currentTime = Math.floor(
        (currentVideoElement as HTMLVideoElement).currentTime
      );
      const title = document.title;
      await saveTimestamp({
        videoId: currentVideoId,
        lastWatched: currentTime,
        updatedAt: new Date().toISOString(),
        title: title,
      });
      button.textContent = "Saved!";
      setTimeout(() => {
        if (document.getElementById(MANUAL_SAVE_BUTTON_ID))
          button.textContent = "Save Timestamp";
      }, 2000);
    } catch (err) {
      button.textContent = "Error Saving";
      setTimeout(() => {
        if (document.getElementById(MANUAL_SAVE_BUTTON_ID))
          button.textContent = "Save Timestamp";
      }, 2000);
    }
  };
  return button;
}

async function setupManualSaveButton(
  videoElement: HTMLVideoElement,
  videoId: string
) {
  removeManualSaveButton();

  const button = createManualSaveButtonElement(videoElement, videoId);

  const targetSelectors = [
    "ytd-watch-metadata #actions #flexible-actions",
    "ytd-watch-metadata #actions #top-level-buttons-computed",
    "#menu.ytd-video-primary-info-renderer #top-level-buttons-computed",
    "#meta-contents #actions #top-level-buttons-computed",
  ];

  let parentToInsertIn: Element | null = null;
  for (const selector of targetSelectors) {
    parentToInsertIn = await waitForElement(selector, 3000, 300);
    if (parentToInsertIn) break;
  }

  if (parentToInsertIn) {
    const referenceNode = parentToInsertIn.querySelector(
      "ytd-button-renderer, ytd-toggle-button-renderer"
    );
    if (referenceNode) {
      parentToInsertIn.insertBefore(button, referenceNode);
    } else {
      parentToInsertIn.appendChild(button);
    }
    updateButtonVisibility(); // Set initial visibility
  } else {
    
  }
}

function removeManualSaveButton() {
  const existingButton = document.getElementById(MANUAL_SAVE_BUTTON_ID);
  if (existingButton) {
    existingButton.remove();
  }
}

function addFullscreenListener() {
  if (fullscreenListenerAdded) return;
  document.addEventListener("fullscreenchange", updateButtonVisibility);
  fullscreenListenerAdded = true;
}

function updateButtonVisibility() {
  const button = document.getElementById(MANUAL_SAVE_BUTTON_ID);
  if (button) {
    if (document.fullscreenElement) {
      button.style.display = "none";
    } else {
      button.style.display = "inline-flex";
      button.style.alignItems = "center";
    }
  }
}
