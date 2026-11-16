const { test, expect } = require("@playwright/test");
const { apiOrigin, loginPatientInUi, newPatient, registerPatient } = require("./helpers");

test("patient appointment requests are owned by the account and remain visible after refresh", async ({ page, request }) => {
  const { patient, auth } = await registerPatient(request);
  const unauthenticated = await request.get(`${apiOrigin}/api/patient-portal/me`);
  expect(unauthenticated.status()).toBe(401);

  await loginPatientInUi(page, patient);
  await expect(page.getByRole("heading", { name: "My health dashboard" })).toBeVisible();
  await page.locator("#patientAppointmentDoctor").selectOption({ index: 0 });
  const date = new Date();
  date.setDate(date.getDate() + 700);
  await page.locator("#patientAppointmentDate").fill(date.toISOString().slice(0, 10));
  await page.locator("#patientAppointmentTime").fill("11:32");
  await page.locator("#patientAppointmentReason").fill("Follow-up consultation");
  await page.getByRole("button", { name: "Request appointment" }).click();
  await expect(page.locator("#patientDashboardContent")).toContainText("Pending");

  const dashboardResponse = await request.get(`${apiOrigin}/api/patient-portal/me`, {
    headers: { Authorization: `Bearer ${auth.token}` }
  });
  expect(dashboardResponse.status()).toBe(200);
  const dashboard = await dashboardResponse.json();
  expect(dashboard.appointments).toHaveLength(1);
  expect(dashboard.appointments[0].patientId).toBe(dashboard.profile.id);
  expect(dashboard.appointments[0].patientName).toBe(patient.fullName);
  expect(dashboard.appointments[0].reason).toBe("Follow-up consultation");

  await page.getByRole("button", { name: "Sign out" }).click();
});
