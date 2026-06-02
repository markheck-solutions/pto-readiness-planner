import { expect, test } from "@playwright/test";

test("mock drafts react to request and action context without provider controls", async ({
  page,
}) => {
  await page.goto("/requests/REQ-1001");

  const draftPanel = page.getByRole("region", {
    name: "Manager response draft context",
  });
  await expect(
    draftPanel.getByText("Stage a demo action to generate a response draft."),
  ).toBeVisible();
  await expect(draftPanel.getByRole("combobox")).toHaveCount(0);

  await page.getByRole("button", { name: "Approve (demo)" }).click();
  await page
    .getByRole("button", { name: "Generate conditional approval draft" })
    .click();
  await expect(draftPanel.getByText("Avery Park")).toBeVisible();
  await expect(draftPanel.getByText(/backup/i)).toBeVisible();
  await expect(draftPanel.getByText(/handoff/i)).toBeVisible();

  const approvalDraft = await draftPanel
    .getByLabel("Generated manager response draft")
    .innerText();

  await page.getByRole("link", { name: "PTO requests" }).click();
  await page.getByRole("link", { name: /Sam Rivera.*REQ-1003/ }).click();
  await page.getByRole("button", { name: "Approve (demo)" }).click();
  await page.getByRole("button", { name: "Generate approval draft" }).click();

  const healthyApprovalDraft = await draftPanel
    .getByLabel("Generated manager response draft")
    .innerText();
  expect(healthyApprovalDraft).toContain("Sam Rivera");
  expect(healthyApprovalDraft).toContain("Jul 15 to Jul 19");
  expect(healthyApprovalDraft).not.toBe(approvalDraft);

  await page.getByRole("button", { name: "Ask for coverage (demo)" }).click();
  await page
    .getByRole("button", { name: "Generate coverage follow-up draft" })
    .click();
  const askDraft = await draftPanel
    .getByLabel("Generated manager response draft")
    .innerText();
  expect(askDraft).toContain("please confirm");
  expect(askDraft).not.toBe(healthyApprovalDraft);
});

test("generated drafts stay transient and reset on refresh", async ({
  page,
}) => {
  await page.goto("/requests/REQ-1002");
  const draftPanel = page.getByRole("region", {
    name: "Manager response draft context",
  });

  await page.getByRole("button", { name: "Defer (demo)" }).click();
  await page.getByRole("button", { name: "Generate defer draft" }).click();
  await expect(
    draftPanel.getByLabel("Generated manager response draft"),
  ).toContainText("Jordan Kim");
  await expect(
    draftPanel.getByLabel("Generated manager response draft"),
  ).toContainText(/defer/i);

  await page.reload();

  await expect(
    draftPanel.getByText("Stage a demo action to generate a response draft."),
  ).toBeVisible();
  await expect(
    draftPanel.getByLabel("Generated manager response draft"),
  ).toHaveCount(0);
});
