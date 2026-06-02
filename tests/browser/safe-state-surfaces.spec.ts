import { expect, test } from "@playwright/test";

test("overview safe-state previews stay useful and recoverable", async ({
  page,
}) => {
  await page.goto("/?state=loading");

  await expect(
    page.getByRole("status", { name: "Overview loading preview" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "KPI summary" })).toHaveCount(
    0,
  );

  await page.getByRole("link", { name: "Return to live overview" }).click();
  await expect(
    page.getByRole("heading", {
      name: "PTO coverage readiness command center",
    }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "KPI summary" })).toBeVisible();

  await page.goto("/?state=no-urgent");
  await expect(
    page.getByText("No urgent items need triage right now"),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Urgent watchlist" }),
  ).toHaveCount(0);

  await page.goto("/?state=unavailable");
  await expect(
    page.getByText("Overview data is temporarily unavailable"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Retry the live overview" }),
  ).toBeVisible();

  await page.goto("/?state=error");
  await expect(
    page.getByRole("alert", { name: "Overview error preview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review requests instead" }),
  ).toBeVisible();
});

test("heatmap and coverage safe-state previews hide stale data", async ({
  page,
}) => {
  await page.goto("/heatmap?state=loading");

  await expect(
    page.getByRole("status", { name: "Heatmap loading preview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Coverage matrix loading preview" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Heatmap grid" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("region", { name: "Coverage matrix" }),
  ).toHaveCount(0);

  await page
    .getByRole("link", { name: "Return to the live heatmap" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Coverage heatmap" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Heatmap grid" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Coverage matrix" }),
  ).toBeVisible();

  await page.goto("/heatmap?state=empty");
  await expect(
    page.getByText("No coverage windows match this view"),
  ).toBeVisible();
  await expect(
    page.getByText("No coverage rows are available for this selection"),
  ).toBeVisible();

  await page.goto("/heatmap?state=error");
  await expect(
    page.getByRole("alert", { name: "Heatmap error preview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert", { name: "Coverage matrix error preview" }),
  ).toBeVisible();
});

test("request detail safe-state previews avoid stale request content", async ({
  page,
}) => {
  await page.goto("/requests/REQ-1001?state=no-selection");

  await expect(
    page.getByText("Choose a request to inspect coverage reasoning"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Avery Park" })).toHaveCount(
    0,
  );

  await page.getByRole("link", { name: "Open a live request detail" }).click();
  await expect(page.getByRole("heading", { name: "Avery Park" })).toBeVisible();

  await page.goto("/requests/REQ-1001?state=loading");
  await expect(
    page.getByRole("status", { name: "Request detail loading preview" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Avery Park" })).toHaveCount(
    0,
  );

  await page.goto("/requests/REQ-1001?state=error");
  await expect(
    page.getByRole("alert", { name: "Request detail error preview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Retry this request" }),
  ).toBeVisible();
});
