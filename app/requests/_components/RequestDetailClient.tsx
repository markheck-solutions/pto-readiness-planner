"use client";

import { useRef, useState, type MouseEvent } from "react";

import { useBrowserDecision } from "../../_components/BrowserDecisionProvider";
import { SimulatedDecisionControls } from "../../_components/SimulatedDecisionControls";
import {
  CoverageBadge,
  RecommendationBadge,
  RiskBadge,
} from "../../_components/StatusBadges";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { ManagerDraftPanel } from "./ManagerDraftPanel";

import type { PtoRequestAssessment } from "../../../src/domain/assessment/createRequestAssessment";
import { parseIsoDate, type IsoDate } from "../../../src/domain/dates";
import {
  buildSimulationDraftContext,
  type DemoDecision,
} from "../../../src/domain/simulation";

type BackupOption = {
  id: string;
  displayName: string;
  available: boolean;
  note: string;
};

type DetailDrawerState = {
  reasonSummary: string;
  evidenceIds: string[];
};

type RequestDetailClientProps = {
  request: {
    id: string;
    requestType: string;
    status: string;
    requestedStartDate: IsoDate;
    requestedEndDate: IsoDate;
    submittedAt: string;
    employeeNote: string;
    managerContext: string;
  };
  employee: {
    id: string;
    displayName: string;
  };
  team: {
    id: string;
    name: string;
  };
  role: {
    id: string;
    name: string;
  };
  assessment: PtoRequestAssessment;
  backupOptions: BackupOption[];
};

function formatShortDay(iso: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(iso));
}

