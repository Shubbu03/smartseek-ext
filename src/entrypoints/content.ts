import { startTracking } from "@/playback/startTracking";

export default defineContentScript({
  matches: ["*://*.youtube.com/*"],
  runAt: "document_idle",
  cssInjectionMode: "ui",
  main: startTracking,
});
