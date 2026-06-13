import type { MealLog, WorkoutLog, UserGoals, CoachPersonality, StorageData, AppSettings, WaterLog, BodyMetric, FavoriteFood, UserProfile } from '../types/nutrition';

const KEYS = {
  LOGS: 'halocal_logs',
  WORKOUTS: 'halocal_workouts',
  GOALS: 'halocal_goals',
  GEMINI_KEY: 'halocal_gemini_key',
  COACH: 'halocal_coach',
  SETTINGS: 'halocal_app_settings',
  WATER: 'halocal_water',
  BODY: 'halocal_body_metrics',
  FAVORITES: 'halocal_favorites',
  PROFILE: 'halocal_profile'
};

const DEFAULT_GOALS: UserGoals = {
  calories: 2000,
  protein: 130,
  carbs: 220,
  fat: 65,
  addedSugar: 30,
  fiber: 30,
  sodium: 2300,
  waterTarget: 2500
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Optional handler so the UI can surface storage failures (e.g. quota exceeded) as a toast.
let errorHandler: ((message: string) => void) | null = null;

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    console.error('localStorage write failed', e);
    const isQuota =
      e?.name === 'QuotaExceededError' ||
      e?.code === 22 ||
      /quota/i.test(String(e?.message || ''));
    const msg = isQuota
      ? 'Device storage is full. Export a backup and clear old logs in Settings.'
      : 'Could not save data on this device. Your changes may not persist.';
    errorHandler?.(msg);
  }
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'obsidian',
  visibleMacros: {
    protein: true,
    carbs: true,
    fat: true
  },
  visibleMicros: {
    addedSugar: true,
    fiber: true,
    sodium: true
  },
  visibleWidgets: {
    calorieHalo: true,
    macros: true,
    micros: true,
    workouts: true,
    mealSlots: true,
    goalCompletion: true,
    water: true,
    streak: true
  }
};

export const storage = {
  setErrorHandler(fn: (message: string) => void): void {
    errorHandler = fn;
  },

  getData(): StorageData {
    try {
      const logsRaw = localStorage.getItem(KEYS.LOGS);
      const workoutsRaw = localStorage.getItem(KEYS.WORKOUTS);
      const goalsRaw = localStorage.getItem(KEYS.GOALS);
      const keyRaw = localStorage.getItem(KEYS.GEMINI_KEY);
      const coachRaw = localStorage.getItem(KEYS.COACH);
      const settingsRaw = localStorage.getItem(KEYS.SETTINGS);

      let parsedGoals = goalsRaw ? JSON.parse(goalsRaw) : DEFAULT_GOALS;
      if (parsedGoals.addedSugar === undefined) parsedGoals.addedSugar = DEFAULT_GOALS.addedSugar;
      if (parsedGoals.fiber === undefined) parsedGoals.fiber = DEFAULT_GOALS.fiber;
      if (parsedGoals.sodium === undefined) parsedGoals.sodium = DEFAULT_GOALS.sodium;
      if (parsedGoals.waterTarget === undefined) parsedGoals.waterTarget = DEFAULT_GOALS.waterTarget;

      let parsedSettings = settingsRaw ? JSON.parse(settingsRaw) : DEFAULT_SETTINGS;
      // Handle deep merging safely to handle progressive configuration structure updates
      parsedSettings = {
        ...DEFAULT_SETTINGS,
        ...parsedSettings,
        visibleMacros: { ...DEFAULT_SETTINGS.visibleMacros, ...(parsedSettings.visibleMacros || {}) },
        visibleMicros: { ...DEFAULT_SETTINGS.visibleMicros, ...(parsedSettings.visibleMicros || {}) },
        visibleWidgets: { ...DEFAULT_SETTINGS.visibleWidgets, ...(parsedSettings.visibleWidgets || {}) }
      };

      return {
        logs: logsRaw ? JSON.parse(logsRaw) : [],
        workouts: workoutsRaw ? JSON.parse(workoutsRaw) : [],
        goals: parsedGoals,
        geminiKey: keyRaw ? atob(keyRaw) : '',
        coachPersonality: (coachRaw as CoachPersonality) || 'encouraging',
        appSettings: parsedSettings,
        waterLogs: readJSON<WaterLog[]>(KEYS.WATER, []),
        bodyMetrics: readJSON<BodyMetric[]>(KEYS.BODY, []),
        favorites: readJSON<FavoriteFood[]>(KEYS.FAVORITES, []),
        profile: readJSON<UserProfile>(KEYS.PROFILE, {})
      };
    } catch (e) {
      console.error('Error reading from localStorage', e);
      return {
        logs: [],
        workouts: [],
        goals: DEFAULT_GOALS,
        geminiKey: '',
        coachPersonality: 'encouraging',
        appSettings: DEFAULT_SETTINGS,
        waterLogs: [],
        bodyMetrics: [],
        favorites: [],
        profile: {}
      };
    }
  },

  saveLogs(logs: MealLog[]): void {
    safeSet(KEYS.LOGS, JSON.stringify(logs));
  },

  saveWorkouts(workouts: WorkoutLog[]): void {
    safeSet(KEYS.WORKOUTS, JSON.stringify(workouts));
  },

  saveGoals(goals: UserGoals): void {
    safeSet(KEYS.GOALS, JSON.stringify(goals));
  },

  saveGeminiKey(key: string): void {
    const cleanKey = key.trim();
    safeSet(KEYS.GEMINI_KEY, btoa(cleanKey));
  },

  saveCoach(coach: CoachPersonality): void {
    safeSet(KEYS.COACH, coach);
  },

  saveAppSettings(settings: AppSettings): void {
    safeSet(KEYS.SETTINGS, JSON.stringify(settings));
  },

  saveWater(water: WaterLog[]): void {
    safeSet(KEYS.WATER, JSON.stringify(water));
  },

  saveBodyMetrics(metrics: BodyMetric[]): void {
    safeSet(KEYS.BODY, JSON.stringify(metrics));
  },

  saveFavorites(favorites: FavoriteFood[]): void {
    safeSet(KEYS.FAVORITES, JSON.stringify(favorites));
  },

  saveProfile(profile: UserProfile): void {
    safeSet(KEYS.PROFILE, JSON.stringify(profile));
  },

  clearAll(): void {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  }
};

