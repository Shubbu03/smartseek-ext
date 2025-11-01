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
  }

  removeManualSaveButton();

  const videoId = getVideoId();
  if (!videoId) {
    return;
  }

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
      } else if (!video.duration || !isFinite(video.duration)) {
      }
    };

    if (video.readyState >= 1) {
      tryRestore();
    } else {
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
        duration: Math.floor(video.duration),
        updatedAt: new Date().toISOString(),
        title: document.title,
      };
      saveTimestamp(progressData);
    }
  }, 5000);
}

// --- Manual Save Button Logic ---

function createManualSaveButtonElement(
  _initialVideoElement: HTMLVideoElement,
  _videoId: string
): HTMLButtonElement {
  const button = document.createElement("button");
  button.id = MANUAL_SAVE_BUTTON_ID;
  button.innerHTML = "";

  const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgIcon.setAttribute("viewBox", "0 0 24 24");
  svgIcon.setAttribute("focusable", "false");
  svgIcon.style.pointerEvents = "none";
  svgIcon.style.display = "block";
  svgIcon.style.width = "24px";
  svgIcon.style.height = "24px";
  svgIcon.style.fill = "currentColor";

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M17,3H7C5.9,3,5,3.9,5,5v16l7-3l7,3V5C19,3.9,18.1,3,17,3z M17,18l-5-2.18L7,18V5h10V18z"
  );
  svgIcon.appendChild(path);
  button.appendChild(svgIcon);

  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";

  button.style.fontFamily = 'Roboto, "YouTube Noto", Arial, sans-serif';
  button.style.fontSize = "14px";
  button.style.fontWeight = "500";

  button.style.height = "36px";
  button.style.width = "36px";
  button.style.minWidth = "36px";
  button.style.padding = "0";
  button.style.boxSizing = "border-box";

  button.style.marginRight = "8px";
  button.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  button.style.color = "#fff";
  button.style.border = "none";
  button.style.borderRadius = "50%";
  button.style.cursor = "pointer";
  button.style.overflow = "hidden";

  button.setAttribute("title", "Save video timestamp");
  button.setAttribute("role", "button");
  button.setAttribute("aria-label", "Save video timestamp");

  button.onmouseover = () => {
    button.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
  };

  button.onmouseout = () => {
    button.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  };

  let isSaved = false;
  let feedbackTimeout: number | null = null;

  button.onclick = async (e) => {
    e.stopPropagation();

    if (isSaved) return;

    const currentVideoElement = document.querySelector("video");
    const currentVideoId = getVideoId();

    if (!currentVideoElement || !currentVideoId) {
      console.error(
        "[SmartSeek] Manual save: Video element or ID not found on click."
      );

      showErrorState();
      return;
    }

    try {
      const currentTime = Math.floor(currentVideoElement.currentTime);
      const title = document.title;
      const duration = currentVideoElement.duration
        ? Math.floor(currentVideoElement.duration)
        : undefined;

      showProcessingState();

      await saveTimestamp({
        videoId: currentVideoId,
        lastWatched: currentTime,
        duration: duration, // Capture video duration
        updatedAt: new Date().toISOString(),
        title: title,
      });

      showSuccessState();
    } catch (err) {
      console.error("[SmartSeek] Error during manual save:", err);
      showErrorState();
    }
  };

  function showProcessingState() {
    svgIcon.style.opacity = "0.7";
    button.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
  }

  function showSuccessState() {
    if (feedbackTimeout !== null) {
      clearTimeout(feedbackTimeout);
    }

    path.setAttribute(
      "d",
      "M17,3H7C5.9,3,5,3.9,5,5v16l7-3l7,3V5C19,3.9,18.1,3,17,3z"
    );

    svgIcon.style.fill = "#aaffaa";
    svgIcon.style.opacity = "1";
    button.style.backgroundColor = "rgba(170, 255, 170, 0.2)";
    button.setAttribute("title", "Timestamp saved!");
    button.setAttribute("aria-label", "Timestamp saved");

    isSaved = true;

    feedbackTimeout = window.setTimeout(() => {
      path.setAttribute(
        "d",
        "M17,3H7C5.9,3,5,3.9,5,5v16l7-3l7,3V5C19,3.9,18.1,3,17,3z M17,18l-5-2.18L7,18V5h10V18z"
      );
      svgIcon.style.fill = "currentColor";
      button.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
      button.setAttribute("title", "Save video timestamp");
      button.setAttribute("aria-label", "Save video timestamp");
      isSaved = false;
    }, 2000);
  }

  function showErrorState() {
    if (feedbackTimeout !== null) {
      clearTimeout(feedbackTimeout);
    }

    svgIcon.style.fill = "#ffaaaa";
    button.style.backgroundColor = "rgba(255, 170, 170, 0.2)";
    button.setAttribute("title", "Error saving timestamp");
    button.setAttribute("aria-label", "Error saving timestamp");

    feedbackTimeout = window.setTimeout(() => {
      svgIcon.style.fill = "currentColor";
      button.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
      button.setAttribute("title", "Save video timestamp");
      button.setAttribute("aria-label", "Save video timestamp");
    }, 2000);
  }

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
    if (parentToInsertIn.firstChild) {
      parentToInsertIn.insertBefore(button, parentToInsertIn.firstChild);
    } else {
      parentToInsertIn.appendChild(button);
    }

    updateButtonVisibility();

    const INTRO_TOOLTIP_ID = "smartseek-manual-save-intro-tooltip";
    const HAS_SEEN_INTRO_KEY = "smartseek-intro-manual-save-button-v1";

    document.getElementById(INTRO_TOOLTIP_ID)?.remove();

    const hasSeenIntro = localStorage.getItem(HAS_SEEN_INTRO_KEY);

    if (!hasSeenIntro && button && button.offsetParent !== null) {
      const tooltip = document.createElement("div");
      tooltip.id = INTRO_TOOLTIP_ID;
      tooltip.textContent =
        "New! Click the save icon to manually save the current video timestamp.";

      tooltip.style.position = "absolute";
      tooltip.style.backgroundColor = "rgba(24, 26, 27, 0.92)";
      tooltip.style.color = "white";
      tooltip.style.padding = "10px 15px";
      tooltip.style.borderRadius = "8px";
      tooltip.style.fontSize = "14px";
      tooltip.style.zIndex = "2147483647";
      tooltip.style.fontFamily = 'Roboto, "YouTube Noto", Arial, sans-serif';
      tooltip.style.boxShadow = "0 5px 15px rgba(0,0,0,0.35)";
      tooltip.style.maxWidth = "230px";
      tooltip.style.textAlign = "center";
      tooltip.style.lineHeight = "1.45";
      tooltip.style.pointerEvents = "auto";
      tooltip.style.opacity = "0";
      tooltip.style.transition = "opacity 0.3s ease-in-out";

      document.body.appendChild(tooltip);

      const buttonRect = button.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      let topPosition = buttonRect.top - tooltipRect.height - 12;
      let leftPosition =
        buttonRect.left + buttonRect.width / 2 - tooltipRect.width / 2;

      if (topPosition < 10) {
        topPosition = buttonRect.bottom + 12;
      }
      if (leftPosition < 10) {
        leftPosition = 10;
      }
      if (leftPosition + tooltipRect.width > window.innerWidth - 10) {
        leftPosition = window.innerWidth - tooltipRect.width - 10;
      }

      tooltip.style.top = `${topPosition + window.scrollY}px`;
      tooltip.style.left = `${leftPosition + window.scrollX}px`;

      requestAnimationFrame(() => {
        tooltip.style.opacity = "1";
      });

      let tooltipTimeoutId: number | null = null;

      const dismissTooltip = () => {
        if (tooltipTimeoutId !== null) {
          clearTimeout(tooltipTimeoutId);
          tooltipTimeoutId = null;
        }
        tooltip.style.opacity = "0";
        setTimeout(() => {
          if (tooltip.parentElement) {
            tooltip.remove();
          }
        }, 300);
        tooltip.removeEventListener("click", dismissTooltip);
      };

      tooltip.addEventListener("click", dismissTooltip);
      tooltipTimeoutId = window.setTimeout(dismissTooltip, 7000);

      localStorage.setItem(HAS_SEEN_INTRO_KEY, "true");
    }
  } else {
    console.warn("[SmartSeek] Could not find target element to insert button");
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
