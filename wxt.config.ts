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
    permissions: ["storage"],
    host_permissions: ["https://www.youtube.com/*"],
    action: {
      default_popup: "popup/index.html",
    },
  },
});
