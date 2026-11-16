const { test, expect } = require("@playwright/test");
const { loginStaffInUi } = require("./helpers");

test.describe("navigation and staff controls", () => {
  test("public navigation allows switching between patient portal, staff login, and public view", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", err => pageErrors.push(err.message));

    await page.goto("/");

    // 1. Navigate to Patient Portal view
    await page.getByRole("button", { name: "Patient Portal" }).first().click();
    await expect(page.locator("#patient-portal")).toBeVisible();

    // 2. Return to public view from Patient Portal
    await page.locator('#patient-portal button:has-text("Return to public website")').click();
    await expect(page.locator("#public-view")).toBeVisible();

    // 3. Navigate to Staff Login panel
    await page.getByRole("button", { name: "Staff Login" }).first().click();
    await expect(page.locator("#staff-login-panel")).toBeVisible();

    // 4. Return to public view from Staff Login
    await page.locator('#staff-login-panel button:has-text("Return to public website")').click();
    await expect(page.locator("#public-view")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("staff login displays dashboard, allows navigating all sidebar tabs, and signs out cleanly", async ({ page }) => {
    const adminEmail = process.env.MEDICARE_BOOTSTRAP_ADMIN_EMAIL;
    const adminPassword = process.env.MEDICARE_BOOTSTRAP_ADMIN_PASSWORD;
    test.skip(!adminEmail || !adminPassword, "Set MEDICARE_BOOTSTRAP_ADMIN_EMAIL and MEDICARE_BOOTSTRAP_ADMIN_PASSWORD to run staff E2E tests.");

    const pageErrors = [];
    page.on("pageerror", err => pageErrors.push(err.message));

    await loginStaffInUi(page, adminEmail, adminPassword);

    const tabs = ["patients", "doctors", "appointments", "departments", "billing", "staff", "settings", "dashboard"];
    for (const tab of tabs) {
      await page.locator(`.sidebar-nav-link[data-tab="${tab}"]`).click();
      await expect(page.locator(`#tab-${tab}`)).toBeVisible();
    }

    await page.locator('button[onclick="logoutStaff()"]').click();
    await expect(page.locator("#public-view")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

