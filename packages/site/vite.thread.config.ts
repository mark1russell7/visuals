import { defineConfig } from "vite";

// This build makes `dist/thread/thread-view.js`: the view of a conversation as one module, for a page with no build step.
export default defineConfig({
  build: {
    target: "es2022",
    outDir: "dist/thread",
    emptyOutDir: true,
    lib: { entry: "src/thread.ts", formats: ["es"], fileName: () => "thread-view.js" },
  },
});
