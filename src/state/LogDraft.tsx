import { createContext, useContext, useState, type ReactNode } from 'react';
import type { HormoneReading } from '../domain/models';
import type { Answers } from '../domain/scoring';

/** State shared across the steps of today's log (test → questionnaire → medication). */
interface LogDraft {
  reading: HormoneReading | null;
  setReading(r: HormoneReading | null): void;
  answers: Answers;
  setAnswers(update: (a: Answers) => Answers): void;
}

const LogDraftContext = createContext<LogDraft | null>(null);

export function LogDraftProvider({ children }: { children: ReactNode }) {
  const [reading, setReading] = useState<HormoneReading | null>(null);
  const [answers, setAnswersState] = useState<Answers>({});
  return (
    <LogDraftContext.Provider value={{ reading, setReading, answers, setAnswers: setAnswersState }}>
      {children}
    </LogDraftContext.Provider>
  );
}

export function useLogDraft(): LogDraft {
  const ctx = useContext(LogDraftContext);
  if (!ctx) throw new Error('useLogDraft must be used inside LogDraftProvider');
  return ctx;
}
