const crypto = require("node:crypto");
const { expect } = require("@playwright/test");

const apiOrigin = process.env.MEDICARE_E2E_API_ORIGIN || "http://127.0.0.1:8080";

function newPatient() {
  const suffix = crypto.randomUUID();
  return {
    fullName: `Browser Patient ${suffix.slice(0, 8)}`,
    email: `browser-${suffix}@medicare.test`,
    password: `Patient-${crypto.randomBytes(12).toString("hex")}Aa9!`,
    age: 38,
    gender: "Other",
    phone: "555-0123",
    address: "Browser test address"
  };
}

async function registerPatient(request, patient = newPatient()) {
  const response = await request.post(`${apiOrigin}/api/auth/register`, { data: patient });
  const auth = await response.json();
  expect(response.status(), JSON.stringify(auth)).toBe(201);
  return { patient, auth };
}

async function loginPatientInUi(page, patient) {
  await page.goto("/");
  await page.getByRole("button", { name: "Patient Portal" }).first().click();
  await page.locator("#patientLoginEmail").fill(patient.email);
  await page.locator("#patientLoginPassword").fill(patient.password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
}

module.exports = { apiOrigin, loginPatientInUi, newPatient, registerPatient };
