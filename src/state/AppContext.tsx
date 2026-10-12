import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';
import { seedDemoData } from '../data/demoSeed';
import { buildDailyRecords, getProgramStatus, type DailyRecord, type PatientData, type ProgramStatus } from '../domain/dailyRecords';
import { toIsoDate, type IsoDate } from '../domain/dates';
import { createAppServices, type AppServices } from '../services/appServices';
import type { User } from '../services/auth/AuthService';
import { syncPlan, type SyncResult } from '../services/plans/syncPlan';

export interface PlanSyncState {
  checking: boolean;
  /** ISO timestamp of the last completed check. */
  lastChecked: string | null;
  lastResult: SyncResult | null;
}

/** Test credentials for the Jamboree demo account (synthetic data only). */
export const DEMO_ACCOUNT = { email: 'demo@lutealine.app', password: 'lutealine-demo', name: 'Demo Patient' };

interface AppState {
  ready: boolean;
  services: AppServices | null;
  user: User | null;
  data: PatientData | null;
  /** Daily records from the start of monitoring until today. */
  records: DailyRecord[];
  status: ProgramStatus | null;
  today: IsoDate;
  refresh(): Promise<void>;
  setUser(user: User | null): void;
  signOut(): Promise<void>;
  startDemo(): Promise<void>;
  resetEverything(): Promise<void>;
  planSync: PlanSyncState;
  /** Asks the plan server for a new physician plan (also runs on start and when the app returns to the foreground). */
  checkForPlan(): Promise<SyncResult>;
  /** The patient confirms the pending physician plan. */
  acceptPendingPlan(): Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<AppServices | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<PatientData | null>(null);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(toIsoDate());
  const [planSync, setPlanSync] = useState<PlanSyncState>({ checking: false, lastChecked: null, lastResult: null });
  const checking = useRef(false);

  const load = useCallback(async (s: AppServices) => {
    setToday(toIsoDate());
    setData(await s.repository.loadPatientData());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await createAppServices();
      const u = await s.auth.getCurrentUser();
      if (cancelled) return;
      setServices(s);
      setUser(u);
      await load(s);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    if (services) await load(services);
  }, [services, load]);

  const signOut = useCallback(async () => {
    await services?.auth.signOut();
    setUser(null);
  }, [services]);

  const startDemo = useCallback(async () => {
    if (!services) return;
    await services.auth.deleteAccount();
    await services.repository.clearAll();
    const u = await services.auth.signUp(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password, DEMO_ACCOUNT.name);
    await seedDemoData(services.store, { today: toIsoDate() });
    setUser(u);
    await load(services);
  }, [services, load]);

  const resetEverything = useCallback(async () => {
    if (!services) return;
    await services.repository.clearAll();
    await services.auth.deleteAccount();
    setUser(null);
    await load(services);
  }, [services, load]);

  const checkForPlan = useCallback(async (): Promise<SyncResult> => {
    if (!services || checking.current) return planSync.lastResult ?? { status: 'upToDate' };
    checking.current = true;
    setPlanSync((p) => ({ ...p, checking: true }));
    const result = await syncPlan(services.repository, services.remotePlans);
    if (result.status === 'newPlan') await load(services);
    setPlanSync({ checking: false, lastChecked: new Date().toISOString(), lastResult: result });
    checking.current = false;
    return result;
  }, [services, load, planSync.lastResult]);

  const acceptPendingPlan = useCallback(async () => {
    if (!services) return;
    await services.repository.acceptPendingPlan(toIsoDate());
    await load(services);
  }, [services, load]);

  // Check for a new physician plan once signed in, and whenever the app comes back to the foreground.
  const hasProfile = !!data;
  const checkRef = useRef(checkForPlan);
  checkRef.current = checkForPlan;
  useEffect(() => {
    if (!ready || !user || !hasProfile) return;
    checkRef.current();
    const sub = RNAppState.addEventListener('change', (state) => {
      if (state === 'active') checkRef.current();
    });
    return () => sub.remove();
  }, [ready, user, hasProfile]);

  const { records, status } = useMemo(() => {
    if (!data) return { records: [], status: null };
    const from = [data.profile.monitoringStartDate, ...data.periodStarts].sort()[0];
    return {
      records: from <= today ? buildDailyRecords(data, from, today) : [],
      status: getProgramStatus(data, today),
    };
  }, [data, today]);

  const value: AppState = {
    ready,
    services,
    user,
    data,
    records,
    status,
    today,
    refresh,
    setUser,
    signOut,
    startDemo,
    resetEverything,
    planSync,
    checkForPlan,
    acceptPendingPlan,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/** Services, for screens that only render once the app is ready. */
export function useServices(): AppServices {
  const { services } = useApp();
  if (!services) throw new Error('Services not ready');
  return services;
}
