import type { ExplorerOperationType, JobId, SortSpec } from "$lib/types/explorer";

const DEV_TRACE_ENABLED = import.meta.env.DEV;
const ROW_VISIBILITY_GRACE_MS = 500;

type ExplorerTraceOutcome = "completed" | "failed" | "cancelled";
type ExplorerTraceStage =
  | "intent_start"
  | "state_loading_committed"
  | "invoke_start"
  | "invoke_resolved"
  | "first_chunk_received"
  | "swap_complete"
  | "first_rows_visible";
type ExplorerLoadingVisual = "pane" | "progress" | "toolbar_cancel" | "toolbar_refresh";

type ExplorerBackendTimings = {
  cacheHit: boolean;
  resolveSnapshotMs: number;
  enumerateFsMs: number | null;
  enumerateEntriesMs: number | null;
  iconLookupTotalMs: number | null;
  iconLookupCount: number | null;
  iconEncodeTotalMs: number | null;
  snapshotBuildMs: number | null;
  projectMs: number;
  firstChunkSendMs: number | null;
  allChunksSentMs: number;
  totalBackendMs: number;
};

type ExplorerTraceStageRecord = {
  at: number;
  details?: Record<string, unknown>;
};

type ExplorerLoadingVisualRecord = {
  eligibleAt?: number;
  details?: Record<string, unknown>;
};

type ExplorerTrace = {
  jobId: JobId;
  tabId: string;
  path: string;
  query: string;
  sort: SortSpec;
  operationType: ExplorerOperationType;
  startedAt: number;
  stages: Partial<Record<ExplorerTraceStage, ExplorerTraceStageRecord>>;
  loadingVisuals: Partial<Record<ExplorerLoadingVisual, ExplorerLoadingVisualRecord>>;
  backendTimings?: ExplorerBackendTimings;
  terminalOutcome?: ExplorerTraceOutcome;
  error?: Record<string, unknown>;
  awaitingVisibleRows: boolean;
  flushTimer: ReturnType<typeof setTimeout> | null;
  flushed: boolean;
};

const traces = new Map<JobId, ExplorerTrace>();

export function isExplorerTimingTraceEnabled() {
  return DEV_TRACE_ENABLED;
}

export function startExplorerTrace(input: {
  jobId: JobId;
  tabId: string;
  path: string;
  query: string;
  sort: SortSpec;
  operationType: ExplorerOperationType;
}) {
  if (!DEV_TRACE_ENABLED) {
    return;
  }

  const trace: ExplorerTrace = {
    ...input,
    startedAt: performance.now(),
    stages: {},
    loadingVisuals: {},
    awaitingVisibleRows: false,
    flushTimer: null,
    flushed: false
  };

  trace.stages.intent_start = { at: trace.startedAt };
  traces.set(input.jobId, trace);
}

export function updateExplorerTraceOperation(jobId: JobId, operationType: ExplorerOperationType) {
  const trace = traces.get(jobId);
  if (!trace || trace.flushed) {
    return;
  }

  trace.operationType = operationType;
}

export function markExplorerTraceStage(
  jobId: JobId,
  stage: ExplorerTraceStage,
  details?: Record<string, unknown>
) {
  const trace = traces.get(jobId);
  if (!trace || trace.flushed || trace.stages[stage]) {
    return;
  }

  trace.stages[stage] = { at: performance.now(), details };
}

export function markExplorerLoadingVisual(
  jobId: JobId | null | undefined,
  visual: ExplorerLoadingVisual,
  details?: Record<string, unknown>
) {
  if (!jobId) {
    return;
  }

  const trace = traces.get(jobId);
  if (!trace || trace.flushed) {
    return;
  }

  if (trace.loadingVisuals[visual]?.eligibleAt) {
    return;
  }

  trace.loadingVisuals[visual] = {
    eligibleAt: performance.now(),
    details
  };
}

export function completeExplorerTrace(
  jobId: JobId,
  input: {
    outcome: ExplorerTraceOutcome;
    backendTimings?: ExplorerBackendTimings;
    error?: Record<string, unknown>;
  }
) {
  const trace = traces.get(jobId);
  if (!trace || trace.flushed) {
    return;
  }

  trace.terminalOutcome = input.outcome;
  trace.backendTimings = input.backendTimings;
  trace.error = input.error;

  if (input.outcome === "completed") {
    trace.awaitingVisibleRows = true;
    scheduleTraceFlush(trace, ROW_VISIBILITY_GRACE_MS);
    return;
  }

  scheduleTraceFlush(trace, 0);
}

export function markExplorerTraceRowsVisible(jobId: JobId | null | undefined, details?: Record<string, unknown>) {
  if (!jobId) {
    return;
  }

  const trace = traces.get(jobId);
  if (!trace || trace.flushed || !trace.awaitingVisibleRows) {
    return;
  }

  markExplorerTraceStage(trace.jobId, "first_rows_visible", details);
  trace.awaitingVisibleRows = false;
  scheduleTraceFlush(trace, 0);
}

function scheduleTraceFlush(trace: ExplorerTrace, delayMs: number) {
  if (trace.flushTimer) {
    clearTimeout(trace.flushTimer);
  }

  trace.flushTimer = setTimeout(() => {
    trace.flushTimer = null;
    flushTrace(trace.jobId);
  }, delayMs);
}

function flushTrace(jobId: JobId) {
  const trace = traces.get(jobId);
  if (!trace || trace.flushed || !trace.terminalOutcome) {
    return;
  }

  trace.flushed = true;

  const stageRows = buildStageRows(trace);
  const loadingVisualRows = buildLoadingVisualRows(trace);
  const totalFrontendMs = Math.round((performance.now() - trace.startedAt) * 100) / 100;
  const label = `[explorer-trace] ${trace.terminalOutcome} ${trace.operationType} ${trace.jobId}`;

  console.groupCollapsed(label);
  console.log("summary", {
    jobId: trace.jobId,
    tabId: trace.tabId,
    path: trace.path,
    query: trace.query,
    sort: `${trace.sort.field}:${trace.sort.direction}`,
    operationType: trace.operationType,
    outcome: trace.terminalOutcome,
    totalFrontendMs,
    backendTotalMs: trace.backendTimings?.totalBackendMs ?? null,
    cacheHit: trace.backendTimings?.cacheHit ?? null
  });
  console.table(stageRows);
  console.table(loadingVisualRows);
  if (trace.backendTimings) {
    console.log("backend", trace.backendTimings);
  }
  if (trace.error) {
    console.log("error", trace.error);
  }
  console.groupEnd();

  traces.delete(jobId);
}

function buildStageRows(trace: ExplorerTrace) {
  return [
    "intent_start",
    "state_loading_committed",
    "invoke_start",
    "invoke_resolved",
    "first_chunk_received",
    "swap_complete",
    "first_rows_visible"
  ].map((stage) => {
    const entry = trace.stages[stage as ExplorerTraceStage];
    return {
      stage,
      msFromIntent: entry ? roundMs(entry.at - trace.startedAt) : null,
      ...entry?.details
    };
  });
}

function buildLoadingVisualRows(trace: ExplorerTrace) {
  return ["pane", "progress", "toolbar_cancel", "toolbar_refresh"].map((visual) => {
    const entry = trace.loadingVisuals[visual as ExplorerLoadingVisual];
    return {
      visual,
      eligibleAtMs: entry?.eligibleAt ? roundMs(entry.eligibleAt - trace.startedAt) : null,
      ...entry?.details
    };
  });
}

function roundMs(value: number) {
  return Math.round(value * 100) / 100;
}
