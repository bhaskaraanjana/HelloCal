import React, { useState, useEffect, useRef, Suspense } from 'react';
import type { MealLog, FoodItem, WorkoutLog, UserGoals, CoachPersonality, CoachResponse, AppSettings, WaterLog, BodyMetric, FavoriteFood, UserProfile, MealTemplate } from './types/nutrition';
import { storage } from './services/storage';
import { computeStreak, totalLoggedDays } from './services/insights';
import { clampGoal, GOAL_BOUNDS } from './services/validation';
import { sanitizeMealLogs, sanitizeWorkouts, sanitizeFavorites, sanitizeMealTemplates, sanitizeWaterLogs, sanitizeBodyMetrics } from './services/sanitize';
import { scaleNutrients, autoMealSlot } from './services/logMath';
import { isSupabaseConfigured, getCurrentUser, onAuthChange, signIn as cloudSignIn, signUp as cloudSignUp, signOut as cloudSignOut, pushData as cloudPush, pullData as cloudPull, type CloudUser } from './services/cloudSync';
import { initNative, haptic, hapticSuccess, isNative, scheduleMealReminders, requestNotificationPermission, showLocalNotification, parseHM } from './services/native';
import { Dashboard } from './components/Dashboard';
import { VoiceInput } from './components/VoiceInput';
import { FoodTimeline } from './components/FoodTimeline';
// Analytics pulls in Chart.js (~150KB gzip); load it only when the tab is opened.
const Analytics = React.lazy(() =>
  import('./components/Analytics').then((m) => ({ default: m.Analytics }))
);
import { Settings } from './components/Settings';
import { RefinementModal } from './components/RefinementModal';
import { Utensils, LayoutDashboard, BarChart2, Settings as SettingsIcon, Heart, CheckCircle, History } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AiCustomizerDrawer } from './components/AiCustomizerDrawer';
import { WaterTracker } from './components/WaterTracker';
import { StreakBadge } from './components/StreakBadge';
import { QuickLogBar } from './components/QuickLogBar';
// WeightTracker also pulls in Chart.js; lazy-load it alongside Analytics so the
// charting library stays out of the initial bundle entirely.
const WeightTracker = React.lazy(() =>
  import('./components/WeightTracker').then((m) => ({ default: m.WeightTracker }))
);
import { Onboarding } from './components/Onboarding';
import { InstallPrompt } from './components/InstallPrompt';
import { FoodSearchDrawer } from './components/FoodSearchDrawer';
import { MealTemplateBar } from './components/MealTemplateBar';
import { RecentsTab } from './components/RecentsTab';

