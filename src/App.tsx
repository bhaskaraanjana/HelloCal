import React, { useState, useEffect, useRef } from 'react';
import type { MealLog, FoodItem, WorkoutLog, UserGoals, CoachPersonality, CoachResponse, AppSettings, WaterLog, BodyMetric, FavoriteFood, UserProfile } from './types/nutrition';
import { storage } from './services/storage';
import { computeStreak, totalLoggedDays } from './services/insights';
import { initNative, haptic, hapticSuccess } from './services/native';
import { Dashboard } from './components/Dashboard';
import { VoiceInput } from './components/VoiceInput';
import { FoodTimeline } from './components/FoodTimeline';
import { Analytics } from './components/Analytics';
import { Settings } from './components/Settings';
import { RefinementModal } from './components/RefinementModal';
import { Utensils, LayoutDashboard, BarChart2, Settings as SettingsIcon, Heart, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AiCustomizerDrawer } from './components/AiCustomizerDrawer';
import { WaterTracker } from './components/WaterTracker';
import { StreakBadge } from './components/StreakBadge';
import { QuickLogBar } from './components/QuickLogBar';
import { WeightTracker } from './components/WeightTracker';
import { Onboarding } from './components/Onboarding';
import { InstallPrompt } from './components/InstallPrompt';

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
  const [customizerScope, setCustomizerScope] = useState<'general' | 'macronutrients' | 'micronutrients' | 'widgets'>('general');

  // Loading indicator on first mount
  const [isLoaded, setIsLoaded] = useState(false);

  // Tab View
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'analytics' | 'settings'>('dashboard');

  // Refinement modal states
  const [refinementOpen, setRefinementOpen] = useState(false);
  const [stagedItems, setStagedItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [stagedWorkout, setStagedWorkout] = useState<Omit<WorkoutLog, 'id'> | null>(null);
  const [stagedLogType, setStagedLogType] = useState<'food' | 'workout' | 'mixed'>('food');
  const [stagedCoaching, setStagedCoaching] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

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
    setFavorites(data.favorites || []);
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
      if (tab === 'analytics' || tab === 'timeline' || tab === 'settings' || tab === 'dashboard') {
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
          setRefinementOpen(true);
        },
      });
      return;
    }

    openRefinement(response);
  };

  const handleConfirmSave = (itemsToLog: Omit<FoodItem, 'id'>[], workoutToLog: Omit<WorkoutLog, 'id'> | null): string | undefined => {
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
          l.id === editingLogId ? { ...l, items: reindexed } : l
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

    // 1. Handle Food Items
    if (itemsToLog.length > 0) {
      // Detect meal slot type automatically based on local time
      const hour = new Date().getHours();
      let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'snack';
      if (hour >= 4 && hour < 11) {
        mealType = 'breakfast';
      } else if (hour >= 11 && hour < 16) {
        mealType = 'lunch';
      } else if (hour >= 17 && hour < 22) {
        mealType = 'dinner';
      }

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

      const mealCals = loggedItems.reduce((sum, item) => sum + item.calories, 0);
      triggerToast(`Logged ${loggedItems.length} food item(s) successfully! (+${mealCals} kcal)`);
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

      triggerToast(`Workout logged successfully! (-${workoutToLog.caloriesBurned} kcal)`);
      savedWorkout = true;
    }

    // Celebration triggers
    if (savedFood || savedWorkout) {
      // Sum today's remaining calories to see if close to target budget
      const today = new Date();
      today.setHours(0,0,0,0);
      const startOfToday = today.getTime();
      
      const todayLogs = logs.filter(log => log.timestamp >= startOfToday);
      let consumed = itemsToLog.reduce((s, i) => s + i.calories, 0);
      todayLogs.forEach(log => {
        log.items.forEach(item => { consumed += item.calories; });
      });

      const todayWorkouts = workouts.filter(w => w.timestamp >= startOfToday);
      let activeBurn = workoutToLog ? workoutToLog.caloriesBurned : 0;
      todayWorkouts.forEach(w => { activeBurn += w.caloriesBurned; });

      const expandedGoal = (goals.calories || 2000) + activeBurn;

      // Celebrate landing within a symmetric ±50 kcal band of the (workout-expanded)
      // target — not a lopsided window that rewarded going 100 kcal over.
      if (consumed >= expandedGoal - 50 && consumed <= expandedGoal + 50) {
        fireConfetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        triggerToast('🎯 Incredible! You hit your calorie target halo perfectly today!');
        hapticSuccess();
      } else {
        fireConfetti({ particleCount: 60, spread: 40, origin: { y: 0.8 } });
        haptic('light');
      }
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
    const updatedLogs = logs.filter(log => log.id !== id);
    setLogs(updatedLogs);
    storage.saveLogs(updatedLogs);
    triggerToast('Log entry removed.');
  };

  const handleDeleteWorkoutEntry = (id: string) => {
    const updatedWorkouts = workouts.filter(w => w.id !== id);
    setWorkouts(updatedWorkouts);
    storage.saveWorkouts(updatedWorkouts);
    triggerToast('Workout entry removed.');
  };

  // Open the refinement modal pre-filled with an existing meal's items, in edit mode.
  const handleEditLog = (log: MealLog) => {
    setStagedItems(log.items.map(({ id, ...rest }) => rest));
    setStagedWorkout(null);
    setStagedLogType('food');
    setStagedCoaching('Editing a logged meal — adjust items, quantities, or remove them, then save.');
    setEditingLogId(log.id);
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
      id: `meal_${now}_${i}`,
      timestamp: now,
      mealType: l.mealType,
      items: l.items.map((it, j) => ({
        ...it,
        id: `item_${now}_${i}_${j}`,
      })),
    }));
    const updated = [...copies, ...logs];
    setLogs(updated);
    storage.saveLogs(updated);
    triggerToast(`Copied ${sourceLogs.length} meal(s) to today. 📋`);
    fireConfetti({ particleCount: 50, spread: 40, origin: { y: 0.8 } });
  };

  const handleImportJson = (jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (Array.isArray(parsed.logs) && parsed.goals) {
        storage.saveLogs(parsed.logs);
        storage.saveGoals(parsed.goals);
        if (parsed.workouts) {
          storage.saveWorkouts(parsed.workouts);
          setWorkouts(parsed.workouts);
        } else {
          storage.saveWorkouts([]);
          setWorkouts([]);
        }
        if (parsed.geminiKey) storage.saveGeminiKey(parsed.geminiKey);
        if (parsed.coachPersonality) storage.saveCoach(parsed.coachPersonality);
        if (parsed.appSettings) {
          storage.saveAppSettings(parsed.appSettings);
          setAppSettings(parsed.appSettings);
        }
        if (Array.isArray(parsed.waterLogs)) {
          storage.saveWater(parsed.waterLogs);
          setWaterLogs(parsed.waterLogs);
        }
        if (Array.isArray(parsed.bodyMetrics)) {
          storage.saveBodyMetrics(parsed.bodyMetrics);
          setBodyMetrics(parsed.bodyMetrics);
        }
        if (Array.isArray(parsed.favorites)) {
          storage.saveFavorites(parsed.favorites);
          setFavorites(parsed.favorites);
        }
        if (parsed.profile) {
          storage.saveProfile(parsed.profile);
          setProfile(parsed.profile);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
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
    handleConfirmSave([item], null);
  };

  const handleTogglePin = (id: string) => {
    const updated = favorites.map((f) => (f.id === id ? { ...f, pinned: !f.pinned } : f));
    setFavorites(updated);
    storage.saveFavorites(updated);
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
      newGoals = { ...goals, ...updatedGoals };
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
          src="/favicon.png" 
          alt="HaloCal Logo" 
          className="loading-logo"
        />
        <span>Powering HaloCal...</span>
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
    profile
  });

  // Derived dashboard values
  const startOfToday = startOfTodayTs();
  const waterTodayMl = waterLogs
    .filter((w) => w.timestamp >= startOfToday)
    .reduce((s, w) => s + w.milliliters, 0);
  const streak = computeStreak(logs);
  const lifetimeDays = totalLoggedDays(logs);

  return (
    <div className="app-container">
      
      {/* 1. Header Layout & Navigation Tabs */}
      <header className="header">
        <div className="logo-container">
          <img 
            src="/favicon.png" 
            alt="HaloCal Logo" 
            className="header-logo"
          />
          <h1 className="logo-text">Halo<span>Cal</span></h1>
        </div>

        {/* Dynamic Navigation Board */}
        <nav className="nav-tabs">
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <Utensils size={16} />
            <span>Timeline</span>
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart2 size={16} />
            <span>Analytics</span>
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={16} />
            <span>Settings</span>
          </button>
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
        />
      </section>

      {/* 3. Dynamic Tab Portals */}
      <main style={{ flex: 1, marginBottom: '3rem' }}>
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {appSettings.visibleWidgets.streak !== false && (
              <StreakBadge streak={streak} totalDays={lifetimeDays} />
            )}
            <QuickLogBar
              favorites={favorites}
              onQuickLog={handleQuickLog}
              onTogglePin={handleTogglePin}
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
          <FoodTimeline
            logs={logs}
            workouts={workouts}
            onDeleteLog={handleDeleteLogEntry}
            onDeleteWorkout={handleDeleteWorkoutEntry}
            onEditLog={handleEditLog}
            onCopyDay={handleCopyDay}
            goals={goals}
          />
        )}
        
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Analytics logs={logs} goals={goals} />
            <WeightTracker
              metrics={bodyMetrics}
              preferredUnit={profile.preferredWeightUnit || 'kg'}
              onAddMetric={handleAddMetric}
              onDeleteMetric={handleDeleteMetric}
            />
          </div>
        )}
        
        {activeTab === 'settings' && (
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
          />
        )}
      </main>

      {/* 4. Interactive Staged Review Modal */}
      <RefinementModal
        isOpen={refinementOpen}
        onClose={() => { setRefinementOpen(false); setEditingLogId(null); }}
        parsedItems={stagedItems}
        parsedWorkout={stagedWorkout}
        logType={stagedLogType}
        onSave={handleConfirmSave}
        coachingMessage={stagedCoaching}
        apiKey={geminiKey}
        personality={coachPersonality}
      />

      {/* 5. Sleek Toast Notification Banner */}
      {toast && (
        <div className="toast-container">
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
        <span>HaloCal 🟡 Serverless & Private. Made with</span>
        <Heart size={10} color="var(--accent-rose)" fill="var(--accent-rose)" />
        <span>for healthier days.</span>
      </footer>

    </div>
  );
};
export default App;
