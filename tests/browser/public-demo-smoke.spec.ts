import { expect, test } from "@playwright/test";

test("public demo review flow stays no-login and mock only", async ({
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
    page.getByRole("link", { name: "Review critical requests" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Review critical requests" }).click();
  await expect(
    page.getByRole("heading", { name: "PTO request queue" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();

  await page.goto("/requests/REQ-1001");

  await expect(page.getByRole("heading", { name: "Avery Park" })).toBeVisible();

  const firstEvidenceButton = page
    .getByRole("button", { name: /Show evidence for/ })
    .first();
  await firstEvidenceButton.click();

  await expect(
    page.getByRole("dialog", { name: "Evidence drawer" }),
  ).toBeVisible();
  await expect(
    page.getByText("Coverage requirement", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close evidence drawer" }).click();

  const draftPanel = page.getByRole("region", {
    name: "Manager response draft context",
  });
  await page.getByRole("button", { name: "Approve (demo)" }).click();
  await expect(
    draftPanel.getByText("Draft context staged for demo approval"),
  ).toBeVisible();
  await expect(draftPanel.getByRole("combobox")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Generate conditional approval draft" })
    .click();

  const draftOutput = draftPanel.getByLabel("Generated manager response draft");
  await expect(draftOutput).toContainText("Avery Park");
  await expect(draftOutput).toContainText(/handoff/i);
  await expect(draftOutput).toContainText(/backup/i);

  const draftText = (await draftOutput.innerText()).toLowerCase();
  expect(draftText).not.toContain("saved");
  expect(draftText).not.toContain("sent");
  expect(page.url().toLowerCase()).not.toContain("login");
  expect(page.url().toLowerCase()).not.toContain("signin");
});

test("direct queue, heatmap, and detail routes load without auth redirects", async ({
  page,
}) => {
  await page.goto("/requests");
  await expect(
    page.getByRole("heading", { name: "PTO request queue" }),
  ).toBeVisible();
  expect(page.url().toLowerCase()).not.toContain("login");

  await page.goto("/heatmap");
  await expect(
    page.getByRole("heading", { name: "Coverage heatmap" }),
  ).toBeVisible();
  expect(page.url().toLowerCase()).not.toContain("login");

  await page.goto("/requests/REQ-1003");
  await expect(page.getByRole("heading", { name: "Sam Rivera" })).toBeVisible();
  await expect(page.getByLabel("Demo Mode: fictional data only")).toBeVisible();
  expect(page.url().toLowerCase()).not.toContain("login");
});
