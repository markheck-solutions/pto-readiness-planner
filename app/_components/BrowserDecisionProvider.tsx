"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { DemoDecision } from "../../src/domain/simulation";

type DecisionMap = Record<string, DemoDecision>;

type BrowserDecisionContextValue = {
  decisions: DecisionMap;
  decisionFilter: DemoDecision | null;
  getDecision: (requestId: string) => DemoDecision;
  setDecision: (requestId: string, decision: DemoDecision) => void;
  clearDecision: (requestId: string) => void;
  setDecisionFilter: (decision: DemoDecision | null) => void;
  clearDecisionFilter: () => void;
};

const BrowserDecisionContext =
  createContext<BrowserDecisionContextValue | null>(null);

function useBrowserDecisionContext(): BrowserDecisionContextValue {
  const context = useContext(BrowserDecisionContext);
  if (!context) {
    throw new Error(
      "useBrowserDecision must be used within BrowserDecisionProvider.",
    );
  }

  return context;
}

export function BrowserDecisionProvider({ children }: { children: ReactNode }) {
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [decisionFilter, setDecisionFilter] = useState<DemoDecision | null>(
    null,
  );

  const setDecision = useCallback(
    (requestId: string, decision: DemoDecision) => {
      setDecisions((current) => ({ ...current, [requestId]: decision }));
    },
    [],
  );

  const clearDecision = useCallback((requestId: string) => {
    setDecisions((current) => {
      if (!(requestId in current)) return current;
      const next = { ...current };
      delete next[requestId];
      return next;
    });
  }, []);

  const clearDecisionFilter = useCallback(() => {
    setDecisionFilter(null);
  }, []);

  const value = useMemo<BrowserDecisionContextValue>(
    () => ({
      decisions,
      decisionFilter,
      getDecision: (requestId: string) => decisions[requestId] ?? "none",
      setDecision,
      clearDecision,
      setDecisionFilter,
      clearDecisionFilter,
    }),
    [
      clearDecision,
      clearDecisionFilter,
      decisionFilter,
      decisions,
      setDecision,
      setDecisionFilter,
    ],
  );

  return (
    <BrowserDecisionContext.Provider value={value}>
      {children}
    </BrowserDecisionContext.Provider>
  );
}

export function useBrowserDecision(requestId: string) {
  const context = useBrowserDecisionContext();

  const decision = context.getDecision(requestId);
  return {
    decision,
    setDecision: context.setDecision,
    clearDecision: context.clearDecision,
    decisionFilter: context.decisionFilter,
    setDecisionFilter: context.setDecisionFilter,
    clearDecisionFilter: context.clearDecisionFilter,
  };
}

export function useBrowserDecisions() {
  return useBrowserDecisionContext();
}