// Common foods seeded into Quick Add on first run so the fastest repeat-log path
// isn't empty for brand-new users. Low frequency/lastLogged means real, frequently
// logged foods naturally outrank and replace them over time.
const SEED_FAVORITES: Omit<FavoriteFood, 'id' | 'frequency' | 'lastLogged'>[] = [
  { name: 'Banana', quantity: '1 medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: 'Apple', quantity: '1 medium', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: 'Chicken Breast', quantity: '100 g', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'White Rice', quantity: '1 cup cooked', calories: 206, protein: 4.3, carbs: 45, fat: 0.4 },
  { name: 'Egg', quantity: '1 large', calories: 78, protein: 6, carbs: 0.6, fat: 5 },
  { name: 'Greek Yogurt', quantity: '170 g', calories: 100, protein: 17, carbs: 6, fat: 0.7 },
];

const NAV_TABS = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'timeline', label: 'Timeline', Icon: Utensils },
  { key: 'recents', label: 'Recents', Icon: History },
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
  const [profile, setProfile] = useState<UserProfile>({});
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Dashboard Dynamic Customizer Layout settings state
  const [appSettings, setAppSettings] = useState<AppSettings>({
    theme: 'obsidian',
    visibleMacros: { protein: true, carbs: true, fat: true },
    visibleMicros: { addedSugar: true, fiber: true, sodium: true },
    visibleWidgets: { calorieHalo: true, macros: true, micros: true, workouts: true, mealSlots: true, goalCompletion: true, water: true, streak: true }
  });
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [customizerScope, setCustomizerScope] = useState<'general' | 'macronutrients' | 'micronutrients' | 'widgets'>('general');

  // Loading indicator on first mount
  const [isLoaded, setIsLoaded] = useState(false);

  // Tab View
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'recents' | 'analytics' | 'settings'>('dashboard');

  // Refinement modal states
  const [refinementOpen, setRefinementOpen] = useState(false);
  const [stagedItems, setStagedItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [stagedWorkout, setStagedWorkout] = useState<Omit<WorkoutLog, 'id'> | null>(null);
  const [stagedLogType, setStagedLogType] = useState<'food' | 'workout' | 'mixed'>('food');
  const [stagedCoaching, setStagedCoaching] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [stagedMealType, setStagedMealType] = useState<MealLog['mealType'] | undefined>(undefined);

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
      // Fresh install: seed Quick Add so one-tap logging works immediately.
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
      if (tab === 'analytics' || tab === 'timeline' || tab === 'recents' || tab === 'settings' || tab === 'dashboard') {
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

  // Track Supabase auth state (no-op when cloud sync isn't configured).
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    getCurrentUser().then(setCloudUser).catch(() => setCloudUser(null));
    const unsub = onAuthChange(setCloudUser);
    return unsub;
  }, []);

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

  // State Updates & Persistence
  const handleSaveGoals = (newGoals: UserGoals) => {
    setGoals(newGoals);
    storage.saveGoals(newGoals);
    triggerToast('Daily target budgets successfully locked in.');
    fireConfetti({ particleCount: 60, spread: 40, colors: ['#8b5cf6', '#06b6d4', '#10b981'] });
  };

  const handleSaveKey = (newKey: string) => {
    setGeminiKey(newKey);
    storage.saveGeminiKey(newKey);
    triggerToast(newKey.trim() ? 'Gemini AI Supermode key has been activated!' : 'Gemini Key removed. App is now in smart offline mode.');
  };

  const handleSavePersonality = (newPersonality: CoachPersonality) => {
    setCoachPersonality(newPersonality);
    storage.saveCoach(newPersonality);
    triggerToast(`AI Coach personality shifted to: ${newPersonality.toUpperCase()}.`);
  };

  // Open the refinement modal pre-filled with a parse result for review.
  const openRefinement = (response: CoachResponse) => {
    setStagedItems(response.items || []);
    setStagedWorkout(response.workout || null);
    setStagedLogType(response.type || 'food');
    setStagedCoaching(response.coachingMessage || '');
    setStagedMealType(undefined);
    setRefinementOpen(true);
  };

  // Core Log Action. The single most common case — one confident food item, no
  // workout — is logged instantly, skipping the review modal entirely. A "Edit"
  // affordance on the toast re-opens the modal on the just-created log if needed.
  const handleLoggingSuccess = (response: CoachResponse) => {
    const items = response.items || [];
    const isInstant =
      response.type === 'food' &&
      !response.workout &&
      items.length === 1 &&
      items[0].confidence === 'high';

    if (isInstant) {
      const newId = handleConfirmSave(items, null);
      triggerToast(`Logged ${items[0].name} (+${Math.round(items[0].calories)} kcal)`, {
        label: 'Edit',
        run: () => {
          setStagedItems(items);
          setStagedWorkout(null);
          setStagedLogType('food');
          setStagedCoaching('Adjust this item, then save your changes.');
          setEditingLogId(newId ?? null);
          setStagedMealType(autoMealSlot());
          setRefinementOpen(true);
        },
      });
      return;
    }

    openRefinement(response);
  };

  // A food picked from the search drawer: stage it for portion review, then log.
  const handleSearchPick = (item: Omit<FoodItem, 'id'>) => {
    setSearchOpen(false);
    openRefinement({
      type: 'food',
      items: [item],
      coachingMessage: `Loaded "${item.name}" from the food database. Adjust the portion if needed, then log.`,
    });
  };

  const handleConfirmSave = (itemsToLog: Omit<FoodItem, 'id'>[], workoutToLog: Omit<WorkoutLog, 'id'> | null, mealTypeOverride?: MealLog['mealType']): string | undefined => {
    const hadNoLogsBefore = logs.length === 0;
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
          l.id === editingLogId ? { ...l, items: reindexed, mealType: mealTypeOverride ?? l.mealType } : l
        );
        setLogs(updated);
        storage.saveLogs(updated);
        recordFavorites(itemsToLog);
        triggerToast('Meal updated successfully.');
      }
      setEditingLogId(null);
      return;
    }

    let savedFood = false;
    let savedWorkout = false;
    let createdMealId: string | undefined;
    let mealCals = 0;
    let foodCount = 0;
    let workoutBurn = 0;

    // 1. Handle Food Items
    if (itemsToLog.length > 0) {
      // Use an explicit meal slot if the user picked one, else auto-detect by time.
      const mealType = mealTypeOverride ?? autoMealSlot();

      // Add unique IDs to food items
      const loggedItems: FoodItem[] = itemsToLog.map(item => ({
        ...item,
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      }));

      createdMealId = `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newLogEntry: MealLog = {
        id: createdMealId,
        timestamp: Date.now(),
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

    // 2. Handle Workout
    if (workoutToLog) {
      const newWorkoutEntry: WorkoutLog = {
        ...workoutToLog,
        id: `workout_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now()
      };

      const updatedWorkouts = [newWorkoutEntry, ...workouts];
      setWorkouts(updatedWorkouts);
      storage.saveWorkouts(updatedWorkouts);

      workoutBurn = workoutToLog.caloriesBurned;
      savedWorkout = true;
    }

    // Celebration + a single consolidated toast (emitting separate food/workout and
    // celebration toasts let the later one clobber the former, losing the +kcal info).
    if (savedFood || savedWorkout) {
      // Sum today's remaining calories to see if close to target budget
      const today = new Date();
      today.setHours(0,0,0,0);
      const startOfToday = today.getTime();

      const todayLogs = logs.filter(log => log.timestamp >= startOfToday);
      let consumed = itemsToLog.reduce((s, i) => s + (Number(i.calories) || 0), 0);
      todayLogs.forEach(log => {
        log.items.forEach(item => { consumed += Number(item.calories) || 0; });
      });

      const todayWorkouts = workouts.filter(w => w.timestamp >= startOfToday);
      let activeBurn = workoutToLog ? workoutToLog.caloriesBurned : 0;
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

      const parts: string[] = [];
      if (savedFood) parts.push(`Logged ${foodCount} item(s) (+${mealCals} kcal)`);
      if (savedWorkout) parts.push(`Workout logged (-${workoutBurn} kcal)`);
      const base = parts.join(' · ');
      triggerToast(onTarget ? `${base} · 🎯 You hit your target halo!` : base);
    }

    // First successful log after a skipped onboarding: now that the user has
    // seen the value, invite them once to set personalized targets.
    if (savedFood && hadNoLogsBefore && profile.onboardingSkipped) {
      const p = { ...profile, onboardingSkipped: false };
      setProfile(p);
      storage.saveProfile(p);
      setTimeout(() => setOnboardingOpen(true), 1200);
    }

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
        if (parsed.geminiKey) storage.saveGeminiKey(parsed.geminiKey);
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
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // --- Cloud sync (Supabase, optional) ---
  const handleCloudSignIn = async (email: string, password: string) => {
    try {
      const u = await cloudSignIn(email, password);
      setCloudUser(u);
      triggerToast(`Signed in as ${u.email ?? 'your account'}. ☁️`);
    } catch (e) {
      triggerToast(e instanceof Error ? e.message : 'Sign-in failed.');
    }
  };

  const handleCloudSignUp = async (email: string, password: string) => {
    try {
      const { needsConfirmation } = await cloudSignUp(email, password);
      if (needsConfirmation) {
        triggerToast('Account created — check your email to confirm, then sign in.');
      } else {
        const u = await getCurrentUser();
        setCloudUser(u);
        triggerToast('Account created and signed in. ☁️');
      }
    } catch (e) {
      triggerToast(e instanceof Error ? e.message : 'Sign-up failed.');
    }
  };

  const handleCloudSignOut = async () => {
    await cloudSignOut();
    setCloudUser(null);
    triggerToast('Signed out of cloud sync.');
  };

  const handleCloudPush = async () => {
    try {
      await cloudPush(backupJsonString);
      triggerToast('Backed up to the cloud. ☁️✓');
    } catch (e) {
      triggerToast(e instanceof Error ? e.message : 'Backup failed.');
    }
  };

  const handleCloudPull = async () => {
    try {
      const result = await cloudPull();
      if (!result) {
        triggerToast('No cloud backup found yet — back up first.');
        return;
      }
      const ok = handleImportJson(result.json);
      triggerToast(ok ? 'Restored from the cloud. ☁️↓' : 'Cloud backup could not be read.');
    } catch (e) {
      triggerToast(e instanceof Error ? e.message : 'Restore failed.');
    }
  };

  // --- Water tracking ---
  const startOfTodayTs = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const handleAddWater = (ml: number) => {
    const entry: WaterLog = { id: `water_${Date.now()}`, timestamp: Date.now(), milliliters: ml };
    const updated = [entry, ...waterLogs];
    setWaterLogs(updated);
    storage.saveWater(updated);
  };

  const handleUndoWater = () => {
    const sot = startOfTodayTs();
    const todays = waterLogs
      .filter((w) => w.timestamp >= sot)
      .sort((a, b) => b.timestamp - a.timestamp);
    if (todays.length === 0) return;
    const updated = waterLogs.filter((w) => w.id !== todays[0].id);
    setWaterLogs(updated);
    storage.saveWater(updated);
  };

  // --- Body metrics ---
  const handleAddMetric = (
    weightKg: number,
    unit: 'kg' | 'lb',
    extra?: { bodyFat?: number; waist?: number }
  ) => {
    const entry: BodyMetric = {
      id: `body_${Date.now()}`,
      timestamp: Date.now(),
      weight: weightKg,
      unit,
      bodyFat: extra?.bodyFat,
      waist: extra?.waist,
    };
    const updated = [entry, ...bodyMetrics];
    setBodyMetrics(updated);
    storage.saveBodyMetrics(updated);
    triggerToast('Body weight logged successfully.');
  };

  const handleDeleteMetric = (id: string) => {
    const updated = bodyMetrics.filter((m) => m.id !== id);
    setBodyMetrics(updated);
    storage.saveBodyMetrics(updated);
  };

  // --- Favorites / recents ---
  const recordFavorites = (items: Omit<FoodItem, 'id'>[]) => {
    let updated = [...favorites];
    for (const item of items) {
      const key = item.name.trim().toLowerCase();
      if (!key) continue; // never record an unnamed/blank food as a favorite
      const idx = updated.findIndex((f) => f.name.trim().toLowerCase() === key);
      const macros = {
        quantity: item.quantity,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        sugar: item.sugar,
        addedSugar: item.addedSugar,
        fiber: item.fiber,
        sodium: item.sodium,
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

  const handleQuickLog = (fav: FavoriteFood) => {
    const item: Omit<FoodItem, 'id'> = {
      name: fav.name,
      quantity: fav.quantity,
      calories: fav.calories,
      protein: fav.protein,
      carbs: fav.carbs,
      fat: fav.fat,
      sugar: fav.sugar,
      addedSugar: fav.addedSugar,
      fiber: fav.fiber,
      sodium: fav.sodium,
      confidence: 'high',
    };
    const newId = handleConfirmSave([item], null);
    triggerToast(`Logged ${item.name} (+${Math.round(Number(item.calories) || 0)} kcal)`, {
      label: 'Edit',
      run: () => {
        setStagedItems([item]);
        setStagedWorkout(null);
        setStagedLogType('food');
        setStagedCoaching('Adjust this item, then save your changes.');
        setEditingLogId(newId ?? null);
        setStagedMealType(autoMealSlot());
        setRefinementOpen(true);
      },
    });
  };

  const handleTogglePin = (id: string) => {
    const updated = favorites.map((f) => (f.id === id ? { ...f, pinned: !f.pinned } : f));
    setFavorites(updated);
    storage.saveFavorites(updated);
  };

  const handleDeleteFavorite = (id: string) => {
    const updated = favorites.filter((f) => f.id !== id);
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
    setProfile({});
    setGoals({ calories: 2000, protein: 130, carbs: 220, fat: 65, addedSugar: 30, fiber: 30, sodium: 2300, waterTarget: 2500 });
    setGeminiKey('');
    setCoachPersonality('encouraging');
    setAppSettings({
      theme: 'obsidian',
      visibleMacros: { protein: true, carbs: true, fat: true },
      visibleMicros: { addedSugar: true, fiber: true, sodium: true },
      visibleWidgets: { calorieHalo: true, macros: true, micros: true, workouts: true, mealSlots: true, goalCompletion: true, water: true, streak: true }
    });
  };

  // Callback handler for AI customization actions
  const handleCustomizationSuccess = (
    updatedGoals: Partial<UserGoals>,
    updatedSettings: Partial<AppSettings>,
    message: string
  ) => {
    let newGoals = { ...goals };
    if (Object.keys(updatedGoals).length > 0) {
      // Clamp every AI/voice-driven goal change to safe bounds so a hallucinated
      // or fat-fingered command ("set calories to 10000") can't corrupt the budget.
      newGoals = { ...goals };
      (Object.keys(updatedGoals) as (keyof UserGoals)[]).forEach((k) => {
        if (k in GOAL_BOUNDS) {
          newGoals[k] = clampGoal(k, Number(updatedGoals[k]), goals[k] ?? GOAL_BOUNDS[k].min);
        }
      });
      setGoals(newGoals);
      storage.saveGoals(newGoals);
    }

    let newSettings = { ...appSettings };
    if (Object.keys(updatedSettings).length > 0) {
      newSettings = {
        ...appSettings,
        ...updatedSettings,
        visibleMacros: {
          ...appSettings.visibleMacros,
          ...(updatedSettings.visibleMacros || {})
        },
        visibleMicros: {
          ...appSettings.visibleMicros,
          ...(updatedSettings.visibleMicros || {})
        },
        visibleWidgets: {
          ...appSettings.visibleWidgets,
          ...(updatedSettings.visibleWidgets || {})
        }
      };
      if (updatedSettings.theme) {
        newSettings.theme = updatedSettings.theme;
      }
      setAppSettings(newSettings);
      storage.saveAppSettings(newSettings);
    }

    triggerToast(message);
    fireConfetti({ particleCount: 80, spread: 50, origin: { y: 0.8 } });
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

  const handleTriggerCustomize = (scope: 'general' | 'macronutrients' | 'micronutrients' | 'widgets') => {
    setCustomizerScope(scope);
    setCustomizerOpen(true);
  };

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

  // Get raw serialization strings for backup downloads
  const backupJsonString = JSON.stringify({
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
    mealTemplates
  });

  // Derived dashboard values
  const startOfToday = startOfTodayTs();
  const waterTodayMl = waterLogs
    .filter((w) => w.timestamp >= startOfToday)
    .reduce((s, w) => s + w.milliliters, 0);
  const streak = computeStreak(logs);
  const lifetimeDays = totalLoggedDays(logs);

  // Today's already-logged calories (excluding any meal currently being edited,
  // since the staged items will replace it) — powers the live budget in the modal.
  const todayConsumedCalories = logs
    .filter((l) => l.timestamp >= startOfToday && l.id !== editingLogId)
    .reduce((s, l) => s + l.items.reduce((a, i) => a + (Number(i.calories) || 0), 0), 0);

  return (
    <div className="app-container">
      
      {/* 1. Header Layout & Navigation Tabs */}
      <header className="header">
        <div className="logo-container">
          <img
            src="/logo.svg"
            alt="HelloCal Logo"
            className="header-logo"
          />
          <h1 className="logo-text">Hello<span>Cal</span></h1>
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
          {NAV_TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              role="tab"
              id={`tab-${key}`}
              aria-controls={`panel-${key}`}
              aria-selected={activeTab === key}
              tabIndex={activeTab === key ? 0 : -1}
              className={`tab-btn ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* 2. Main Voice Action Console */}
      <section style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
        <VoiceInput
          apiKey={geminiKey}
          personality={coachPersonality}
          onParsingSuccess={handleLoggingSuccess}
          onError={(msg) => triggerToast(msg)}
          onOpenSettings={() => setActiveTab('settings')}
          onOpenSearch={() => setSearchOpen(true)}
          weightKg={profile.weightKg}
        />
      </section>

      {/* 3. Dynamic Tab Portals */}
      <main style={{ flex: 1, marginBottom: '3rem' }}>
        {activeTab === 'dashboard' && (
          <div role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {appSettings.visibleWidgets.streak !== false && (
              <StreakBadge streak={streak} totalDays={lifetimeDays} />
            )}
            <QuickLogBar
              favorites={favorites}
              onQuickLog={handleQuickLog}
              onTogglePin={handleTogglePin}
            />
            <MealTemplateBar
              templates={mealTemplates}
              onApply={handleApplyTemplate}
              onDelete={handleDeleteTemplate}
            />
            <Dashboard
              logs={logs}
              workouts={workouts}
              goals={goals}
              appSettings={appSettings}
              onTriggerCustomize={handleTriggerCustomize}
            />
            {appSettings.visibleWidgets.water !== false && (
              <WaterTracker
                todayMl={waterTodayMl}
                targetMl={goals.waterTarget || 2500}
                onAdd={handleAddWater}
                onUndo={handleUndoWater}
              />
            )}
          </div>
        )}
        
        {activeTab === 'timeline' && (
          <div role="tabpanel" id="panel-timeline" aria-labelledby="tab-timeline">
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
            />
          </div>
        )}

        {activeTab === 'recents' && (
          <div role="tabpanel" id="panel-recents" aria-labelledby="tab-recents">
            <RecentsTab
              favorites={favorites}
              onQuickLog={handleQuickLog}
              onTogglePin={handleTogglePin}
              onDelete={handleDeleteFavorite}
            />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div role="tabpanel" id="panel-analytics" aria-labelledby="tab-analytics" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Suspense fallback={
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                Loading analytics…
              </div>
            }>
              <Analytics logs={logs} workouts={workouts} goals={goals} />
              <WeightTracker
                metrics={bodyMetrics}
                preferredUnit={profile.preferredWeightUnit || 'kg'}
                onAddMetric={handleAddMetric}
                onDeleteMetric={handleDeleteMetric}
              />
            </Suspense>
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div role="tabpanel" id="panel-settings" aria-labelledby="tab-settings">
            <Settings
              apiKey={geminiKey}
              personality={coachPersonality}
              goals={goals}
              onSaveKey={handleSaveKey}
              onSavePersonality={handleSavePersonality}
              onSaveGoals={handleSaveGoals}
              onClearData={handleClearData}
              onImportData={handleImportJson}
              exportDataJson={backupJsonString}
              reminders={appSettings.reminders}
              onSaveReminders={handleSaveReminders}
              cloudConfigured={isSupabaseConfigured()}
              cloudUser={cloudUser ? { email: cloudUser.email } : null}
              onCloudSignIn={handleCloudSignIn}
              onCloudSignUp={handleCloudSignUp}
              onCloudSignOut={handleCloudSignOut}
              onCloudPush={handleCloudPush}
              onCloudPull={handleCloudPull}
            />
          </div>
        )}
      </main>

      {/* 4. Interactive Staged Review Modal */}
      <RefinementModal
        isOpen={refinementOpen}
        onClose={() => { setRefinementOpen(false); setEditingLogId(null); setStagedMealType(undefined); }}
        parsedItems={stagedItems}
        parsedWorkout={stagedWorkout}
        logType={stagedLogType}
        onSave={handleConfirmSave}
        coachingMessage={stagedCoaching}
        apiKey={geminiKey}
        personality={coachPersonality}
        calorieGoal={goals.calories || 2000}
        consumedToday={todayConsumedCalories}
        onSaveTemplate={handleSaveTemplate}
        weightKg={profile.weightKg}
        initialMealType={stagedMealType}
        isEditing={editingLogId !== null}
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

      {/* 5.2. Open Food Facts search drawer */}
      <FoodSearchDrawer
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={handleSearchPick}
      />

      {/* 5.3. Custom PWA install prompt */}
      <InstallPrompt />

      {/* 5.4. First-run Onboarding / TDEE wizard */}
      <Onboarding
        isOpen={onboardingOpen}
        initialProfile={profile}
        onComplete={handleCompleteOnboarding}
        onSkip={handleSkipOnboarding}
      />

      {/* 5.5. AI Customizer Bottom Sheet Drawer */}
      <AiCustomizerDrawer
        isOpen={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        currentGoals={goals}
        currentSettings={appSettings}
        apiKey={geminiKey}
        scope={customizerScope}
        onCustomizationSuccess={handleCustomizationSuccess}
        onError={(msg) => triggerToast(msg)}
      />

      {/* 6. Footer Signature */}
      <footer style={{
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
        <span>HelloCal 🟡 Serverless & Private. Made with</span>
        <Heart size={10} color="var(--accent-rose)" fill="var(--accent-rose)" />
        <span>for healthier days.</span>
      </footer>

    </div>
  );
};
export default App;
