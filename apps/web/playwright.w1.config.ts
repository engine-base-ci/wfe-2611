// W1 の手元だけ（コミットしない）：代理を死んだ口にし、3471 だけ直に通す
import base from "./playwright.config";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  ...base,
  workers: 3,
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:3471",
    launchOptions: {
      args: ["--proxy-server=http://127.0.0.1:9", "--proxy-bypass-list=<-loopback>;127.0.0.1:3471;127.0.0.1:3472"],
    },
  },
  webServer: undefined,
});
