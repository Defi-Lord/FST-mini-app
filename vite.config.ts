// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      fastRefresh: {
        exclude: [/main\.tsx/], // ✅ stop Vite HMR reload spam
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // ✅ allows imports like "@/components/..."
      stream: "stream-browserify", // ✅ browser polyfills
      crypto: "crypto-browserify",
      buffer: "buffer",
    },
  },

  define: {
    "process.env": {}, // ✅ fixes libraries expecting process.env
  },

  optimizeDeps: {
    include: [
      "@solana/web3.js",
      "@solana/wallet-adapter-react",
      "@solana/wallet-adapter-wallets",
      "@solana/wallet-adapter-react-ui",
    ],
  },

  server: {
    port: 5174,
    strictPort: false,
    host: true, // ✅ allow LAN testing
  },

  build: {
    chunkSizeWarningLimit: 1500, // ✅ silence large bundle warnings
    outDir: "dist",
  },
});
