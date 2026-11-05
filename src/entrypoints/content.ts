import { startTracking } from "@/playback/startTracking";

export default defineContentScript({
  matches: ["https://www.youtube.com/*"],
  runAt: "document_idle",
  cssInjectionMode: "ui",
  main: startTracking,
});
