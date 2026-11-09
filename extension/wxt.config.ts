import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "LinkComment AI",
    short_name: "LinkComment",
    description:
      "Reads the LinkedIn post you're on and suggests thoughtful, human-sounding comments you can insert in one click.",
    permissions: ["storage"],
    host_permissions: ["http://localhost/*", "http://127.0.0.1/*"],
    // Requested at runtime only if the user points the extension at a remote backend.
    optional_host_permissions: ["https://*/*", "http://*/*"],
    action: { default_title: "LinkComment AI" },
  },
});
