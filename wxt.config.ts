import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  webExt: {
    disabled: true,
  },
  zip: {
    artifactTemplate: "{{name}}-{{version}}-{{browser}}.zip",
    sourcesTemplate: "{{name}}-{{version}}-sources.zip",
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifestVersion: 3,
  manifest: {
    name: "SmartSeek",
    version: "2.0.0",
    description:
      "Resume YouTube videos from the exact timestamp, even with history turned off.",
    permissions: ["storage"],
    host_permissions: ["https://www.youtube.com/*"],
    action: {
      default_popup: "popup/index.html",
    },
  },
});
