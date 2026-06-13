import type { MealLog, WorkoutLog, UserGoals, CoachPersonality, StorageData, AppSettings, WaterLog, BodyMetric, FavoriteFood, UserProfile, MealTemplate } from '../types/nutrition';
import { sanitizeMealLogs, sanitizeWorkouts, sanitizeFavorites, sanitizeMealTemplates, sanitizeWaterLogs, sanitizeBodyMetrics } from './sanitize';

// Bump when the on-disk shape changes in a way that needs a migration step.
// v2: rebrand HaloCal -> HelloCal migrated localStorage keys halocal_* -> hellocal_*.
const SCHEMA_VERSION = 2;

const KEYS = {
  LOGS: 'hellocal_logs',
  WORKOUTS: 'hellocal_workouts',
  GOALS: 'hellocal_goals',
  GEMINI_KEY: 'hellocal_gemini_key',
  COACH: 'hellocal_coach',
  SETTINGS: 'hellocal_app_settings',
  WATER: 'hellocal_water',
  BODY: 'hellocal_body_metrics',
  FAVORITES: 'hellocal_favorites',
  PROFILE: 'hellocal_profile',
  TEMPLATES: 'hellocal_meal_templates',
  VERSION: 'hellocal_schema_version'
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

/** JSON.parse that returns null instead of throwing on malformed input. */
function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Decode the base64-obfuscated Gemini key, tolerating a corrupt value. */
function decodeKey(raw: string | null): string {
  if (!raw) return '';
  try {
    return atob(raw);
  } catch {
    return '';
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
  },
  reminders: {
    enabled: false,
    breakfast: '08:00',
    lunch: '12:30',
    dinner: '18:30'
  }
};

export const storage = {
  setErrorHandler(fn: (message: string) => void): void {
    errorHandler = fn;
  },

  /**
   * Apply any pending schema migrations and stamp the current version. Called
   * once on app init.
   * v2: the HaloCal -> HelloCal rebrand renamed every localStorage key from
   * `halocal_*` to `hellocal_*`; copy any legacy values forward so existing users
   * keep their data. Non-destructive (legacy keys are left in place).
   */
  migrate(): void {
    try {
      const stored = Number(localStorage.getItem(KEYS.VERSION) || '0');
      if (stored >= SCHEMA_VERSION) return;

      if (stored < 2) {
        for (const key of Object.values(KEYS)) {
          if (key === KEYS.VERSION) continue;
          const legacy = key.replace('hellocal_', 'halocal_');
          if (legacy !== key && localStorage.getItem(key) === null) {
            const old = localStorage.getItem(legacy);
            if (old !== null) localStorage.setItem(key, old);
          }
        }
      }

      localStorage.setItem(KEYS.VERSION, String(SCHEMA_VERSION));
    } catch {
      /* ignore — versioning is best-effort */
    }
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
        visibleWidgets: { ...DEFAULT_SETTINGS.visibleWidgets, ...(parsedSettings.visibleWidgets || {}) },
        reminders: { ...DEFAULT_SETTINGS.reminders, ...(parsedSettings.reminders || {}) }
      };

      // Defensively sanitize every collection on load so a corrupt/partial/
      // hand-edited store degrades gracefully instead of poisoning the UI.
      return {
        logs: sanitizeMealLogs(logsRaw ? safeParse(logsRaw) : []),
        workouts: sanitizeWorkouts(workoutsRaw ? safeParse(workoutsRaw) : []),
        goals: parsedGoals,
        geminiKey: decodeKey(keyRaw),
        coachPersonality: (coachRaw as CoachPersonality) || 'encouraging',
        appSettings: parsedSettings,
        waterLogs: sanitizeWaterLogs(readJSON<unknown>(KEYS.WATER, [])),
        bodyMetrics: sanitizeBodyMetrics(readJSON<unknown>(KEYS.BODY, [])),
        favorites: sanitizeFavorites(readJSON<unknown>(KEYS.FAVORITES, [])),
        profile: readJSON<UserProfile>(KEYS.PROFILE, {}),
        mealTemplates: sanitizeMealTemplates(readJSON<unknown>(KEYS.TEMPLATES, []))
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
        profile: {},
        mealTemplates: []
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

  saveMealTemplates(templates: MealTemplate[]): void {
    safeSet(KEYS.TEMPLATES, JSON.stringify(templates));
  },

  clearAll(): void {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  }
};

