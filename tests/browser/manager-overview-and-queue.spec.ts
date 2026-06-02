import { test, expect } from "@playwright/test";

test("manager overview communicates value in first viewport", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "PTO coverage readiness command center",
    }),
  ).toBeVisible();

  await expect(page.getByLabel("Demo Mode: fictional data only")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Demo safety notice" })
      .getByText("Fictional data only. No login. No HR system connection."),
  ).toBeVisible();

  const kpis = page.getByRole("region", { name: "KPI summary" });
  await expect(kpis.getByText("Pending requests")).toBeVisible();
  await expect(kpis.getByText("High-risk requests")).toBeVisible();
  await expect(kpis.getByText("Exposed roles")).toBeVisible();
  await expect(kpis.getByText("Weekly pressure")).toBeVisible();
  await expect(kpis.getByText("Critical windows")).toBeVisible();

  await expect(
    page.getByRole("link", { name: "Review critical requests" }),
  ).toBeVisible();
});

test("queue supports filters, sorting, and safe recovery states", async ({
  page,
}) => {
  await page.goto("/requests");
  await expect(
    page.getByRole("heading", { name: "PTO request queue" }),
  ).toBeVisible();

  await expect(page.getByRole("table")).toBeVisible();

  await page.selectOption("#teamId", "team_customer_support");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/teamId=team_customer_support/);
  await expect(page.getByText("Active filters")).toBeVisible();
  await expect(page.getByText("Team: Customer Support")).toBeVisible();

  const teamCells = page.locator("table tbody tr td:nth-child(3)");
  await expect(teamCells.first()).toHaveText("Customer Support");

  await page.selectOption("#sort", "start_date");
  await page.selectOption("#dir", "asc");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/sort=start_date/);
  await expect(page).toHaveURL(/dir=asc/);

  await page.goto("/requests?startDate=2026-07-05&endDate=2026-07-01");
  await expect(page.getByText("Some filters were not applied.")).toBeVisible();
  await expect(
    page.getByText("Start date must be on or before end date."),
  ).toBeVisible();

  await page.goto(
    "/requests?teamId=team_customer_support&coverageBand=healthy",
  );
  await expect(
    page.getByText("No requests match the current filters."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Clear filters and show the full queue" }),
  ).toBeVisible();
});
