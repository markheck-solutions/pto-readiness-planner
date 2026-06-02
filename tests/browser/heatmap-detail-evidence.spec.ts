import { expect, test } from "@playwright/test";

test("heatmap selection surfaces coverage matrix and queue entry points", async ({
  page,
}) => {
  await page.goto("/heatmap");

  await expect(
    page.getByRole("heading", { name: "Coverage heatmap" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Heatmap legend" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Week of Jun/ }).first(),
  ).toBeVisible();

  await page
    .getByRole("link", { name: /Week of Jun/ })
    .first()
    .click();

  await expect(page).toHaveURL(/weekStart=2026-06-17/);
  await expect(
    page.getByRole("heading", { name: /Selected week/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Coverage matrix" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open queue for this window" }),
  ).toBeVisible();
});

test("request detail traces reasons to evidence and shares simulated state", async ({
  page,
}) => {
  await page.goto("/requests/REQ-1001");

  await expect(page.getByRole("heading", { name: "Avery Park" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Recommendation reasons" }),
  ).toBeVisible();
  const firstEvidenceButton = page
    .getByRole("button", { name: /Show evidence for/ })
    .first();
  await expect(firstEvidenceButton).toBeVisible();

  await firstEvidenceButton.click();
  await expect(
    page.getByRole("dialog", { name: "Evidence drawer" }),
  ).toBeVisible();
  await expect(page.getByText("Loading seeded evidence")).toBeVisible();
  await expect(
    page.getByText("Coverage requirement", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Close evidence drawer" }).click();
  await expect(
    page.getByRole("dialog", { name: "Evidence drawer" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Approve (demo)" }).click();
  await expect(page.getByText("Simulated decision: Approve")).toBeVisible();

  await page.getByRole("link", { name: "PTO requests" }).click();
  await expect(
    page
      .getByRole("row", { name: /Avery Park.*REQ-1001/ })
      .getByLabel("Simulated decision: Approved in demo"),
  ).toBeVisible();

  await page.getByRole("link", { name: /Casey Patel.*REQ-1004/ }).click();
  await expect(
    page.getByRole("heading", { name: "Casey Patel" }),
  ).toBeVisible();
  await expect(page.getByText("Simulated decision: Approve")).toHaveCount(0);

  await page.getByRole("link", { name: "PTO requests" }).click();
  await expect(
    page
      .getByRole("row", { name: /Avery Park.*REQ-1001/ })
      .getByLabel("Simulated decision: Approved in demo"),
  ).toBeVisible();

  await page.reload();
  await expect(
    page
      .getByRole("row", { name: /Avery Park.*REQ-1001/ })
      .getByLabel("Simulated decision: Approved in demo"),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("row", { name: /Avery Park.*REQ-1001/ })
      .getByLabel("Simulated decision: No simulated decision"),
  ).toBeVisible();
});

test("evidence drawer handles empty, loading, and error states safely", async ({
  page,
}) => {
  await page.route("**/api/evidence**", async (route) => {
    await page.waitForTimeout(250);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        demoMode: true,
        datasetVersion: "2026-06-01-demo-v2",
        seedFingerprint: "traceability-test",
        items: [],
      }),
    });
  });

  await page.goto("/requests/REQ-1004");

  await page
    .getByRole("button", { name: /Show evidence for/ })
    .first()
    .click();
  await expect(page.getByText("Loading seeded evidence")).toBeVisible();
  await expect(
    page.getByText("No seeded evidence was found for this reason."),
  ).toBeVisible();
});

test("evidence drawer shows a controlled error when loading fails", async ({
  page,
}) => {
  await page.route("**/api/evidence**", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "internal_error",
          message: "Evidence service unavailable.",
        },
      }),
    });
  });

  await page.goto("/requests/REQ-1001");

  await page
    .getByRole("button", { name: /Show evidence for/ })
    .first()
    .click();
  await expect(page.getByText("Loading seeded evidence")).toBeVisible();
  await expect(
    page.getByText("Evidence could not be loaded right now."),
  ).toBeVisible();
});
