import { expect, test } from "@playwright/test";

test("simulated decisions round-trip through the queue without stale demoDecision URLs", async ({
  page,
}) => {
  await page.goto("/requests?status=pending&sort=risk&dir=desc&demoDecision=approve");

  const sessionFilter = page.getByLabel("Demo decision filter");
  await expect.poll(() => page.url()).not.toContain("demoDecision=");
  await expect(sessionFilter).toHaveValue("");

  const queueRow = page.getByRole("row", { name: /Avery Park.*REQ-1001/ });
  await queueRow.getByRole("link", { name: /Avery Park/ }).click();

  await expect(page.getByRole("heading", { name: "Avery Park" })).toBeVisible();

  const draftContext = page.getByRole("region", {
    name: "Manager response draft context",
  });
  await expect(
    draftContext.getByText("Draft context is waiting for a demo action"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Approve (demo)" }).click();
  await expect(page.getByText("Simulated decision: Approve")).toBeVisible();
  await expect(
    draftContext.getByText("Draft context staged for demo approval"),
  ).toBeVisible();
  await expect(
    draftContext.getByText("No message is generated, sent, or saved"),
  ).toBeVisible();

  await page.getByRole("link", { name: "PTO requests" }).click();
  await expect.poll(() => page.url()).not.toContain("demoDecision=");
  await sessionFilter.selectOption("approve");
  await expect(page.getByText("Showing 1 request.", { exact: true })).toBeVisible();
  await expect(
    queueRow.getByLabel("Simulated decision: Approved in demo"),
  ).toBeVisible();

  await queueRow.getByRole("link", { name: /Avery Park/ }).click();
  await page.getByRole("button", { name: "Ask for coverage (demo)" }).click();
  await expect(
    draftContext.getByText("Draft context staged for coverage follow-up"),
  ).toBeVisible();
  await expect(
    draftContext.getByText("Draft context staged for demo approval"),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "PTO requests" }).click();
  await expect.poll(() => page.url()).not.toContain("demoDecision=");
  await expect(sessionFilter).toHaveValue("ask_for_coverage");
  await expect(page.getByText("Showing 1 request.", { exact: true })).toBeVisible();
  await expect(
    queueRow.getByLabel("Simulated decision: Ask for coverage in demo"),
  ).toBeVisible();
});

test("simulated decisions never persist through public APIs and reset on refresh", async ({
  browser,
  page,
  request,
}) => {
  const before = await request.get("/api/pto-requests/REQ-1001");
  expect(before.ok()).toBe(true);
  const beforeJson = await before.json();
  expect(beforeJson.request.status).toBe("pending");

  const mutationCalls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/") && req.method() !== "GET") {
      mutationCalls.push(`${req.method()} ${new URL(req.url()).pathname}`);
    }
  });

  await page.goto("/requests/REQ-1001");
  await page.getByRole("button", { name: "Defer (demo)" }).click();

  await expect(page.getByText("Simulated decision: Defer")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Manager response draft context" })
      .getByText("Draft context staged for demo defer"),
  ).toBeVisible();
  await expect.poll(() => mutationCalls).toEqual([]);

  const after = await request.get("/api/pto-requests/REQ-1001");
  expect(after.ok()).toBe(true);
  const afterJson = await after.json();
  expect(afterJson.request.status).toBe("pending");

  await page.getByRole("link", { name: "PTO requests" }).click();
  const sessionFilter = page.getByLabel("Demo decision filter");
  await sessionFilter.selectOption("defer");
  await expect(page.getByText("Showing 1 request.", { exact: true })).toBeVisible();

  await page.reload();
  await expect(sessionFilter).toHaveValue("");
  await expect(page.getByText("Simulated decision: Defer")).toHaveCount(0);
  await expect(
    page
      .getByRole("row", { name: /Avery Park.*REQ-1001/ })
      .getByLabel("Simulated decision: No simulated decision"),
  ).toBeVisible();

  const freshContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3102",
  });
  const freshPage = await freshContext.newPage();
  await freshPage.goto("/requests/REQ-1001");
  await expect(freshPage.getByText("Simulated decision: Defer")).toHaveCount(0);
  await expect(
    freshPage
      .getByRole("region", { name: "Manager response draft context" })
      .getByText("Draft context is waiting for a demo action"),
  ).toBeVisible();
  await freshContext.close();
});
