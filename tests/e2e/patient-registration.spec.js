const { test, expect } = require("@playwright/test");
const { apiOrigin } = require("./helpers");

test("patient can register, handle a bad password, and read the saved profile after login", async ({ page, request }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const patient = {
    fullName: "Browser Registration Patient",
    email: `portal-${Date.now()}@medicare.test`,
    password: "Patient-Registration-Password-9!",
    age: 38,
    gender: "Other",
    phone: "555-0101",
    address: "Browser registration address"
  };

  const unauthenticated = await request.get(`${apiOrigin}/api/patient-portal/me`);
  expect(unauthenticated.status()).toBe(401);

  await page.goto("/");
  await page.getByRole("button", { name: "Patient Portal" }).first().click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.locator("#patientRegisterName").fill(patient.fullName);
  await page.locator("#patientRegisterEmail").fill(patient.email);
  await page.locator("#patientRegisterPassword").fill(patient.password);
  await page.locator("#patientRegisterAge").fill(String(patient.age));
  await page.locator("#patientRegisterGender").fill(patient.gender);
  await page.locator("#patientRegisterPhone").fill(patient.phone);
  await page.locator("#patientRegisterAddress").fill(patient.address);
  await page.getByRole("button", { name: "Create patient account" }).click();
  await expect(page.getByRole("heading", { name: "My health dashboard" })).toBeVisible();
  await expect(page.locator("#patientDashboardName")).toContainText(patient.fullName);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Patient Portal" }).first().click();
  await page.locator("#patientLoginEmail").fill(patient.email);
  await page.locator("#patientLoginPassword").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page.locator("#patientLoginError")).toContainText("Invalid");

  await page.locator("#patientLoginPassword").fill(patient.password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page.getByRole("heading", { name: "My health dashboard" })).toBeVisible();
  await expect(page.locator("#patientDashboardName")).toContainText(patient.fullName);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
  expect(pageErrors).toEqual([]);
  await page.getByRole("button", { name: "Sign out" }).click();
});
