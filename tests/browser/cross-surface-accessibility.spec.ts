import { expect, test } from "@playwright/test";

test("heatmap, detail, and queue preserve the shared review filter contract", async ({
  page,
}) => {
  const filterQuery =
    "teamId=team_customer_support&roleId=role_support_lead&requestType=training&status=approved&coverageBand=risky&conflictLevel=none&weekStart=2026-06-17&startDate=2026-06-17&endDate=2026-06-23&sort=start_date&dir=asc";

  await page.goto(`/heatmap?${filterQuery}`);

  const selectedWeek = page.getByRole("region", { name: "Selected week" });
  await expect(selectedWeek).toContainText("Jun 17 to Jun 23");
  await expect(
    page.getByRole("table", {
      name: "Coverage matrix for the selected week",
    }),
  ).toContainText("Support Lead");
  await expect(
    page.getByRole("table", {
      name: "Coverage matrix for the selected week",
    }),
  ).not.toContainText("Escalation Owner");

  await selectedWeek
    .getByRole("link", { name: /Taylor Nguyen.*REQ-1002A/ })
    .click();

  await expect(page).toHaveURL(/\/requests\/REQ-1002A\?/);
  await expect(page).toHaveURL(/teamId=team_customer_support/);
  await expect(page).toHaveURL(/roleId=role_support_lead/);
  await expect(page).toHaveURL(/requestType=training/);
  await expect(page).toHaveURL(/status=approved/);
  await expect(page).toHaveURL(/coverageBand=risky/);
  await expect(page).toHaveURL(/conflictLevel=none/);
  await expect(page).toHaveURL(/weekStart=2026-06-17/);
  await expect(page).toHaveURL(/startDate=2026-06-17/);
  await expect(page).toHaveURL(/endDate=2026-06-23/);
  await expect(page).toHaveURL(/sort=start_date/);
  await expect(page).toHaveURL(/dir=asc/);
  await expect(
    page.getByRole("region", { name: "Review context" }),
  ).toContainText("Selected heatmap week");
  await expect(
    page.getByRole("link", { name: "Return to selected heatmap week" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "PTO requests" }).click();
  await expect(page).toHaveURL(/\/requests\?/);
  await expect(page).toHaveURL(/teamId=team_customer_support/);
  await expect(page).toHaveURL(/roleId=role_support_lead/);
  await expect(page).toHaveURL(/requestType=training/);
  await expect(page).toHaveURL(/status=approved/);
  await expect(page).toHaveURL(/coverageBand=risky/);
  await expect(page).toHaveURL(/conflictLevel=none/);
  await expect(page).toHaveURL(/weekStart=2026-06-17/);
  await expect(page).toHaveURL(/startDate=2026-06-17/);
  await expect(page).toHaveURL(/endDate=2026-06-23/);
  await expect(page).toHaveURL(/sort=start_date/);
  await expect(page).toHaveURL(/dir=asc/);
  await expect(page.getByText("Showing 1 request.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Taylor Nguyen.*REQ-1002A/ }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Return to selected heatmap week" })
    .click();
  await expect(page).toHaveURL(/\/heatmap\?/);
  await expect(page).toHaveURL(/teamId=team_customer_support/);
  await expect(page).toHaveURL(/roleId=role_support_lead/);
  await expect(page).toHaveURL(/requestType=training/);
  await expect(page).toHaveURL(/status=approved/);
  await expect(page).toHaveURL(/coverageBand=risky/);
  await expect(page).toHaveURL(/conflictLevel=none/);
  await expect(page).toHaveURL(/weekStart=2026-06-17/);
  await expect(page).toHaveURL(/startDate=2026-06-17/);
  await expect(page).toHaveURL(/endDate=2026-06-23/);
  await expect(page).toHaveURL(/sort=start_date/);
  await expect(page).toHaveURL(/dir=asc/);
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
