import { describe, expect, it } from "vitest"

import {
  buildReviewHref,
  readReviewFilterQuery,
  withDefaultQueueSort,
  withSelectedWeekRange,
} from "../../../src/domain/reviewFilters"

describe("review filter contract", () => {
  it("reads refresh-safe filter keys and ignores demoDecision", () => {
    const query = readReviewFilterQuery(
      new URLSearchParams(
        "teamId=team_customer_support&roleId=role_support_lead&status=approved&demoDecision=approve&sort=start_date&dir=asc",
      ),
    )

    expect(query).toEqual({
      teamId: "team_customer_support",
      roleId: "role_support_lead",
      status: "approved",
      sort: "start_date",
      dir: "asc",
    })
  })

  it("preserves existing filters when a selected heatmap week is applied", () => {
    expect(
      withSelectedWeekRange(
        {
          teamId: "team_customer_support",
          roleId: "role_support_lead",
          requestType: "training",
          status: "approved",
          coverageBand: "risky",
          conflictLevel: "none",
          sort: "start_date",
          dir: "asc",
        },
        "2026-06-17",
        "2026-06-23",
      ),
    ).toEqual({
      teamId: "team_customer_support",
      roleId: "role_support_lead",
      requestType: "training",
      status: "approved",
      coverageBand: "risky",
      conflictLevel: "none",
      weekStart: "2026-06-17",
      startDate: "2026-06-17",
      endDate: "2026-06-23",
      sort: "start_date",
      dir: "asc",
    })
  })

  it("builds stable review links with queue sort defaults", () => {
    const href = buildReviewHref(
      "/requests",
      withDefaultQueueSort({
        teamId: "team_release_ops",
        status: "pending",
      }),
    )

    expect(href).toBe(
      "/requests?teamId=team_release_ops&status=pending&sort=risk&dir=desc",
    )
  })
})
