const { test, expect } = require("@playwright/test");

test("calendar dates use the local date rather than the UTC date", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "Pacific/Kiritimati" });
  const page = await context.newPage();
  await page.route("**/api/**", route => route.fulfill({ json: [] }));

  await page.goto("/");
  const date = await page.evaluate(() => getLocalDateString(new Date("2026-01-01T12:30:00Z")));

  expect(date).toBe("2026-01-02");
  await context.close();
});
