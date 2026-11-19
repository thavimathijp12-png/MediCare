const { test, expect } = require("@playwright/test");

test("keyboard focus remains visible on interactive controls", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");

  const focusStyle = await page.evaluate(() => {
    const activeElement = document.activeElement;
    const style = getComputedStyle(activeElement);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth)
    };
  });

  expect(focusStyle.outlineStyle).toBe("solid");
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(3);
});