function formatSubmittedAt(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function requestDateLabel(request: RequestDetailClientProps["request"]) {
  if (request.requestedStartDate === request.requestedEndDate) {
    return formatShortDay(request.requestedStartDate);
  }
  return `${formatShortDay(request.requestedStartDate)} to ${formatShortDay(request.requestedEndDate)}`;
}

function conflictTitle(
  conflict: PtoRequestAssessment["conflicts"]["items"][number],
): string {
  if (conflict.kind === "critical_window")
    return `${conflict.title} (${conflict.windowKind})`;
  if (conflict.kind === "overlapping_absence")
    return `${conflict.employeeDisplayName} already has an overlapping absence`;
  if (conflict.kind === "overlapping_request")
    return `${conflict.employeeDisplayName} has another overlapping request`;
  return "Short notice";
}

function conflictDetails(
  conflict: PtoRequestAssessment["conflicts"]["items"][number],
): string {
  if (conflict.kind === "critical_window")
    return `${formatShortDay(conflict.startDate)} to ${formatShortDay(conflict.endDate)} · ${conflict.description}`;
  if (conflict.kind === "overlapping_absence")
    return `${formatShortDay(conflict.startDate)} to ${formatShortDay(conflict.endDate)} · ${conflict.note}`;
  if (conflict.kind === "overlapping_request")
    return `${formatShortDay(conflict.startDate)} to ${formatShortDay(conflict.endDate)} · Status: ${conflict.status}`;
  return `${conflict.leadDays} day(s) lead time · ${conflict.note}`;
}

function conflictKey(
  conflict: PtoRequestAssessment["conflicts"]["items"][number],
) {
  if (conflict.kind === "critical_window") return conflict.windowId;
  if (conflict.kind === "overlapping_absence") return conflict.absenceId;
  if (conflict.kind === "overlapping_request") return conflict.requestId;
  return `${conflict.kind}-${conflict.leadDays}`;
}

function backupNote(option: BackupOption): string {
  return option.available ? option.note : `Not available: ${option.note}`;
}

function hasInstructionLikeContext(values: string[]): boolean {
  return values.some((value) =>
    /\b(ignore|announce|reveal|override|pretend|instruction)\b/i.test(value),
  );
}

function availableBackupOptions(options: BackupOption[]) {
  return options.filter((option) => option.available);
}

function topReasonSummary(assessment: PtoRequestAssessment) {
  return (
    assessment.reasons[0]?.summary ??
    "No additional coverage reasoning is staged for this request yet."
  );
}

function draftContextFor(args: {
  decision: DemoDecision;
  employeeName: string;
  teamName: string;
  roleName: string;
  request: RequestDetailClientProps["request"];
  assessment: PtoRequestAssessment;
  availableBackupCount: number;
}) {
  const { decision, employeeName, teamName, roleName, request, assessment } =
    args;

  return buildSimulationDraftContext({
    decision,
    employeeName,
    teamName,
    roleName,
    requestedStartDate: request.requestedStartDate,
    requestedEndDate: request.requestedEndDate,
    band: assessment.band,
    recommendation: assessment.recommendation,
    topReason: topReasonSummary(assessment),
    conflictCount: assessment.conflicts.items.length,
    availableBackupCount: args.availableBackupCount,
  });
}

function drawerKey(requestId: string, drawerState: DetailDrawerState | null) {
  if (!drawerState) return `${requestId}:closed`;
  return `${requestId}:${drawerState.evidenceIds.join("|")}:${drawerState.reasonSummary}`;
}

function RequestContextSection({
  request,
  employee,
  team,
  role,
}: Pick<RequestDetailClientProps, "request" | "employee" | "team" | "role">) {
  const showInstructionSafetyNote = hasInstructionLikeContext([
    request.employeeNote,
    request.managerContext,
  ]);

  return (
    <section
      aria-label="Request context"
      className="mt-8 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Request
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {employee.displayName}
        </h2>
        <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Request {request.id}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Dates
        </div>
        <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {requestDateLabel(request)}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Team
        </div>
        <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {team.name}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Role
        </div>
        <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {role.name}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Request type
        </div>
        <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          {request.requestType.toUpperCase()} · Status: {request.status}
        </div>
      </div>
      <div className="sm:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Submitted
            </div>
            <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              {formatSubmittedAt(request.submittedAt)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Demo posture
            </div>
            <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              Fictional data only, no login, no live HR workflow.
            </div>
          </div>
        </div>
      </div>

      <div className="sm:col-span-2">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Context notes
        </div>
        {showInstructionSafetyNote ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Safety note
            </div>
            <p className="mt-1 leading-6">
              Instruction-like wording stays visible as fictional request
              context only. Drafts treat it as untrusted data and do not follow
              it.
            </p>
          </div>
        ) : null}
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Manager context
            </div>
            <p className="mt-1 leading-6">{request.managerContext}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Employee note
            </div>
            <p className="mt-1 leading-6">{request.employeeNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoverageSnapshotSection({
  assessment,
}: {
  assessment: PtoRequestAssessment;
}) {
  return (
    <section aria-label="Coverage readiness snapshot" className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Coverage readiness snapshot
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            Deterministic assessment tied to seeded coverage facts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RiskBadge band={assessment.band} score={assessment.score} />
          <RecommendationBadge recommendation={assessment.recommendation} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-3">
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Score
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {assessment.score}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Coverage status
          </div>
          <div className="mt-2">
            <CoverageBadge
              comparison={assessment.coverage.comparison}
              singlePersonExposure={assessment.coverage.singlePersonExposure}
              available={assessment.coverage.minAvailable}
              required={assessment.coverage.required}
            />
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Coverage window
          </div>
          <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            {formatShortDay(assessment.coverage.range.start)} to{" "}
            {formatShortDay(assessment.coverage.range.end)}
          </div>
        </div>
      </div>
    </section>
  );
}

function RecommendationReasonsSection({
  assessment,
  drawerState,
  openEvidence,
}: {
  assessment: PtoRequestAssessment;
  drawerState: DetailDrawerState | null;
  openEvidence: (
    reasonSummary: string,
    evidenceIds: string[],
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
}) {
  return (
    <section aria-label="Recommendation reasons" className="mt-10">
      <div>
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Recommendation reasons
        </h3>
        <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Each reason traces back to seeded facts. Open evidence to inspect the
          supporting details.
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {assessment.reasons.map((reason) => (
          <li
            key={reason.code}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {reason.code}
                </div>
                <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {reason.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={(event) =>
                  openEvidence(reason.summary, reason.evidenceIds, event)
                }
                aria-haspopup="dialog"
                aria-controls="evidence-drawer-panel"
                aria-expanded={drawerState?.reasonSummary === reason.summary}
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-50 dark:hover:bg-zinc-900"
              >
                Show evidence for {reason.summary}
              </button>
            </div>
            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Evidence items: {reason.evidenceIds.length}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConflictsSection({
  assessment,
}: {
  assessment: PtoRequestAssessment;
}) {
  if (assessment.conflicts.items.length === 0) {
    return (
      <section aria-label="Conflicts and critical windows" className="mt-10">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Conflicts and critical windows
        </h3>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          No conflicts in this request.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Conflicts and critical windows" className="mt-10">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        Conflicts and critical windows
      </h3>
      <ul className="mt-4 space-y-3">
        {assessment.conflicts.items.map((conflict) => (
          <li
            key={conflictKey(conflict)}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {conflictTitle(conflict)}
            </div>
            <div className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {conflictDetails(conflict)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BackupOptionsList({ options }: { options: BackupOption[] }) {
  if (options.length === 0) {
    return (
      <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        No same-role backup exists for this request in the demo data.
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-2">
      {options.map((option) => (
        <li
          key={option.id}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300"
        >
          <div className="font-medium text-zinc-950 dark:text-zinc-50">
            {option.displayName}
          </div>
          <div className="mt-1 text-xs">{backupNote(option)}</div>
        </li>
      ))}
    </ul>
  );
}

function BackupOptionsSection({
  assessment,
  backupOptions,
}: {
  assessment: PtoRequestAssessment;
  backupOptions: BackupOption[];
}) {
  const availableBackups = availableBackupOptions(backupOptions);

  return (
    <section aria-label="Backup options" className="mt-10">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        Backup options and role coverage
      </h3>
      <div className="mt-4 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 lg:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Role coverage depth
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {assessment.coverage.required} required,{" "}
            {assessment.coverage.minAvailable} available at the tightest point
            in this range.
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {availableBackups.length > 0
              ? "Named backups are available for this demo set."
              : "No same-role backup is available in this demo set."}
          </p>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Backup options
          </div>
          <BackupOptionsList options={backupOptions} />
        </div>
      </div>
    </section>
  );
}

function FairnessSection({ assessment }: { assessment: PtoRequestAssessment }) {
  return (
    <section aria-label="Fairness context" className="mt-10">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        Fairness context
      </h3>
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {assessment.fairness.note}
        </p>
        <ul className="mt-4 space-y-2">
          {assessment.fairness.signals.map((signal) => (
            <li
              key={signal.kind}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300"
            >
              {signal.message}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DemoActionsSection({
  requestId,
  decision,
  assessment,
  draftContext,
}: {
  requestId: string;
  decision: DemoDecision;
  assessment: PtoRequestAssessment;
  draftContext: ReturnType<typeof buildSimulationDraftContext>;
}) {
  return (
    <section aria-label="Demo actions" className="mt-10 max-w-3xl">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        Manager actions (demo only)
      </h3>
      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        These controls update browser-only demo state. The queue, demo filters,
        and draft context below update in-session only. Nothing is saved and a
        refresh clears it.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <SimulatedDecisionControls requestId={requestId} />
        </div>

        <ManagerDraftPanel
          requestId={requestId}
          decision={decision}
          recommendation={assessment.recommendation}
          draftContext={draftContext}
        />
      </div>
    </section>
  );
}

export function RequestDetailClient({
  request,
  employee,
  team,
  role,
  assessment,
  backupOptions,
}: RequestDetailClientProps) {
  const [drawerState, setDrawerState] = useState<DetailDrawerState | null>(
    null,
  );
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const { decision } = useBrowserDecision(request.id);
  const availableBackups = availableBackupOptions(backupOptions);
  const draftContext = draftContextFor({
    decision,
    employeeName: employee.displayName,
    teamName: team.name,
    roleName: role.name,
    request,
    assessment,
    availableBackupCount: availableBackups.length,
  });

  const openEvidence = (
    reasonSummary: string,
    evidenceIds: string[],
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    openerRef.current = event.currentTarget;
    setDrawerState({ reasonSummary, evidenceIds });
  };

  const closeEvidence = () => {
    setDrawerState(null);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  };

  return (
    <>
      <RequestContextSection
        request={request}
        employee={employee}
        team={team}
        role={role}
      />
      <CoverageSnapshotSection assessment={assessment} />
      <RecommendationReasonsSection
        assessment={assessment}
        drawerState={drawerState}
        openEvidence={openEvidence}
      />
      <ConflictsSection assessment={assessment} />
      <BackupOptionsSection
        assessment={assessment}
        backupOptions={backupOptions}
      />
      <FairnessSection assessment={assessment} />
      <DemoActionsSection
        requestId={request.id}
        decision={decision}
        assessment={assessment}
        draftContext={draftContext}
      />
      <EvidenceDrawer
        key={drawerKey(request.id, drawerState)}
        open={drawerState !== null}
        requestId={request.id}
        reasonSummary={drawerState?.reasonSummary ?? null}
        evidenceIds={drawerState?.evidenceIds ?? []}
        onClose={closeEvidence}
      />
    </>
  );
}
