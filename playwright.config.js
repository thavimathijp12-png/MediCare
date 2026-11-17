const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5503",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1280, height: 900 }
  },
  webServer: {
    command: "node tests/e2e/serve-frontend.js",
    url: "http://127.0.0.1:5503",
    reuseExistingServer: true,
    timeout: 30000
  }
});
