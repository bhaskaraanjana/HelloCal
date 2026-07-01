import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import type { MealLog, FoodItem, WorkoutLog, UserGoals, CoachPersonality, CoachResponse, AppSettings, WaterLog, BodyMetric, FavoriteFood, UserProfile, MealTemplate, Recipe, Supplement } from './types/nutrition';
import { storage } from './services/storage';
import { computeStreak, isSameLocalDay, dayRange } from './services/insights';
import { clampGoal, GOAL_BOUNDS, coerceFoodItem } from './services/validation';
import { sanitizeMealLogs, sanitizeWorkouts, sanitizeFavorites, sanitizeMealTemplates, sanitizeWaterLogs, sanitizeBodyMetrics, sanitizeRecipes, sanitizeSupplements } from './services/sanitize';
import { scaleNutrients, autoMealSlot } from './services/logMath';
import { copyAuxiliaryNutrients } from './services/nutrientValue';
import { isSupabaseConfigured, getAccountDetails, onAuthChange, signIn as cloudSignIn, signUp as cloudSignUp, signOut as cloudSignOut, signInWithGoogle, pushData as cloudPush, pullData as cloudPull, syncOnLogin, requestPasswordReset, detectSyncConflict, type CloudAccount } from './services/cloudSync';
import { isHostedAiAvailable, type AiAccess, type AiProvider } from './services/aiRuntime';
import type { CloudSyncStatus } from './components/AccountSection';
import { SyncConflictModal } from './components/SyncConflictModal';
import { initNative, haptic, hapticSuccess, isNative, scheduleMealReminders, scheduleSupplementReminders, requestNotificationPermission, showLocalNotification, parseHM } from './services/native';
import { Dashboard } from './components/Dashboard';
import { VoiceInput } from './components/VoiceInput';
import { FoodTimeline } from './components/FoodTimeline';
// Analytics pulls in Chart.js (~150KB gzip); load it only when the tab is opened.
const Analytics = React.lazy(() =>
  import('./components/Analytics').then((m) => ({ default: m.Analytics }))
);
import { Settings } from './components/Settings';
import { RefinementModal } from './components/RefinementModal';
import { Utensils, LayoutDashboard, BarChart2, Settings as SettingsIcon, Heart, CheckCircle, BookOpen, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Onboarding } from './components/Onboarding';
import { InstallPrompt } from './components/InstallPrompt';
import { MealTemplateBar } from './components/MealTemplateBar';
// RecipeBox is large + AI-driven; lazy-load it so it stays out of the initial bundle.
const RecipeBox = React.lazy(() =>
  import('./components/RecipeBox').then((m) => ({ default: m.RecipeBox }))
);

// Common foods seeded on first run for the favorites/recents model. Real logs
// naturally outrank and replace them over time.
const SEED_FAVORITES: Omit<FavoriteFood, 'id' | 'frequency' | 'lastLogged'>[] = [
  { name: 'Banana', quantity: '1 medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: 'Apple', quantity: '1 medium', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: 'Chicken Breast', quantity: '100 g', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'White Rice', quantity: '1 cup cooked', calories: 206, protein: 4.3, carbs: 45, fat: 0.4 },
  { name: 'Egg', quantity: '1 large', calories: 78, protein: 6, carbs: 0.6, fat: 5 },
  { name: 'Greek Yogurt', quantity: '170 g', calories: 100, protein: 17, carbs: 6, fat: 0.7 },
];

const NAV_TABS = [
  { key: 'timeline', label: 'Timeline', Icon: Utensils },
  { key: 'recipes', label: 'Recipes', Icon: BookOpen },
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'analytics', label: 'Analytics', Icon: BarChart2 },
  { key: 'settings', label: 'Settings', Icon: SettingsIcon },
] as const;

