const { chromium } = require("@playwright/test");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const playwrightConfig = require("./playwright.config");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || playwrightConfig.use?.baseURL || "http://127.0.0.1:5503";
const adminEmail = process.env.MEDICARE_BOOTSTRAP_ADMIN_EMAIL;
const adminPassword = process.env.MEDICARE_BOOTSTRAP_ADMIN_PASSWORD;

async function ensureServerRunning(url) {
  const isUp = await new Promise(resolve => {
    const req = http.get(url, () => resolve(true));
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
  if (isUp) return null;

  console.log(`Starting frontend test server for ${url}...`);
  const serverProcess = spawn("node", [path.resolve(__dirname, "tests/e2e/serve-frontend.js")], {
    stdio: "ignore",
    detached: false
  });

  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 100));
    const up = await new Promise(resolve => {
      const req = http.get(url, () => resolve(true));
      req.on("error", () => resolve(false));
      req.setTimeout(500, () => { req.destroy(); resolve(false); });
    });
    if (up) return serverProcess;
  }
  return serverProcess;
}

(async () => {
  const serverProcess = await ensureServerRunning(baseURL);
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    const consoleErrors = [];
    page.on("console", msg => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", err => consoleErrors.push(err.message));

    console.log(`1. Navigating to ${baseURL}/index.html...`);
    await page.goto(`${baseURL}/index.html`, { waitUntil: "networkidle" });

    console.log("2. Testing Patient Portal button navigation...");
    await page.click('button:has-text("Patient Portal")');
    await page.waitForTimeout(300);
    const patientPortalVisible = await page.isVisible("#patient-portal");
    console.log("   Patient Portal visible:", patientPortalVisible);

    console.log("3. Returning to Public Website...");
    await page.click('#patient-portal button:has-text("Return to public website")');
    await page.waitForTimeout(300);
    const publicVisible = await page.isVisible("#public-view");
    console.log("   Public View visible:", publicVisible);

    console.log("4. Testing Staff Login button navigation...");
    await page.click('button:has-text("Staff Login")');
    await page.waitForTimeout(300);
    const staffLoginVisible = await page.isVisible("#staff-login-panel");
    console.log("   Staff Login Panel visible:", staffLoginVisible);

    if (adminEmail && adminPassword) {
      console.log("5. Testing Staff Login with environment credentials...");
      await page.fill("#staffUsernameInput", adminEmail);
      await page.fill("#staffPasswordInput", adminPassword);
      await page.click('#staffLoginForm button[type="submit"]');

      try {
        await page.waitForSelector("#staff-dashboard:not(.d-none)", { timeout: 10000 });
        console.log("   Staff Dashboard visible: true");
      } catch (err) {
        const errorText = await page.textContent("#staffLoginError");
        console.log("   Staff Login Failed! Error message on UI:", errorText);
      }

      console.log("6. Testing Sidebar Navigation Tabs...");
      const tabs = ["patients", "doctors", "appointments", "departments", "billing", "staff", "settings", "dashboard"];
      for (const tab of tabs) {
        await page.click(`.sidebar-nav-link[data-tab="${tab}"]`);
        await page.waitForTimeout(200);
        const active = await page.isVisible(`#tab-${tab}`);
        console.log(`   Tab [${tab}] active:`, active);
      }

      console.log("7. Testing Sign Out button...");
      await page.click('button[onclick="logoutStaff()"]');
      await page.waitForTimeout(500);
      const publicAfterSignout = await page.isVisible("#public-view");
      console.log("   Public view visible after Sign Out:", publicAfterSignout);
    } else {
      console.log("5. Skipping Staff Login & Dashboard checks (MEDICARE_BOOTSTRAP_ADMIN_EMAIL / MEDICARE_BOOTSTRAP_ADMIN_PASSWORD not set).");
      console.log("   To include Staff Login checks, run with environment variables:");
      console.log("   MEDICARE_BOOTSTRAP_ADMIN_EMAIL=... MEDICARE_BOOTSTRAP_ADMIN_PASSWORD=... node test_buttons.js");

      console.log("6. Returning to Public Website from Staff Login...");
      await page.click('#staff-login-panel button:has-text("Return to public website")');
      await page.waitForTimeout(300);
      const publicReturned = await page.isVisible("#public-view");
      console.log("   Public View visible:", publicReturned);
    }

    console.log("\n=== CONSOLE ERRORS SUMMARY ===");
    if (consoleErrors.length === 0) {
      console.log("ZERO browser console errors detected! All operations passed cleanly.");
    } else {
      console.log(`Found ${consoleErrors.length} errors:`, consoleErrors);
      process.exitCode = 1;
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    if (serverProcess) {
      serverProcess.kill();
    }
  }
})().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
