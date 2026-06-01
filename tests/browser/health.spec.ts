import { test, expect } from "@playwright/test";

test("health endpoint reports safe demo posture", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);

  const json = (await res.json()) as unknown;
  expect(json).toEqual(
    expect.objectContaining({
      service: "pto-readiness-planner",
      status: "ok",
      demoMode: true,
      capabilities: expect.any(Object),
      build: expect.any(Object),
    }),
  );
});
