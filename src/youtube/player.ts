import { isVideoId } from "@/shared/libraryProtocol";

export type BrowserWindow = Window & typeof globalThis;
export type PlayerSnapshot = {
  videoId: string | null;
  media: HTMLVideoElement | null;
  confirmed: boolean;
  isAd: boolean;
  title: string;
  music: "music" | "other" | "unknown";
};

export function watchVideoId(href: string): string | null {
  const url = new URL(href);
  const id = url.pathname === "/watch" ? url.searchParams.get("v") : null;
  return url.origin === "https://www.youtube.com" && isVideoId(id) ? id : null;
}

export function explicitTimestamp(href: string): number | null {
  const url = new URL(href);
  const value = url.searchParams.get("t") ?? url.searchParams.get("start") ??
    url.searchParams.get("time_continue") ?? new URLSearchParams(url.hash.slice(1)).get("t");
  if (value === null || value.trim() === "") return null;
  if (/^\d+(\.\d+)?s?$/.test(value)) {
    const seconds = Number.parseFloat(value);
    return Number.isFinite(seconds) ? seconds : null;
  }
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(value);
  const seconds = match && match[0] ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) : null;
  return seconds !== null && Number.isFinite(seconds) ? seconds : null;
}

// All unstable YouTube selectors and media identity evidence live here.
export function createYouTubePlayer(host: BrowserWindow) {
  const doc = host.document;
  let generation = 0;
  let navigating = false;
  let navigationFrom: string | null = null;
  let route = watchVideoId(host.location.href);
  let initial = true;
  const evidence = new WeakMap<HTMLVideoElement, { generation: number; source: string }>();
  const sourceVideos = new Map<string, string>();

  function read(): PlayerSnapshot {
    const nextRoute = watchVideoId(host.location.href);
    if (nextRoute !== route) {
      route = nextRoute;
      if (!navigating) generation++;
      initial = false;
    }
    const flexy = doc.querySelector('ytd-watch-flexy:not([hidden])');
    const player = flexy?.querySelector("#movie_player");
    const media = player?.querySelector<HTMLVideoElement>("video.html5-main-video, video") ?? null;
    const isAd = player?.classList.contains("ad-showing") === true || player?.classList.contains("ad-interrupting") === true;
    if (media && isAd) { evidence.delete(media); initial = false; }
    const source = media?.currentSrc || media?.src || "";
    const metadataId = doc.querySelector('meta[itemprop="videoId"]')?.getAttribute("content");
    const matches = route !== null && flexy?.getAttribute("video-id") === route && (!metadataId || metadataId === route);
    if (media && initial && matches && !isAd && media.readyState >= 1 && source) {
      evidence.set(media, { generation, source });
      initial = false;
    }
    const known = media ? evidence.get(media) : undefined;
    const sourceVideo = sourceVideos.get(source);
    const confirmed = !!media && matches && !isAd && !navigating && media.isConnected &&
      media.readyState >= 1 && Number.isFinite(media.duration) && media.duration > 0 &&
      source !== "" && known?.generation === generation && known.source === source &&
      (sourceVideo === undefined || sourceVideo === route);
    if (confirmed && route && !sourceVideos.has(source)) {
      sourceVideos.set(source, route);
      if (sourceVideos.size > 32) {
        const oldest = sourceVideos.keys().next().value;
        if (oldest !== undefined) sourceVideos.delete(oldest);
      }
    }
    const genre = doc.querySelector('meta[itemprop="genre"]')?.getAttribute("content")?.trim().toLowerCase();
    return {
      videoId: route, media, confirmed, isAd,
      title: (flexy?.querySelector("ytd-watch-metadata h1, #title h1")?.textContent || doc.title.replace(/ - YouTube$/, "")).trim().slice(0, 4096),
      music: genre === "music" ? "music" : genre ? "other" : "unknown",
    };
  }

  function mediaEvent(media: HTMLVideoElement, type: string) {
    if (type === "emptied" || type === "loadstart") evidence.delete(media);
    if (type === "loadedmetadata" && !media.closest(".ad-showing, .ad-interrupting")) {
      const source = media.currentSrc || media.src;
      if (source && media.readyState >= 1) evidence.set(media, { generation, source });
    }
  }

  function observe(onChange: () => void) {
    const observer = new host.MutationObserver(onChange);
    observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["video-id", "class", "hidden", "content", "src"] });
    const start = () => {
      if (!navigating) { navigationFrom = route; generation++; }
      navigating = true;
      initial = false;
      onChange();
    };
    const finish = () => {
      const snapshot = read();
      if (navigating && route === navigationFrom) {
        const pendingGeneration = generation--;
        const known = snapshot.media ? evidence.get(snapshot.media) : undefined;
        if (snapshot.media && known?.generation === pendingGeneration) {
          evidence.set(snapshot.media, { ...known, generation });
        }
      }
      navigating = false;
      onChange();
    };
    doc.addEventListener("yt-navigate-start", start);
    doc.addEventListener("yt-navigate-finish", finish);
    host.addEventListener("popstate", onChange);
    return () => {
      observer.disconnect();
      doc.removeEventListener("yt-navigate-start", start);
      doc.removeEventListener("yt-navigate-finish", finish);
      host.removeEventListener("popstate", onChange);
    };
  }
  return { read, mediaEvent, observe };
}
