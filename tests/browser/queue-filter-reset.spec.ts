import { expect, test } from "@playwright/test";

const combinedFilterQuery =
  "teamId=team_release_ops&roleId=role_release_coordinator&requestType=pto&status=pending&coverageBand=thin&conflictLevel=medium&startDate=2026-06-24&endDate=2026-06-30&weekStart=2026-06-24&sort=risk&dir=desc";

test("clear all resets the combined queue filters and drops stale review links", async ({
  page,
  request,
}) => {
  const filteredApi = await request.get(`/api/pto-requests?${combinedFilterQuery}`);
  expect(filteredApi.ok()).toBe(true);
  const filteredJson = (await filteredApi.json()) as {
    items: Array<{ id: string }>;
  };
  expect(filteredJson.items.map((item) => item.id)).toEqual(["REQ-1001"]);

  const fullApi = await request.get("/api/pto-requests");
  expect(fullApi.ok()).toBe(true);
  const fullJson = (await fullApi.json()) as {
    items: Array<{ id: string }>;
  };
  expect(fullJson.items).toHaveLength(5);

  await page.goto(`/requests?${combinedFilterQuery}`);

  await expect(page.getByText("Showing 1 request.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Review context" }),
  ).toContainText("Started from the selected heatmap week");

  await page.getByRole("link", { name: "Clear all" }).click();

  await expect(page).toHaveURL(/\/requests$/);
  await expect(page.locator("#teamId")).toHaveValue("");
  await expect(page.locator("#roleId")).toHaveValue("");
  await expect(page.locator("#requestType")).toHaveValue("");
  await expect(page.locator("#status")).toHaveValue("");
  await expect(page.locator("#coverageBand")).toHaveValue("");
  await expect(page.locator("#conflictLevel")).toHaveValue("");
  await expect(page.locator("#startDate")).toHaveValue("");
  await expect(page.locator("#endDate")).toHaveValue("");
  await expect(page.locator("#sort")).toHaveValue("risk");
  await expect(page.locator("#dir")).toHaveValue("desc");
  await expect(
    page.getByRole("region", { name: "Review context" }),
  ).toHaveCount(0);
  await expect(page.getByText("Active filters")).toHaveCount(0);
  await expect(page.getByText("Showing 5 requests.", { exact: true })).toBeVisible();

  const detailHref = await page
    .getByRole("row", { name: /Jordan Kim.*REQ-1002/ })
    .getByRole("link", { name: /Jordan Kim/ })
    .getAttribute("href");
  expect(detailHref).toBe("/requests/REQ-1002");

  const coverageHref = await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Coverage", exact: true })
    .getAttribute("href");
  expect(coverageHref).toBe("/heatmap");

  await page.getByRole("link", { name: "Coverage", exact: true }).click();
  await expect(page).toHaveURL(/\/heatmap$/);
  await expect(
    page.getByRole("table", { name: "Coverage matrix for the selected week" }),
  ).toContainText("Release Coordinator");
  await expect(
    page.getByRole("table", { name: "Coverage matrix for the selected week" }),
  ).toContainText("Escalation Owner");
});

test("empty-state reset clears the session demo decision filter and restores the full queue", async ({
  page,
}) => {
  await page.goto("/requests");

  const averyRow = page.getByRole("row", { name: /Avery Park.*REQ-1001/ });
  await averyRow.getByRole("link", { name: /Avery Park/ }).click();
  await page.getByRole("button", { name: "Approve (demo)" }).click();

  await page.getByRole("link", { name: "PTO requests" }).click();
  const sessionFilter = page.getByLabel("Demo decision filter");
  await sessionFilter.selectOption("defer");

  await expect(
    page.getByText(
      "No requests in this browser session match the current demo decision filter.",
    ),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Clear filters and show the full queue" })
    .click();

  await expect(page).toHaveURL(/\/requests$/);
  await expect(sessionFilter).toHaveValue("");
  await expect(page.getByText("Showing 5 requests.", { exact: true })).toBeVisible();
  await expect(page.getByText("Active filters")).toHaveCount(0);
  await expect(
    page
      .getByRole("row", { name: /Avery Park.*REQ-1001/ })
      .getByLabel("Simulated decision: Approved in demo"),
  ).toBeVisible();
});
