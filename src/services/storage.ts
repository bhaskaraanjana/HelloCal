import type { MealLog, WorkoutLog, UserGoals, CoachPersonality, StorageData, AppSettings } from '../types/nutrition';

const KEYS = {
  LOGS: 'halocal_logs',
  WORKOUTS: 'halocal_workouts',
  GOALS: 'halocal_goals',
  GEMINI_KEY: 'halocal_gemini_key',
  COACH: 'halocal_coach',
  SETTINGS: 'halocal_app_settings'
};

const DEFAULT_GOALS: UserGoals = {
  calories: 2000,
  protein: 130,
  carbs: 220,
  fat: 65,
  addedSugar: 30,
  fiber: 30,
  sodium: 2300
};

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
    goalCompletion: true
  }
};

export const storage = {
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
        appSettings: parsedSettings
      };
    } catch (e) {
      console.error('Error reading from localStorage', e);
      return {
        logs: [],
        workouts: [],
        goals: DEFAULT_GOALS,
        geminiKey: '',
        coachPersonality: 'encouraging',
        appSettings: DEFAULT_SETTINGS
      };
    }
  },

  saveLogs(logs: MealLog[]): void {
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  },

  saveWorkouts(workouts: WorkoutLog[]): void {
    localStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts));
  },

  saveGoals(goals: UserGoals): void {
    localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
  },

  saveGeminiKey(key: string): void {
    const cleanKey = key.trim();
    localStorage.setItem(KEYS.GEMINI_KEY, btoa(cleanKey));
  },

  saveCoach(coach: CoachPersonality): void {
    localStorage.setItem(KEYS.COACH, coach);
  },

  saveAppSettings(settings: AppSettings): void {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },

  clearAll(): void {
    localStorage.removeItem(KEYS.LOGS);
    localStorage.removeItem(KEYS.WORKOUTS);
    localStorage.removeItem(KEYS.GOALS);
    localStorage.removeItem(KEYS.GEMINI_KEY);
    localStorage.removeItem(KEYS.COACH);
    localStorage.removeItem(KEYS.SETTINGS);
  }
};

