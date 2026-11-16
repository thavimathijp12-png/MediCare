const { test, expect } = require("@playwright/test");
const { apiOrigin, loginPatientInUi, registerPatient } = require("./helpers");

test("patient can view a linked invoice and checkout stays unconfirmed without Stripe configuration", async ({ page, request }) => {
  const adminEmail = process.env.MEDICARE_BOOTSTRAP_ADMIN_EMAIL;
  const adminPassword = process.env.MEDICARE_BOOTSTRAP_ADMIN_PASSWORD;
  test.skip(!adminEmail || !adminPassword, "Set temporary development bootstrap credentials for this E2E run.");

  const { patient, auth } = await registerPatient(request);
  const adminLogin = await request.post(`${apiOrigin}/api/auth/login`, {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(adminLogin.status()).toBe(200);
  const admin = await adminLogin.json();
  const invoiceResponse = await request.post(`${apiOrigin}/api/billing`, {
    headers: { Authorization: `Bearer ${admin.token}` },
    data: {
      patientId: (await (await request.get(`${apiOrigin}/api/patient-portal/me`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      })).json()).profile.id,
      patientName: patient.fullName,
      department: "Cardiology",
      date: new Date().toISOString().slice(0, 10),
      amount: 125.5,
      method: "Direct Payment",
      items: [{ desc: "Consultation", cost: 125.5 }]
    }
  });
  const invoice = await invoiceResponse.json();
  expect(invoiceResponse.status(), JSON.stringify(invoice)).toBe(201);

  await loginPatientInUi(page, patient);
  await expect(page.locator("#patientDashboardContent")).toContainText(invoice.id);
  await expect(page.locator("#patientDashboardContent")).toContainText("Pending");
  await page.locator(`[data-pay-invoice="${invoice.id}"]`).click();
  await expect(page.locator("#patientDashboardError")).toContainText("Stripe test-mode payments are not configured.");

  const dashboardResponse = await request.get(`${apiOrigin}/api/patient-portal/me`, {
    headers: { Authorization: `Bearer ${auth.token}` }
  });
  const dashboard = await dashboardResponse.json();
  expect(dashboard.invoices[0].status).toBe("Pending");
  await page.getByRole("button", { name: "Sign out" }).click();
});