export const App: React.FC = () => {
  // 1. Core States loaded from localStorage on mount
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [goals, setGoals] = useState<UserGoals>({ calories: 2000, protein: 130, carbs: 220, fat: 65, addedSugar: 30, fiber: 30, sodium: 2300, waterTarget: 2500 });
  const [geminiKey, setGeminiKey] = useState('');
  const [coachPersonality, setCoachPersonality] = useState<CoachPersonality>('encouraging');

  // M4 feature collections
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [profile, setProfile] = useState<UserProfile>({});
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Dashboard Dynamic Customizer Layout settings state
  const [appSettings, setAppSettings] = useState<AppSettings>({
    theme: 'obsidian',
    visibleMacros: { protein: true, carbs: true, fat: true },
    visibleMicros: { addedSugar: true, fiber: true, sodium: true },
    visibleWidgets: { calorieHalo: true, macros: true, micros: true, workouts: false, mealSlots: true, goalCompletion: true, water: true, streak: true, supplements: true }
  });
  const [cloudAccount, setCloudAccount] = useState<CloudAccount | null>(null);
  const cloudAccountRef = useRef<CloudAccount | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>({ lastAt: null, syncing: false, error: null });
  const [syncConflictOpen, setSyncConflictOpen] = useState(false);
  const [syncConflictRemoteAt, setSyncConflictRemoteAt] = useState<string | null>(null);
  const [syncConflictBusy, setSyncConflictBusy] = useState(false);
  const importJsonRef = useRef<(json: string) => boolean>(() => false);
  const backupJsonRef = useRef('');

  // Loading indicator on first mount
  const [isLoaded, setIsLoaded] = useState(false);

  // Tab View
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'recipes' | 'analytics' | 'settings'>('dashboard');
  const [timelineFocusDate, setTimelineFocusDate] = useState<number | null>(null);

  // Refinement modal states
  const [refinementOpen, setRefinementOpen] = useState(false);
  const [stagedItems, setStagedItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [stagedWorkout, setStagedWorkout] = useState<Omit<WorkoutLog, 'id'> | null>(null);
  const [stagedLogType, setStagedLogType] = useState<'food' | 'workout' | 'mixed'>('food');
  const [stagedCoaching, setStagedCoaching] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [stagedMealType, setStagedMealType] = useState<MealLog['mealType'] | undefined>(undefined);
  const [stagedLogTimestamp, setStagedLogTimestamp] = useState<number | undefined>(undefined);

  // Floating notifications/toast state. Supports an optional inline action
  // (e.g. "Edit" after an instant-log) so the toast can offer a quick follow-up.
  const [toast, setToast] = useState<{ message: string; action?: { label: string; run: () => void } } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerToast = (message: string, action?: { label: string; run: () => void }) => {
    // Clear any in-flight dismissal so rapid successive toasts don't wipe each
    // other early (the old code left orphaned timeouts racing to null state).
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, action });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  }, []);

  // Fire confetti off the critical path so the logged-state UI paints first.
  const fireConfetti = (opts: Parameters<typeof confetti>[0]) => {
    const run = () => confetti(opts);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as Window & typeof globalThis).requestIdleCallback(run, { timeout: 500 });
    } else {
      setTimeout(run, 0);
    }
  };

  // Initialize
  useEffect(() => {
    storage.setErrorHandler((msg) => triggerToast(msg));
    storage.migrate();
    const data = storage.getData();
    setLogs(data.logs);
    setWorkouts(data.workouts || []);
    setGoals(data.goals);
    setGeminiKey(data.geminiKey);
    setCoachPersonality(data.coachPersonality);
    if (data.appSettings) {
      setAppSettings(data.appSettings);
    }
    setWaterLogs(data.waterLogs || []);
    setBodyMetrics(data.bodyMetrics || []);
    const favs = data.favorites || [];
    if (favs.length === 0 && (data.logs?.length || 0) === 0) {
      // Fresh install: seed starter favorites for the recents model.
      const seeded: FavoriteFood[] = SEED_FAVORITES.map((f, i) => ({
        ...f,
        id: `seed_${i}`,
        frequency: 0,
        lastLogged: 0,
      }));
      setFavorites(seeded);
      storage.saveFavorites(seeded);
    } else {
      setFavorites(favs);
    }
    setMealTemplates(data.mealTemplates || []);
    setRecipes(data.recipes || []);
    // Reset "taken today" for supplements last marked on a previous day.
    const now = Date.now();
    setSupplements((data.supplements || []).map((s) => ({
      ...s,
      takenToday: s.takenToday && !!s.lastTakenTimestamp && isSameLocalDay(s.lastTakenTimestamp, now),
    })));
    setProfile(data.profile || {});
    // First-run onboarding: only when no profile has been set up yet.
    if (!data.profile?.onboardingComplete) {
      setOnboardingOpen(true);
    }
    setIsLoaded(true);
    // Initialize native status bar / splash (no-op on web).
    initNative();

    // Honor PWA shortcut deep-links (?tab=analytics, ?action=log).
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'analytics' || tab === 'timeline' || tab === 'recipes' || tab === 'settings' || tab === 'dashboard') {
        setActiveTab(tab);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Sync theme class onto document.body whenever theme state updates
  useEffect(() => {
    document.body.className = `theme-${appSettings.theme}`;
  }, [appSettings.theme]);

  // Meal reminders: native schedules repeating local notifications; web fires
  // best-effort foreground nudges (only while the app is open, once per slot/day,
  // within 90 min of the slot time).
  useEffect(() => {
    const reminders = appSettings.reminders;
    if (!reminders?.enabled) return;
    if (isNative()) {
      scheduleMealReminders(reminders);
      return;
    }
    const slots: [string, string, string][] = [
      ['breakfast', reminders.breakfast, '🍳 Breakfast time'],
      ['lunch', reminders.lunch, '🥗 Lunch check-in'],
      ['dinner', reminders.dinner, '🍱 Dinner time'],
      ['snack', reminders.snack || '16:00', '🍎 Snack check-in'],
    ];
    const tick = () => {
      const now = new Date();
      const dayKey = `hellocal_reminded_${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      let fired: Record<string, boolean> = {};
      try { fired = JSON.parse(localStorage.getItem(dayKey) || '{}'); } catch { fired = {}; }
      const nowMin = now.getHours() * 60 + now.getMinutes();
      for (const [slot, time, title] of slots) {
        const hm = parseHM(time);
        if (!hm) continue;
        const elapsed = nowMin - (hm.hour * 60 + hm.minute);
        if (!fired[slot] && elapsed >= 0 && elapsed <= 90) {
          showLocalNotification(title, 'Tap to log your meal in HelloCal.');
          fired[slot] = true;
          try { localStorage.setItem(dayKey, JSON.stringify(fired)); } catch { /* ignore */ }
        }
      }
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [appSettings.reminders]);

  // Supplement reminders: native schedules repeating local notifications; web fires
  // best-effort foreground nudges (only while the app is open).
  useEffect(() => {
    const reminders = appSettings.supplementReminders;
    if (!reminders?.enabled) return;
    if (isNative()) {
      scheduleSupplementReminders(reminders, supplements);
      return;
    }
    const tick = () => {
      const now = new Date();
      const dayKey = `hellocal_supp_reminded_${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      let fired: Record<string, boolean> = {};
      try { fired = JSON.parse(localStorage.getItem(dayKey) || '{}'); } catch { fired = {}; }
      
      const nowMin = now.getHours() * 60 + now.getMinutes();
      
      const slots: { key: 'morning' | 'lunch' | 'bedtime'; label: string; time: string }[] = [
        { key: 'morning', label: 'Morning', time: reminders.morning },
        { key: 'lunch', label: 'Lunch', time: reminders.lunch },
        { key: 'bedtime', label: 'Bedtime', time: reminders.bedtime },
      ];
      
      for (const slot of slots) {
        const hm = parseHM(slot.time);
        if (!hm) continue;
        const elapsed = nowMin - (hm.hour * 60 + hm.minute);
        if (!fired[slot.key] && elapsed >= 0 && elapsed <= 90) {
          const inSlot = supplements.filter((s) => s.schedule.toLowerCase() === slot.key);
          if (inSlot.length > 0) {
            const suppListStr = inSlot.map((s) => s.name + (s.dosage ? ` (${s.dosage})` : '')).join(', ');
            showLocalNotification(`💊 Time for your ${slot.label} Supplements`, `Take: ${suppListStr}`);
            fired[slot.key] = true;
            try { localStorage.setItem(dayKey, JSON.stringify(fired)); } catch { /* ignore */ }
          }
        }
      }
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [appSettings.supplementReminders, supplements]);

  // State Updates & Persistence
  const handleSaveGoals = (newGoals: UserGoals) => {
    setGoals(newGoals);
    storage.saveGoals(newGoals);
    triggerToast('Daily target budgets successfully locked in.');
    fireConfetti({ particleCount: 60, spread: 40, colors: ['#8b5cf6', '#06b6d4', '#10b981'] });
  };

  const handleSaveAppSettings = (next: AppSettings) => {
    setAppSettings(next);
    storage.saveAppSettings(next);
  };

  const handleSaveKey = (newKey: string) => {
    setGeminiKey(newKey);
    storage.saveGeminiKey(newKey);
    triggerToast(newKey.trim() ? 'Gemini key saved.' : 'Gemini key removed.');
  };

  const handleSaveAiProvider = (provider: AiProvider) => {
    const next = { ...appSettings, aiProvider: provider };
    handleSaveAppSettings(next);
    triggerToast(provider === 'hosted' ? 'HelloCal AI selected — sign in to use it.' : 'Your Gemini key mode selected.');
  };

  const handleSavePersonality = (newPersonality: CoachPersonality) => {
    setCoachPersonality(newPersonality);
    storage.saveCoach(newPersonality);
    triggerToast(`AI Coach personality shifted to: ${newPersonality.toUpperCase()}.`);
  };

  // Open the refinement modal pre-filled with a parse result for review.
  const openRefinement = (response: CoachResponse) => {
    setStagedItems(response.items || []);
    setStagedWorkout(null);
    setStagedLogType('food');
    setStagedCoaching(response.coachingMessage || '');
    setStagedMealType(undefined);
    setRefinementOpen(true);
  };

  const toFoodOnlyResponse = (response: CoachResponse): CoachResponse => ({
    ...response,
    type: 'food',
    workout: undefined,
    items: response.items || [],
  });

  // Core Log Action. The single most common case — one confident food item — is
  // logged instantly, skipping the review modal entirely. A "Edit" affordance on
  // the toast re-opens the modal on the just-created log if needed.
  const handleLoggingSuccess = (response: CoachResponse, logTimestamp?: number) => {
    const foodOnly = toFoodOnlyResponse(response);
    const pendingTs = logTimestamp != null && Number.isFinite(logTimestamp) ? logTimestamp : undefined;
    setStagedLogTimestamp(pendingTs);
    const items = foodOnly.items || [];

    if (items.length === 0) {
      triggerToast('HelloCal logs food calories only. Describe what you ate.');
      return;
    }

    const isInstant =
      items.length === 1 &&
      items[0].confidence === 'high';

    if (isInstant) {
      const newId = handleConfirmSave(items, null, undefined, pendingTs);
      triggerToast(`Logged ${items[0].name} (+${Math.round(items[0].calories)} kcal)`, {
        label: 'Edit',
        run: () => {
          setStagedItems(items);
          setStagedWorkout(null);
          setStagedLogType('food');
          setStagedCoaching('Adjust this item, then save your changes.');
          setEditingLogId(newId ?? null);
          setStagedMealType(autoMealSlot(new Date(pendingTs ?? Date.now())));
          setRefinementOpen(true);
        },
      });
      return;
    }

    openRefinement(foodOnly);
  };

  const handleConfirmSave = (itemsToLog: Omit<FoodItem, 'id'>[], workoutToLog: Omit<WorkoutLog, 'id'> | null, mealTypeOverride?: MealLog['mealType'], timestampOverride?: number): string | undefined => {
    const normalizedItems = itemsToLog
      .map((it) => coerceFoodItem(it))
      .filter((it): it is Omit<FoodItem, 'id'> => it != null);
    if (normalizedItems.length === 0 && itemsToLog.length > 0 && !workoutToLog) {
      triggerToast('Could not save — every item needs a name.');
      return;
    }
    itemsToLog = normalizedItems;
    const hadNoLogsBefore = logs.length === 0;
    // Backfill support: a past timestamp logs to that day/time (else now).
    const ts = timestampOverride && Number.isFinite(timestampOverride)
      ? timestampOverride
      : (stagedLogTimestamp ?? Date.now());
    // Edit-in-place: replace the items of an existing meal log instead of inserting a new one.
    if (editingLogId) {
      const reindexed: FoodItem[] = itemsToLog.map((item, i) => ({
        ...item,
        id: `item_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      }));
      if (reindexed.length === 0) {
        // Editing down to zero items removes the meal entirely.
        const pruned = logs.filter((l) => l.id !== editingLogId);
        setLogs(pruned);
        storage.saveLogs(pruned);
        triggerToast('Meal removed.');
      } else {
        const updated = logs.map((l) =>
          l.id === editingLogId
            ? {
                ...l,
                items: reindexed,
                mealType: mealTypeOverride ?? l.mealType,
                // Allow editing the log's time; keep the original when no explicit
                // override is supplied (never silently jump an edited meal to "now").
                timestamp: timestampOverride && Number.isFinite(timestampOverride) ? timestampOverride : l.timestamp,
              }
            : l
        );
        setLogs(updated);
        storage.saveLogs(updated);
        // Record ONLY items newly introduced during this edit. Items already present
        // at the original log time were recorded then; re-recording them would inflate
        // the favorite frequency and skew Quick-Log/Recents toward edits, not real logs.
        const original = logs.find((l) => l.id === editingLogId);
        const known = new Set((original?.items ?? []).map((i) => i.name.trim().toLowerCase()));
        const freshlyAdded = itemsToLog.filter((it) => !known.has(it.name.trim().toLowerCase()));
        if (freshlyAdded.length > 0) recordFavorites(freshlyAdded);
        triggerToast('Meal updated successfully.');
      }
      setEditingLogId(null);
      setStagedLogTimestamp(undefined);
      return;
    }

    let savedFood = false;
    let createdMealId: string | undefined;
    let mealCals = 0;
    let foodCount = 0;

    // 1. Handle Food Items
    if (itemsToLog.length > 0) {
      // Use an explicit meal slot if the user picked one, else auto-detect from the
      // (possibly backfilled) log time.
      const mealType = mealTypeOverride ?? autoMealSlot(new Date(ts));

      // Add unique IDs to food items
      const loggedItems: FoodItem[] = itemsToLog.map(item => ({
        ...item,
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      }));

      createdMealId = `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newLogEntry: MealLog = {
        id: createdMealId,
        timestamp: ts,
        mealType,
        items: loggedItems
      };

      const updatedLogs = [newLogEntry, ...logs];
      setLogs(updatedLogs);
      storage.saveLogs(updatedLogs);
      recordFavorites(itemsToLog);

      mealCals = loggedItems.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
      foodCount = loggedItems.length;
      savedFood = true;
    }

    // Workout logging is disabled — calories-only app.
    void workoutToLog;

    // Celebration + a single consolidated toast (emitting separate food and
    // celebration toasts let the later one clobber the former, losing the +kcal info).
    if (savedFood) {
      // Sum today's calories to see if close to target budget. Use the half-open
      // [start,end) day window (matches dailyTotals/insights) so future-dated or
      // clock-skewed entries can't leak into "today". The just-saved entry only
      // counts toward today's celebration when its timestamp actually lands today
      // (a backfill to a past date shouldn't trigger a "you hit today's goal" toast).
      const { start: dayStart, end: dayEnd } = dayRange();
      const savedToday = ts >= dayStart && ts < dayEnd;

      const todayLogs = logs.filter(log => log.timestamp >= dayStart && log.timestamp < dayEnd);
      let consumed = savedToday ? itemsToLog.reduce((s, i) => s + (Number(i.calories) || 0), 0) : 0;
      todayLogs.forEach(log => {
        log.items.forEach(item => { consumed += Number(item.calories) || 0; });
      });

      const todayWorkouts = workouts.filter(w => w.timestamp >= dayStart && w.timestamp < dayEnd);
      let activeBurn = (workoutToLog && savedToday) ? workoutToLog.caloriesBurned : 0;
      todayWorkouts.forEach(w => { activeBurn += w.caloriesBurned; });

      const expandedGoal = (goals.calories || 2000) + activeBurn;

      // Celebrate landing within a symmetric ±50 kcal band of the (workout-expanded)
      // target — not a lopsided window that rewarded going 100 kcal over.
      const onTarget = consumed >= expandedGoal - 50 && consumed <= expandedGoal + 50;
      if (onTarget) {
        fireConfetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        hapticSuccess();
      } else {
        fireConfetti({ particleCount: 60, spread: 40, origin: { y: 0.8 } });
        haptic('light');
      }

      const parts: string[] = [`Logged ${foodCount} item(s) (+${mealCals} kcal)`];
      const base = parts.join(' · ');
      triggerToast(onTarget ? `${base} · 🎯 You hit your calorie goal!` : base);
    }

    // First successful log after a skipped onboarding: now that the user has
    // seen the value, invite them once to set personalized targets.
    if (savedFood && hadNoLogsBefore && profile.onboardingSkipped) {
      const p = { ...profile, onboardingSkipped: false };
      setProfile(p);
      storage.saveProfile(p);
      setTimeout(() => setOnboardingOpen(true), 1200);
    }

    setStagedLogTimestamp(undefined);
    return createdMealId;
  };

  const handleDeleteLogEntry = (id: string) => {
    const removed = logs.find(log => log.id === id);
    const updatedLogs = logs.filter(log => log.id !== id);
    setLogs(updatedLogs);
    storage.saveLogs(updatedLogs);
    triggerToast('Log entry removed.', removed ? {
      label: 'Undo',
      run: () => {
        // Restore in timestamp order so the timeline position is preserved.
        const restored = [removed, ...updatedLogs].sort((a, b) => b.timestamp - a.timestamp);
        setLogs(restored);
        storage.saveLogs(restored);
      },
    } : undefined);
  };

  const handleDeleteWorkoutEntry = (id: string) => {
    const removed = workouts.find(w => w.id === id);
    const updatedWorkouts = workouts.filter(w => w.id !== id);
    setWorkouts(updatedWorkouts);
    storage.saveWorkouts(updatedWorkouts);
    triggerToast('Workout entry removed.', removed ? {
      label: 'Undo',
      run: () => {
        const restored = [removed, ...updatedWorkouts].sort((a, b) => b.timestamp - a.timestamp);
        setWorkouts(restored);
        storage.saveWorkouts(restored);
      },
    } : undefined);
  };

  // Inline portion adjust from the timeline — scale one logged item in place.
  const handleScaleItem = (logId: string, itemId: string, factor: number) => {
    const updated = logs.map((l) =>
      l.id !== logId ? l : { ...l, items: l.items.map((it) => (it.id === itemId ? scaleNutrients(it, factor) : it)) }
    );
    setLogs(updated);
    storage.saveLogs(updated);
  };

  // Open the refinement modal pre-filled with an existing meal's items, in edit mode.
  const handleEditLog = (log: MealLog) => {
    setStagedItems(log.items.map(({ id, ...rest }) => rest));
    setStagedWorkout(null);
    setStagedLogType('food');
    setStagedCoaching('Editing a logged meal — adjust items, quantities, or remove them, then save.');
    setEditingLogId(log.id);
    setStagedMealType(log.mealType);
    setRefinementOpen(true);
  };

  // Duplicate every meal from a given day onto today.
  const handleCopyDay = (dayStart: number) => {
    const d = new Date(dayStart);
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const sourceLogs = logs.filter((l) => l.timestamp >= start && l.timestamp < end);
    if (sourceLogs.length === 0) {
      triggerToast('No meals to copy from that day.');
      return;
    }
    const now = Date.now();
    const copies: MealLog[] = sourceLogs.map((l, i) => ({
      id: `meal_${now}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      mealType: l.mealType,
      items: l.items.map((it, j) => ({
        ...it,
        id: `item_${now}_${i}_${j}_${Math.random().toString(36).slice(2, 5)}`,
      })),
    }));
    const updated = [...copies, ...logs];
    setLogs(updated);
    storage.saveLogs(updated);
    triggerToast(`Copied ${sourceLogs.length} meal(s) to today. 📋`);
    fireConfetti({ particleCount: 50, spread: 40, origin: { y: 0.8 } });
  };

  // Duplicate a single past meal onto today (today's auto meal slot, fresh ids).
  const handleCopyMeal = (log: MealLog) => {
    const now = Date.now();
    const copy: MealLog = {
      id: `meal_${now}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      mealType: autoMealSlot(),
      items: log.items.map((it, j) => ({
        ...it,
        id: `item_${now}_${j}_${Math.random().toString(36).slice(2, 5)}`,
      })),
    };
    const updated = [copy, ...logs];
    setLogs(updated);
    storage.saveLogs(updated);
    recordFavorites(log.items.map(({ id, ...rest }) => rest));
    const cals = log.items.reduce((s, i) => s + (Number(i.calories) || 0), 0);
    triggerToast(`Copied ${log.items.length} item(s) to today (+${Math.round(cals)} kcal).`);
    fireConfetti({ particleCount: 40, spread: 35, origin: { y: 0.8 } });
  };

  const handleImportJson = (jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (Array.isArray(parsed.logs) && parsed.goals) {
        // Clamp imported goals to safe bounds (a hand-edited backup could be corrupt).
        const importedGoals: UserGoals = { ...goals };
        (Object.keys(GOAL_BOUNDS) as (keyof UserGoals)[]).forEach((k) => {
          if (parsed.goals[k] != null) {
            importedGoals[k] = clampGoal(k, Number(parsed.goals[k]), goals[k] ?? GOAL_BOUNDS[k].min);
          }
        });
        // Sanitize imported logs so a hand-edited/corrupt backup can't persist
        // NaN/garbage that would render as "NaN" in the timeline.
        const validatedLogs = sanitizeMealLogs(parsed.logs);

        storage.saveLogs(validatedLogs);
        storage.saveGoals(importedGoals);
        // Reflect imported logs/goals in the UI immediately (previously only persisted).
        setLogs(validatedLogs);
        setGoals(importedGoals);
        const validatedWorkouts = sanitizeWorkouts(parsed.workouts);
        storage.saveWorkouts(validatedWorkouts);
        setWorkouts(validatedWorkouts);
        if (parsed.geminiKey) {
          storage.saveGeminiKey(parsed.geminiKey);
          setGeminiKey(parsed.geminiKey);
        }
        if (parsed.coachPersonality) storage.saveCoach(parsed.coachPersonality);
        if (parsed.appSettings) {
          storage.saveAppSettings(parsed.appSettings);
          setAppSettings(parsed.appSettings);
        }
        if (parsed.waterLogs != null) {
          const validatedWater = sanitizeWaterLogs(parsed.waterLogs);
          storage.saveWater(validatedWater);
          setWaterLogs(validatedWater);
        }
        if (parsed.bodyMetrics != null) {
          const validatedMetrics = sanitizeBodyMetrics(parsed.bodyMetrics);
          storage.saveBodyMetrics(validatedMetrics);
          setBodyMetrics(validatedMetrics);
        }
        if (parsed.favorites != null) {
          const validatedFavs = sanitizeFavorites(parsed.favorites);
          storage.saveFavorites(validatedFavs);
          setFavorites(validatedFavs);
        }
        if (parsed.profile) {
          storage.saveProfile(parsed.profile);
          setProfile(parsed.profile);
        }
        if (parsed.mealTemplates != null) {
          const validatedTemplates = sanitizeMealTemplates(parsed.mealTemplates);
          storage.saveMealTemplates(validatedTemplates);
          setMealTemplates(validatedTemplates);
        }
        if (parsed.recipes != null) {
          const validatedRecipes = sanitizeRecipes(parsed.recipes);
          storage.saveRecipes(validatedRecipes);
          setRecipes(validatedRecipes);
        }
        if (parsed.supplements != null) {
          const validatedSupps = sanitizeSupplements(parsed.supplements);
          storage.saveSupplements(validatedSupps);
          setSupplements(validatedSupps);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const refreshCloudAccount = async () => {
    const account = await getAccountDetails();
    cloudAccountRef.current = account;
    setCloudAccount(account);
    return account;
  };

  const applyCloudPull = async () => {
    const result = await cloudPull();
    if (!result) return false;
    return importJsonRef.current(result.json);
  };

  const runPostLoginSync = async () => {
    setCloudSyncStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const dir = await syncOnLogin(backupJsonRef.current);
      if (dir === 'conflict') {
        const info = await detectSyncConflict(backupJsonRef.current);
        setSyncConflictRemoteAt(info.remoteUpdatedAt);
        setSyncConflictOpen(true);
        setCloudSyncStatus((s) => ({ ...s, syncing: false }));
        return;
      }
      if (dir === 'pulled') {
        const ok = await applyCloudPull();
        if (ok) {
          setCloudSyncStatus({ lastAt: new Date().toISOString(), syncing: false, error: null });
          triggerToast('Synced your data from the cloud. ☁️');
        } else {
          setCloudSyncStatus((s) => ({ ...s, syncing: false, error: 'Cloud backup could not be applied.' }));
        }
        return;
      }
      if (dir === 'pushed') {
        setCloudSyncStatus({ lastAt: new Date().toISOString(), syncing: false, error: null });
        triggerToast('Your data is backed up to the cloud. ☁️');
        return;
      }
      setCloudSyncStatus((s) => ({ ...s, syncing: false }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Cloud sync failed.';
      setCloudSyncStatus((s) => ({ ...s, syncing: false, error: msg }));
      triggerToast(msg);
    }
  };

  // --- Cloud sync (Supabase, optional) ---
  const handleCloudSignIn = async (email: string, password: string) => {
    const u = await cloudSignIn(email, password);
    cloudAccountRef.current = u;
    setCloudAccount(u);
    triggerToast(`Signed in as ${u.email ?? 'your account'}. ☁️`);
  };

  const handleCloudSignInGoogle = async () => {
    await signInWithGoogle();
  };

  const handleCloudSignUp = async (email: string, password: string) => {
    const { needsConfirmation } = await cloudSignUp(email, password);
    if (needsConfirmation) {
      throw new Error('Account created — check your email to confirm, then sign in.');
    }
    const u = await refreshCloudAccount();
    if (u) triggerToast('Account created and signed in. ☁️');
  };

  const handleCloudPasswordReset = async (email: string) => {
    await requestPasswordReset(email);
  };

  const handleCloudSignOut = async () => {
    await cloudSignOut();
    cloudAccountRef.current = null;
    setCloudAccount(null);
    setCloudSyncStatus({ lastAt: null, syncing: false, error: null });
    setSyncConflictOpen(false);
    triggerToast('Signed out of cloud sync.');
  };

  const handleCloudPush = async () => {
    setCloudSyncStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const at = await cloudPush(backupJsonString);
      setCloudSyncStatus({ lastAt: at, syncing: false, error: null });
      triggerToast('Backed up to the cloud. ☁️✓');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Backup failed.';
      setCloudSyncStatus((s) => ({ ...s, syncing: false, error: msg }));
      throw e;
    }
  };

  const handleCloudPull = async () => {
    setCloudSyncStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const info = await detectSyncConflict(backupJsonRef.current);
      if (info.localHasData && info.remoteHasData) {
        setSyncConflictRemoteAt(info.remoteUpdatedAt);
        setSyncConflictOpen(true);
        setCloudSyncStatus((s) => ({ ...s, syncing: false }));
        return;
      }
      const result = await cloudPull();
      if (!result) {
        setCloudSyncStatus((s) => ({ ...s, syncing: false }));
        triggerToast('No cloud backup found yet — back up first.');
        return;
      }
      const ok = handleImportJson(result.json);
      setCloudSyncStatus({ lastAt: result.updatedAt, syncing: false, error: ok ? null : 'Cloud backup could not be read.' });
      triggerToast(ok ? 'Restored from the cloud. ☁️↓' : 'Cloud backup could not be read.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Restore failed.';
      setCloudSyncStatus((s) => ({ ...s, syncing: false, error: msg }));
      throw e;
    }
  };

  const handleSyncConflictUseCloud = async () => {
    setSyncConflictBusy(true);
    try {
      const ok = await applyCloudPull();
      if (ok) {
        setCloudSyncStatus({ lastAt: new Date().toISOString(), syncing: false, error: null });
        triggerToast('Using your cloud backup on this device. ☁️');
      }
      setSyncConflictOpen(false);
    } catch (e) {
      triggerToast(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      setSyncConflictBusy(false);
    }
  };

  const handleSyncConflictKeepDevice = async () => {
    setSyncConflictBusy(true);
    try {
      const at = await cloudPush(backupJsonRef.current);
      setCloudSyncStatus({ lastAt: at, syncing: false, error: null });
      setSyncConflictOpen(false);
      triggerToast('This device is now your cloud backup. ☁️✓');
    } catch (e) {
      triggerToast(e instanceof Error ? e.message : 'Backup failed.');
    } finally {
      setSyncConflictBusy(false);
    }
  };

  // --- Water tracking ---
  const handleAddWater = (ml: number) => {
    const entry: WaterLog = { id: `water_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now(), milliliters: ml };
    const updated = [entry, ...waterLogs];
    setWaterLogs(updated);
    storage.saveWater(updated);
  };

  const handleRemoveWater = (id: string) => {
    const updated = waterLogs.filter((w) => w.id !== id);
    setWaterLogs(updated);
    storage.saveWater(updated);
  };

  // --- Favorites / recents ---
  const recordFavorites = (items: Omit<FoodItem, 'id'>[]) => {
    let updated = [...favorites];
    for (const item of items) {
      const key = item.name.trim().toLowerCase();
      if (!key) continue; // never record an unnamed/blank food as a favorite
      const idx = updated.findIndex((f) => f.name.trim().toLowerCase() === key);
      const nutrients = copyAuxiliaryNutrients(item);
      const macros = {
        quantity: item.quantity,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        ...nutrients,
      };
      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          ...macros,
          frequency: updated[idx].frequency + 1,
          lastLogged: Date.now(),
        };
      } else {
        updated.push({
          id: `fav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: item.name,
          ...macros,
          frequency: 1,
          lastLogged: Date.now(),
        });
      }
    }
    updated = updated
      .sort(
        (a, b) =>
          Number(b.pinned || false) - Number(a.pinned || false) ||
          b.frequency - a.frequency ||
          b.lastLogged - a.lastLogged
      )
      .slice(0, 50);
    setFavorites(updated);
    storage.saveFavorites(updated);
  };

  // --- Meal presets / templates ---
  const handleSaveTemplate = (name: string, items: Omit<FoodItem, 'id'>[]) => {
    const tmpl: MealTemplate = {
      id: `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: name.trim(),
      items: items.map((it) => ({ ...it })),
      createdAt: Date.now(),
    };
    const updated = [tmpl, ...mealTemplates].slice(0, 30);
    setMealTemplates(updated);
    storage.saveMealTemplates(updated);
    triggerToast(`Saved "${tmpl.name}" as a preset. 🔖`);
  };

  const handleApplyTemplate = (t: MealTemplate) => {
    const newId = handleConfirmSave(t.items, null);
    triggerToast(`Logged preset "${t.name}"`, {
      label: 'Edit',
      run: () => {
        setStagedItems(t.items.map((it) => ({ ...it })));
        setStagedWorkout(null);
        setStagedLogType('food');
        setStagedCoaching(`Adjust "${t.name}", then save your changes.`);
        setEditingLogId(newId ?? null);
        setStagedMealType(autoMealSlot());
        setRefinementOpen(true);
      },
    });
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = mealTemplates.filter((t) => t.id !== id);
    setMealTemplates(updated);
    storage.saveMealTemplates(updated);
  };

  // --- Supplements ---
  const handleSaveSupplements = (next: Supplement[]) => {
    setSupplements(next);
    storage.saveSupplements(next);
  };
  const handleToggleSupplement = (id: string) => {
    const next = supplements.map((s) =>
      s.id === id ? { ...s, takenToday: !s.takenToday, lastTakenTimestamp: !s.takenToday ? Date.now() : s.lastTakenTimestamp } : s
    );
    handleSaveSupplements(next);
  };

  // --- Recipes ---
  const handleSaveRecipes = (newRecipes: Recipe[]) => {
    setRecipes(newRecipes);
    storage.saveRecipes(newRecipes);
  };

  // Log a portion of a recipe: scale each ingredient by `ratio` and route through
  // the standard save path (toast/confetti/favorites all handled there).
  const handleLogRecipePortion = (recipe: Recipe, ratio: number, portionName: string) => {
    const items: Omit<FoodItem, 'id'>[] = recipe.ingredients.map((ing) => {
      const scaled = scaleNutrients(
        { ...ing, name: ing.name, quantity: ing.quantity, confidence: 'high' },
        ratio
      );
      return {
        ...scaled,
        name: `${ing.name} (from ${recipe.name})`,
        quantity: ing.quantity,
        confidence: 'high' as const,
      };
    });
    if (items.length === 0) return;
    handleConfirmSave(items, null);
    triggerToast(`Logged ${portionName} of ${recipe.name}. 🍽️`);
  };

  // --- Onboarding / TDEE ---
  const handleCompleteOnboarding = (newProfile: UserProfile, derived: UserGoals) => {
    setProfile(newProfile);
    storage.saveProfile(newProfile);
    setGoals(derived);
    storage.saveGoals(derived);
    setOnboardingOpen(false);
    triggerToast('Your personalized targets are ready! 🎯');
    fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  };

  const handleSkipOnboarding = () => {
    // Mark complete so we don't block the dashboard, but flag the skip so we can
    // re-invite the user to personalize their targets after their first log.
    const p = { ...profile, onboardingComplete: true, onboardingSkipped: true };
    setProfile(p);
    storage.saveProfile(p);
    setOnboardingOpen(false);
  };

  const handleClearData = () => {
    storage.clearAll();
    setLogs([]);
    setWorkouts([]);
    setWaterLogs([]);
    setBodyMetrics([]);
    setFavorites([]);
    setMealTemplates([]);
    setRecipes([]);
    setSupplements([]);
    setProfile({});
    setGoals({ calories: 2000, protein: 130, carbs: 220, fat: 65, addedSugar: 30, fiber: 30, sodium: 2300, waterTarget: 2500 });
    setGeminiKey('');
    setCoachPersonality('encouraging');
    setAppSettings({
      theme: 'obsidian',
      visibleMacros: { protein: true, carbs: true, fat: true },
      visibleMicros: { addedSugar: true, fiber: true, sodium: true },
      visibleWidgets: { calorieHalo: true, macros: true, micros: true, workouts: false, mealSlots: true, goalCompletion: true, water: true, streak: true, supplements: true }
    });
  };

  const handleSaveReminders = async (reminders: import('./types/nutrition').MealReminders) => {
    const next = { ...appSettings, reminders };
    setAppSettings(next);
    storage.saveAppSettings(next);
    if (reminders.enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        triggerToast('Enable notifications in your device settings to receive reminders.');
      } else {
        triggerToast('Meal reminders saved. 🔔');
      }
    } else {
      triggerToast('Meal reminders turned off.');
    }
    scheduleMealReminders(reminders); // native schedules; web is a no-op
  };

  const handleSaveSupplementReminders = async (supplementReminders: import('./types/nutrition').SupplementReminders) => {
    const next = { ...appSettings, supplementReminders };
    setAppSettings(next);
    storage.saveAppSettings(next);
    if (supplementReminders.enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        triggerToast('Enable notifications in your device settings to receive reminders.');
      } else {
        triggerToast('Supplement reminders saved. 🔔');
      }
    } else {
      triggerToast('Supplement reminders turned off.');
    }
    // The native scheduling sync is handled by the useEffect above
  };

  const backupJsonString = useMemo(() => JSON.stringify({
    logs,
    workouts,
    goals,
    geminiKey,
    coachPersonality,
    appSettings,
    waterLogs,
    bodyMetrics,
    favorites,
    profile,
    mealTemplates,
    recipes,
    supplements,
  }), [logs, workouts, goals, geminiKey, coachPersonality, appSettings, waterLogs, bodyMetrics, favorites, profile, mealTemplates, recipes, supplements]);

  backupJsonRef.current = backupJsonString;
  importJsonRef.current = handleImportJson;

  const aiAccess = useMemo<AiAccess>(() => ({
    provider: appSettings.aiProvider ?? (isHostedAiAvailable() ? 'hosted' : 'custom'),
    customApiKey: geminiKey,
    cloudSignedIn: !!cloudAccount,
  }), [appSettings.aiProvider, geminiKey, cloudAccount]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    refreshCloudAccount().catch(() => {
      cloudAccountRef.current = null;
      setCloudAccount(null);
    });
    const unsub = onAuthChange(async (user, event) => {
      cloudAccountRef.current = user;
      setCloudAccount(user);
      if (event === 'SIGNED_IN' && user && isLoaded) {
        await refreshCloudAccount();
        await runPostLoginSync();
      }
      if (event === 'SIGNED_OUT') {
        setCloudSyncStatus({ lastAt: null, syncing: false, error: null });
        setSyncConflictOpen(false);
      }
    });
    return unsub;
  }, [isLoaded]);

  useEffect(() => {
    if (!cloudAccount || !isLoaded) return;
    setCloudSyncStatus((s) => ({ ...s, syncing: true, error: null }));
    const timer = setTimeout(() => {
      cloudPush(backupJsonRef.current)
        .then((at) => setCloudSyncStatus({ lastAt: at, syncing: false, error: null }))
        .catch((e) => setCloudSyncStatus((s) => ({
          ...s,
          syncing: false,
          error: e instanceof Error ? e.message : 'Auto-sync failed.',
        })));
    }, 4000);
    return () => clearTimeout(timer);
  }, [cloudAccount, isLoaded, backupJsonString]);

  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-display)'
      }}>
        <img
          src="/logo.svg"
          alt="HelloCal Logo"
          className="loading-logo"
        />
        <span>Powering HelloCal...</span>
      </div>
    );
  }

  // Derived dashboard values
  const streak = computeStreak(logs);

  // Today's already-logged calories/burn over the half-open [start,end) day window
  // (matches dailyTotals/insights so future-dated entries can't leak in). Consumed
  // excludes any meal currently being edited, since the staged items replace it.
  const { start: todayStart, end: todayEnd } = dayRange();
  const todayConsumedCalories = logs
    .filter((l) => l.timestamp >= todayStart && l.timestamp < todayEnd && l.id !== editingLogId)
    .reduce((s, l) => s + l.items.reduce((a, i) => a + (Number(i.calories) || 0), 0), 0);
  // Today's workout burn expands the eatable budget, exactly as the dashboard halo
  // does — so the modal's "kcal left" matches the dashboard for the same state.
  const todayBurnedCalories = workouts
    .filter((w) => w.timestamp >= todayStart && w.timestamp < todayEnd)
    .reduce((s, w) => s + (Number(w.caloriesBurned) || 0), 0);

  return (
    <div className="app-container">
      
      {/* 1. Header Layout & Navigation Tabs */}
      <header className="header">
        <div className="logo-container motion-enter" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img
            src="/logo.svg"
            alt="HelloCal Logo"
            className="header-logo"
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 className="logo-text" style={{ margin: 0 }}>Hello<span>Cal</span></h1>
            {streak > 0 && (
              <div className="logo-streak-v3" style={{
                display: 'flex',
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                alignItems: 'center',
                gap: '0.2rem',
                marginTop: '1px'
              }}>
                <Flame size={10} fill="var(--text-muted)" color="var(--text-muted)" />
                <span>{streak}-day streak</span>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Navigation Board */}
        <nav
          className="nav-tabs"
          role="tablist"
          aria-label="Main sections"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const idx = NAV_TABS.findIndex((t) => t.key === activeTab);
            const nextKey = NAV_TABS[e.key === 'ArrowRight'
              ? (idx + 1) % NAV_TABS.length
              : (idx - 1 + NAV_TABS.length) % NAV_TABS.length].key;
            setActiveTab(nextKey);
            document.getElementById(`tab-${nextKey}`)?.focus();
          }}
        >
          {NAV_TABS.map(({ key, label, Icon }) => {
            const remindersConfigured =
              appSettings.reminders?.enabled || appSettings.supplementReminders?.enabled;
            return (
            <button
              key={key}
              role="tab"
              id={`tab-${key}`}
              aria-controls={`panel-${key}`}
              aria-selected={activeTab === key}
              tabIndex={activeTab === key ? 0 : -1}
              className={`tab-btn${activeTab === key ? ' active' : ''}${key === 'dashboard' ? ' tab-btn--hub' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={16} />
              <span>{label}</span>
              {key === 'settings' && !remindersConfigured ? (
                <span className="tab-badge" title="Reminders available in Settings" aria-label="Reminders not enabled" />
              ) : null}
            </button>
            );
          })}
        </nav>
      </header>

      {/* Dynamic Tab Portals */}
      <main style={{ flex: 1, marginBottom: '3rem' }}>
        {activeTab === 'dashboard' && (
          <div role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard" className="motion-tab-panel dashboard-tab-panel">
            <Dashboard
              logs={logs}
              workouts={workouts}
              goals={goals}
              appSettings={appSettings}
              onSaveGoals={handleSaveGoals}
              onSaveAppSettings={handleSaveAppSettings}
              aiAccess={aiAccess}
              onError={(msg) => triggerToast(msg)}
              waterLogs={waterLogs}
              onAddWater={handleAddWater}
              onRemoveWater={handleRemoveWater}
              supplements={supplements}
              onSaveSupplements={handleSaveSupplements}
              onToggleSupplement={handleToggleSupplement}
              voiceSlot={(
                <VoiceInput
                  aiAccess={aiAccess}
                  personality={coachPersonality}
                  onParsingSuccess={handleLoggingSuccess}
                  onError={(msg) => triggerToast(msg)}
                  onOpenSettings={() => setActiveTab('settings')}
                  weightKg={profile.weightKg}
                />
              )}
              mealPresetsSlot={
                mealTemplates.length > 0 ? (
                  <MealTemplateBar
                    templates={mealTemplates}
                    onApply={handleApplyTemplate}
                    onDelete={handleDeleteTemplate}
                  />
                ) : null
              }
            />
          </div>
        )}
        
        {activeTab === 'timeline' && (
          <div role="tabpanel" id="panel-timeline" aria-labelledby="tab-timeline" className="motion-tab-panel">
            <FoodTimeline
              logs={logs}
              workouts={workouts}
              onDeleteLog={handleDeleteLogEntry}
              onDeleteWorkout={handleDeleteWorkoutEntry}
              onEditLog={handleEditLog}
              onCopyDay={handleCopyDay}
              onCopyMeal={handleCopyMeal}
              onScaleItem={handleScaleItem}
              goals={goals}
              customMicros={appSettings.customMicros}
              aiAccess={aiAccess}
              personality={coachPersonality}
              onLoggingSuccess={handleLoggingSuccess}
              onError={(msg) => triggerToast(msg)}
              onOpenSettings={() => setActiveTab('settings')}
              weightKg={profile.weightKg}
              focusDateTs={timelineFocusDate}
            />
          </div>
        )}

        {activeTab === 'recipes' && (
          <div role="tabpanel" id="panel-recipes" aria-labelledby="tab-recipes" className="motion-tab-panel">
            <Suspense fallback={
              <div className="glass-card motion-enter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                Loading recipes…
              </div>
            }>
              <RecipeBox
                recipes={recipes}
                onSaveRecipes={handleSaveRecipes}
                onLogRecipePortion={handleLogRecipePortion}
                onTriggerToast={triggerToast}
                aiAccess={aiAccess}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div role="tabpanel" id="panel-analytics" aria-labelledby="tab-analytics" className="motion-tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Suspense fallback={
              <div className="glass-card motion-enter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                Loading analytics…
              </div>
            }>
              <Analytics
                logs={logs}
                goals={goals}
                appSettings={appSettings}
                waterLogs={waterLogs}
                supplements={supplements}
                onNavigateToDay={(dayStartTs) => {
                  setTimelineFocusDate(dayStartTs);
                  setActiveTab('timeline');
                }}
              />
            </Suspense>
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div role="tabpanel" id="panel-settings" aria-labelledby="tab-settings" className="motion-tab-panel">
            <Settings
              apiKey={geminiKey}
              aiProvider={appSettings.aiProvider ?? (isHostedAiAvailable() ? 'hosted' : 'custom')}
              hostedAiAvailable={isHostedAiAvailable()}
              personality={coachPersonality}
              onSaveKey={handleSaveKey}
              onSaveAiProvider={handleSaveAiProvider}
              onSavePersonality={handleSavePersonality}
              onClearData={handleClearData}
              onImportData={handleImportJson}
              exportDataJson={backupJsonString}
              reminders={appSettings.reminders}
              onSaveReminders={handleSaveReminders}
              supplementReminders={appSettings.supplementReminders}
              onSaveSupplementReminders={handleSaveSupplementReminders}
              cloudConfigured={isSupabaseConfigured()}
              cloudAccount={cloudAccount}
              cloudSyncStatus={cloudSyncStatus}
              onCloudSignIn={handleCloudSignIn}
              onCloudSignUp={handleCloudSignUp}
              onCloudSignInGoogle={handleCloudSignInGoogle}
              onCloudPasswordReset={handleCloudPasswordReset}
              onCloudSignOut={handleCloudSignOut}
              onCloudPush={handleCloudPush}
              onCloudPull={handleCloudPull}
            />
          </div>
        )}
      </main>

      {/* Sync conflict resolution */}
      <SyncConflictModal
        open={syncConflictOpen}
        remoteUpdatedAt={syncConflictRemoteAt}
        busy={syncConflictBusy}
        onUseCloud={handleSyncConflictUseCloud}
        onKeepDevice={handleSyncConflictKeepDevice}
        onDismiss={() => setSyncConflictOpen(false)}
      />

      {/* 4. Interactive Staged Review Modal */}
      <RefinementModal
        isOpen={refinementOpen}
        onClose={() => { setRefinementOpen(false); setEditingLogId(null); setStagedMealType(undefined); setStagedLogTimestamp(undefined); }}
        parsedItems={stagedItems}
        parsedWorkout={stagedWorkout}
        logType={stagedLogType}
        onSave={handleConfirmSave}
        coachingMessage={stagedCoaching}
        aiAccess={aiAccess}
        personality={coachPersonality}
        calorieGoal={(goals.calories || 2000) + todayBurnedCalories}
        consumedToday={todayConsumedCalories}
        onSaveTemplate={handleSaveTemplate}
        weightKg={profile.weightKg}
        initialMealType={stagedMealType}
        isEditing={editingLogId !== null}
        initialTimestamp={editingLogId ? logs.find((l) => l.id === editingLogId)?.timestamp : stagedLogTimestamp}
      />

      {/* 5. Sleek Toast Notification Banner */}
      {toast && (
        <div className="toast-container" aria-live="polite" aria-atomic="true">
          <div className="toast">
            <CheckCircle size={18} color="var(--accent-teal)" />
            <span>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  const run = toast.action!.run;
                  if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                  setToast(null);
                  run();
                }}
                style={{
                  marginLeft: '0.6rem',
                  background: 'rgba(139, 92, 246, 0.18)',
                  border: '1px solid var(--border-glass-glow)',
                  color: 'var(--accent-purple)',
                  borderRadius: '99px',
                  padding: '0.2rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5.2. Custom PWA install prompt */}
      <InstallPrompt />

      {/* 5.4. First-run Onboarding / TDEE wizard */}
      <Onboarding
        isOpen={onboardingOpen}
        initialProfile={profile}
        onComplete={handleCompleteOnboarding}
        onSkip={handleSkipOnboarding}
      />

      {/* 6. Footer Signature */}
      <footer className="motion-enter" style={{
        textAlign: 'center',
        padding: '1rem 0',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-display)',
        borderTop: '1px solid var(--border-glass)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem'
      }}>
        <span>HelloCal · Made with</span>
        <Heart size={10} color="var(--accent-rose)" fill="var(--accent-rose)" />
        <span>for healthier days.</span>
      </footer>

    </div>
  );
};
export default App;
