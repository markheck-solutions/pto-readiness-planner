import { expect, test } from "@playwright/test";

test("simulated decisions update draft context and filtered queue without stale state", async ({
  page,
}) => {
  await page.goto(
    "/requests/REQ-1001?status=pending&sort=risk&dir=desc&demoDecision=approve",
  );

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
  await expect(page).toHaveURL(/demoDecision=approve/);
  await expect(page.getByText("Demo decision: Approved in demo")).toBeVisible();
  await expect(
    page.getByText("Showing 1 request.", { exact: true }),
  ).toBeVisible();

  const approveRow = page.getByRole("row", { name: /Avery Park.*REQ-1001/ });
  await expect(
    approveRow.getByLabel("Simulated decision: Approved in demo"),
  ).toBeVisible();

  await approveRow.getByRole("link", { name: /Avery Park/ }).click();
  await page.getByRole("button", { name: "Ask for coverage (demo)" }).click();
  await expect(
    draftContext.getByText("Draft context staged for coverage follow-up"),
  ).toBeVisible();
  await expect(
    draftContext.getByText("Draft context staged for demo approval"),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "PTO requests" }).click();
  await expect(page).toHaveURL(/demoDecision=approve/);
  await expect(
    page.getByText(
      "No requests in this browser session match the current demo decision filter.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Clear the demo decision filter" }),
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

  await page.reload();
  await expect(page.getByText("Simulated decision: Defer")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Manager response draft context" })
      .getByText("Draft context is waiting for a demo action"),
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
