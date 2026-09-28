import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      devOptions: { enabled: true },
      registerType: "autoUpdate",
      manifest: {
        name: "マインスイーパー",
        short_name: "マインスイーパー",
        description: "スマートフォンで遊べるマインスイーパー",
        theme_color: "#f5f5f5",
        background_color: "#f5f5f5",
        display: "standalone",
        start_url: "/minesweeper-pwa/",
        scope: "/minesweeper-pwa/",
        icons: [
          {
            src: "/minesweeper-pwa/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/minesweeper-pwa/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  base: "/minesweeper-pwa/",
  server: {
    host: true,
    watch: {
      usePolling: true,
      interval: 1000,
      binaryInterval: 1500,
    },
  },
});
