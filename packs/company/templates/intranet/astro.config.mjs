import { defineConfig } from "astro/config";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  site: "https://__WORKER__.workers.dev",
  vite: { plugins: [tailwind()] },
});
