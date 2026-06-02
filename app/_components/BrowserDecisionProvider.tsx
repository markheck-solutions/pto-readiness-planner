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
  getDecision: (requestId: string) => DemoDecision;
  setDecision: (requestId: string, decision: DemoDecision) => void;
  clearDecision: (requestId: string) => void;
};

const BrowserDecisionContext =
  createContext<BrowserDecisionContextValue | null>(null);

export function BrowserDecisionProvider({ children }: { children: ReactNode }) {
  const [decisions, setDecisions] = useState<DecisionMap>({});

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

  const value = useMemo<BrowserDecisionContextValue>(
    () => ({
      decisions,
      getDecision: (requestId: string) => decisions[requestId] ?? "none",
      setDecision,
      clearDecision,
    }),
    [clearDecision, decisions, setDecision],
  );

  return (
    <BrowserDecisionContext.Provider value={value}>
      {children}
    </BrowserDecisionContext.Provider>
  );
}

export function useBrowserDecision(requestId: string) {
  const context = useContext(BrowserDecisionContext);
  if (!context) {
    throw new Error(
      "useBrowserDecision must be used within BrowserDecisionProvider.",
    );
  }

  const decision = context.getDecision(requestId);
  return {
    decision,
    setDecision: context.setDecision,
    clearDecision: context.clearDecision,
  };
}
