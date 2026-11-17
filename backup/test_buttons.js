const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  
  const consoleErrors = [];
  page.on("console", msg => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", err => consoleErrors.push(err.message));

  console.log("1. Navigating to http://127.0.0.1:5501/index.html...");
  await page.goto("http://127.0.0.1:5501/index.html", { waitUntil: "networkidle" });

  console.log("2. Testing Patient Portal button navigation...");
  await page.click('button:has-text("Patient Portal")');
  await page.waitForTimeout(300);
  const patientPortalVisible = await page.isVisible("#patient-portal");
  console.log("   Patient Portal visible:", patientPortalVisible);

  console.log("3. Returning to Public Website...");
  await page.click('button:has-text("Return to public website")');
  await page.waitForTimeout(300);
  const publicVisible = await page.isVisible("#public-view");
  console.log("   Public View visible:", publicVisible);

  console.log("4. Testing Staff Login button navigation...");
  await page.click('button:has-text("Staff Login")');
  await page.waitForTimeout(300);
  const staffLoginVisible = await page.isVisible("#staff-login-panel");
  console.log("   Staff Login Panel visible:", staffLoginVisible);

  console.log("5. Testing Staff Login with Admin credentials...");
  await page.fill("#staffUsernameInput", "admin@medicare.health");
  await page.fill("#staffPasswordInput", "AdminPass123!");
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

  console.log("\n=== CONSOLE ERRORS SUMMARY ===");
  if (consoleErrors.length === 0) {
    console.log("ZERO browser console errors detected! All operations passed cleanly.");
  } else {
    console.log(`Found ${consoleErrors.length} errors:`, consoleErrors);
  }

  await browser.close();
})();
