import type { MealLog, WorkoutLog, UserGoals, CoachPersonality, StorageData, AppSettings, WaterLog, BodyMetric, FavoriteFood, UserProfile, MealTemplate, Recipe, Supplement, HydrationLog, MealPreset } from '../types/nutrition';
import type { CustomMicro } from '../types/nutrition';
import { sanitizeMealLogs, sanitizeWorkouts, sanitizeFavorites, sanitizeMealTemplates, sanitizeWaterLogs, sanitizeBodyMetrics, sanitizeRecipes, sanitizeSupplements, sanitizeHydrationLogs, sanitizeMealPresets, sanitizeCustomMicros } from './sanitize';
import { clampGoal } from './validation';

// Bump when the on-disk shape changes in a way that needs a migration step.
// v2: rebrand HaloCal -> HelloCal migrated localStorage keys halocal_* -> hellocal_*.
// v3: seed AppSettings.customMicros (custom micronutrient HUD) from legacy visibleMicros.
const SCHEMA_VERSION = 3;

/** The starter custom-micronutrient set — all data-backed FoodItem fields so they show real intake. */
function buildDefaultMicros(goals: UserGoals, vis?: { addedSugar?: boolean; fiber?: boolean; sodium?: boolean }): CustomMicro[] {
  return [
    { id: 'micro_addedsugar', name: 'Added Sugar', emoji: '🍭', unit: 'g', dailyLimit: goals.addedSugar ?? 30, isLimit: true, color: 'var(--accent-purple)', glowColor: 'var(--accent-purple-glow)', fieldKey: 'addedSugar', hidden: vis?.addedSugar === false || undefined },
    { id: 'micro_fiber', name: 'Dietary Fiber', emoji: '🌿', unit: 'g', dailyLimit: goals.fiber ?? 30, isLimit: false, color: 'var(--accent-teal)', glowColor: 'var(--accent-teal-glow)', fieldKey: 'fiber', hidden: vis?.fiber === false || undefined },
    { id: 'micro_sodium', name: 'Sodium', emoji: '🧂', unit: 'mg', dailyLimit: goals.sodium ?? 2300, isLimit: true, color: 'var(--accent-amber)', glowColor: 'var(--accent-amber-glow)', fieldKey: 'sodium', hidden: vis?.sodium === false || undefined },
  ];
}

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
  RECIPES: 'hellocal_recipes',
  SUPPLEMENTS: 'hellocal_supplements',
  HYDRATION: 'hellocal_hydration',
  PRESETS: 'hellocal_presets',
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
  },
  showBurnBreakdown: true,
  showMealBreakdown: true,
  goalScoreBasis: 'calories'
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

      if (stored < 3) {
        // Seed customMicros from legacy visibleMicros + goals (once). Use safeParse
        // so a corrupt settings/goals value is skipped rather than throwing — a throw
        // here would be swallowed by the outer catch and the VERSION stamp below would
        // never run, re-running this migration on every load forever.
        const sRaw = localStorage.getItem(KEYS.SETTINGS);
        const s = sRaw ? safeParse(sRaw) : null;
        if (s && typeof s === 'object' && !Array.isArray(s)) {
          const sObj = s as Record<string, unknown>;
          if (!Array.isArray(sObj.customMicros) || sObj.customMicros.length === 0) {
            const gRaw = localStorage.getItem(KEYS.GOALS);
            const gParsed = gRaw ? safeParse(gRaw) : null;
            const g = (gParsed && typeof gParsed === 'object' ? gParsed : DEFAULT_GOALS) as UserGoals;
            // Sanitize so a NaN/missing goal limit can't be persisted to disk.
            sObj.customMicros = sanitizeCustomMicros(buildDefaultMicros(g, sObj.visibleMicros as { addedSugar?: boolean; fiber?: boolean; sodium?: boolean } | undefined));
            localStorage.setItem(KEYS.SETTINGS, JSON.stringify(sObj));
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

      // Goals: guard object-ness, then coerce every known numeric field to a finite,
      // in-bounds value (falling back to the default). NaN/null/string goals would
      // otherwise leak into the calorie/budget math and render as "NaN". clampGoal is
      // the same guard the import + AI-customizer paths use.
      const rawGoals = goalsRaw ? safeParse(goalsRaw) : null;
      const parsedGoals = { ...DEFAULT_GOALS } as UserGoals;
      if (rawGoals && typeof rawGoals === 'object' && !Array.isArray(rawGoals)) {
        const g = rawGoals as Record<string, unknown>;
        // null/'' read as "missing" (Number(null)===0 would otherwise clamp to the
        // bound min instead of restoring the default).
        const present = (v: unknown) => v !== undefined && v !== null && v !== '';
        (Object.keys(DEFAULT_GOALS) as (keyof UserGoals)[]).forEach((k) => {
          if (present(g[k])) parsedGoals[k] = clampGoal(k, Number(g[k]), DEFAULT_GOALS[k] as number);
        });
        // Preserve optional goals (iron/hydration) when present, clamped.
        (['iron', 'hydration'] as (keyof UserGoals)[]).forEach((k) => {
          if (present(g[k])) parsedGoals[k] = clampGoal(k, Number(g[k]), (DEFAULT_GOALS[k] as number) ?? 0);
        });
      }

      // Settings: guard object-ness so a corrupt array/scalar can't spread garbage keys.
      const rawSettings = settingsRaw ? safeParse(settingsRaw) : null;
      let parsedSettings: any = (rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)) ? rawSettings : {};
      // Handle deep merging safely to handle progressive configuration structure updates
      parsedSettings = {
        ...DEFAULT_SETTINGS,
        ...parsedSettings,
        visibleMacros: { ...DEFAULT_SETTINGS.visibleMacros, ...(parsedSettings.visibleMacros || {}) },
        visibleMicros: { ...DEFAULT_SETTINGS.visibleMicros, ...(parsedSettings.visibleMicros || {}) },
        visibleWidgets: { ...DEFAULT_SETTINGS.visibleWidgets, ...(parsedSettings.visibleWidgets || {}) },
        reminders: { ...DEFAULT_SETTINGS.reminders, ...(parsedSettings.reminders || {}) }
      };
      // customMicros is an array — assign wholesale (never spread-merge), seeding
      // data-backed defaults when absent so the micro HUD shows real intake.
      const micros = sanitizeCustomMicros(parsedSettings.customMicros);
      parsedSettings.customMicros = micros.length > 0 ? micros : buildDefaultMicros(parsedGoals, parsedSettings.visibleMicros);

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
        mealTemplates: sanitizeMealTemplates(readJSON<unknown>(KEYS.TEMPLATES, [])),
        recipes: sanitizeRecipes(readJSON<unknown>(KEYS.RECIPES, [])),
        supplements: sanitizeSupplements(readJSON<unknown>(KEYS.SUPPLEMENTS, [])),
        hydrationLogs: sanitizeHydrationLogs(readJSON<unknown>(KEYS.HYDRATION, [])),
        presets: sanitizeMealPresets(readJSON<unknown>(KEYS.PRESETS, []))
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
        mealTemplates: [],
        recipes: [],
        supplements: [],
        hydrationLogs: [],
        presets: []
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

  saveRecipes(recipes: Recipe[]): void {
    safeSet(KEYS.RECIPES, JSON.stringify(recipes));
  },

  saveSupplements(supplements: Supplement[]): void {
    safeSet(KEYS.SUPPLEMENTS, JSON.stringify(supplements));
  },

  saveHydration(logs: HydrationLog[]): void {
    safeSet(KEYS.HYDRATION, JSON.stringify(logs));
  },

  saveMealPresets(presets: MealPreset[]): void {
    safeSet(KEYS.PRESETS, JSON.stringify(presets));
  },

  clearAll(): void {
    // Remove the hellocal_* keys AND their legacy halocal_* counterparts. The v2
    // migration copies legacy data forward but leaves the originals in place, so if
    // we only cleared hellocal_* (including the VERSION key), the next mount would
    // see no version, re-enter the rebrand copy branch, and resurrect the wiped data
    // — a correctness and privacy bug. Re-stamp the version so migrate() is a no-op.
    Object.values(KEYS).forEach((k) => {
      localStorage.removeItem(k);
      const legacy = k.replace('hellocal_', 'halocal_');
      if (legacy !== k) localStorage.removeItem(legacy);
    });
    try {
      localStorage.setItem(KEYS.VERSION, String(SCHEMA_VERSION));
    } catch {
      /* best-effort */
    }
  }
};

