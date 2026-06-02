import { expect, test } from "@playwright/test";

test("heatmap week context carries into request detail and back out safely", async ({
  page,
}) => {
  await page.goto("/heatmap?weekStart=2026-06-17");

  const selectedWeek = page.getByRole("region", { name: "Selected week" });
  await expect(selectedWeek).toContainText("Jun 17 to Jun 23");

  await selectedWeek
    .getByRole("link", { name: /Taylor Nguyen.*REQ-1002A/ })
    .click();

  await expect(page).toHaveURL(/\/requests\/REQ-1002A\?/);
  await expect(page).toHaveURL(/weekStart=2026-06-17/);
  await expect(page).toHaveURL(/startDate=2026-06-17/);
  await expect(page).toHaveURL(/endDate=2026-06-23/);
  await expect(
    page.getByRole("region", { name: "Review context" }),
  ).toContainText("Selected heatmap week");
  await expect(
    page.getByRole("link", { name: "Return to selected heatmap week" }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Return to selected heatmap week" })
    .click();
  await expect(page).toHaveURL(/\/heatmap\?weekStart=2026-06-17/);
  await expect(selectedWeek).toContainText("Jun 17 to Jun 23");
});

test("evidence drawer returns focus to the invoking control after escape", async ({
  page,
}) => {
  await page.goto("/requests/REQ-1001");

  const evidenceButton = page
    .getByRole("button", { name: /Show evidence for/ })
    .first();
  await evidenceButton.focus();
  await evidenceButton.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Evidence drawer" });
  const closeButton = page.getByRole("button", {
    name: "Close evidence drawer",
  });

  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(closeButton).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(evidenceButton).toBeFocused();
});

test("main navigation and data tables expose current page context", async ({
  page,
}) => {
  await page.goto("/requests");

  await expect(
    page.getByRole("navigation", { name: "Primary" }).getByRole("link", {
      name: "Requests",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("table", { name: "PTO request queue results" }),
  ).toBeVisible();

  await page.goto("/heatmap?weekStart=2026-06-17");

  await expect(
    page.getByRole("navigation", { name: "Primary" }).getByRole("link", {
      name: "Coverage",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("table", {
      name: "Coverage matrix for the selected week",
    }),
  ).toBeVisible();
});
