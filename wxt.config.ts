import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifestVersion: 3,
  manifest: {
    name: "SmartSeek",
    version: "0.1.0",
    description:
      "Resume YouTube videos from the exact timestamp, even with history turned off.",
    permissions: ["storage", "scripting"],
    host_permissions: ["https://www.youtube.com/*"],
    action: {
      default_popup: "popup/index.html",
    },
    icon: {
      16: "public/icon/16.png",
      32: "public/icon/32.png",
      48: "public/icon/48.png",
      128: "public/icon/128.png",
    },
  },
});
