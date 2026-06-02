export const reviewFilterKeys = [
  "teamId",
  "roleId",
  "requestType",
  "status",
  "coverageBand",
  "conflictLevel",
  "weekStart",
  "startDate",
  "endDate",
  "sort",
  "dir",
] as const

export type ReviewFilterKey = (typeof reviewFilterKeys)[number]

export type ReviewFilterQuery = Partial<Record<ReviewFilterKey, string>>

type SearchParamsRecord = Record<string, string | string[] | undefined>

type SearchParamsLike =
  | SearchParamsRecord
  | URLSearchParams
  | { get: (name: string) => string | null }

function asString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function hasSearchGetter(
  value: SearchParamsLike,
): value is URLSearchParams | { get: (name: string) => string | null } {
  return typeof value === "object" && value !== null && "get" in value
}

export function readReviewFilterQuery(
  source: SearchParamsLike,
): ReviewFilterQuery {
  const query: ReviewFilterQuery = {}

  for (const key of reviewFilterKeys) {
    const value = hasSearchGetter(source)
      ? source.get(key) ?? undefined
      : asString(source[key])

    if (!value) continue
    query[key] = value
  }

  return query
}

export function writeReviewFilterQuery(
  query: ReviewFilterQuery,
): URLSearchParams {
  const params = new URLSearchParams()

  for (const key of reviewFilterKeys) {
    const value = query[key]
    if (!value) continue
    params.set(key, value)
  }

  return params
}

export function buildReviewHref(
  pathname: string,
  query: ReviewFilterQuery,
): string {
  const params = writeReviewFilterQuery(query)
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export function withSelectedWeekRange(
  query: ReviewFilterQuery,
  weekStart: string,
  weekEnd: string,
): ReviewFilterQuery {
  return {
    ...query,
    weekStart,
    startDate: weekStart,
    endDate: weekEnd,
  }
}

export function withoutSelectedWeekRange(
  query: ReviewFilterQuery,
): ReviewFilterQuery {
  const next = { ...query }
  delete next.weekStart
  delete next.startDate
  delete next.endDate
  return next
}

export function withWeekStartFromDateRange(
  query: ReviewFilterQuery,
): ReviewFilterQuery {
  if (query.weekStart || !query.startDate) return { ...query }

  return {
    ...query,
    weekStart: query.startDate,
  }
}

export function withDefaultQueueSort(
  query: ReviewFilterQuery,
): ReviewFilterQuery {
  return {
    ...query,
    sort: query.sort ?? "risk",
    dir: query.dir ?? "desc",
  }
}
