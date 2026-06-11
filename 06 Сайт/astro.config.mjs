import { defineConfig } from "astro/config";

const isVercel = Boolean(process.env.VERCEL);
const site = process.env.PUBLIC_SITE_URL || (isVercel ? "https://babinovifamilybase.vercel.app" : "https://ulyana19svlv.github.io");
const base = process.env.PUBLIC_BASE_PATH ?? (isVercel ? "" : "/BabinoviFamilyBase");

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "never",
  vite: {
    server: {
      fs: {
        allow: [".."],
      },
    },
  },
});
