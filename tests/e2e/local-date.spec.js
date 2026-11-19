const { test, expect } = require("@playwright/test");

test("calendar dates use the local date rather than the UTC date", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "Pacific/Kiritimati" });
  const page = await context.newPage();
  await page.route("**/api/**", route => route.fulfill({ json: [] }));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const date = await page.evaluate(() => getLocalDateString(new Date("2026-01-01T12:30:00Z")));

  expect(date).toBe("2026-01-02");
  await context.close();
});

test("interface animations respect the operating system reduced-motion preference", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const motionStyles = await page.evaluate(() => {
    const element = document.createElement("div");
    element.style.animation = "fadeIn 5s";
    element.style.transition = "opacity 5s";
    document.body.appendChild(element);
    const styles = getComputedStyle(element);
    return {
      animationDuration: parseFloat(styles.animationDuration),
      transitionDuration: parseFloat(styles.transitionDuration),
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior
    };
  });

  expect(motionStyles.animationDuration).toBeLessThanOrEqual(0.001);
  expect(motionStyles.transitionDuration).toBeLessThanOrEqual(0.001);
  expect(motionStyles.scrollBehavior).toBe("auto");
  await context.close();
});
