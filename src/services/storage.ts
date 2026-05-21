import type { MealLog, WorkoutLog, UserGoals, CoachPersonality, StorageData } from '../types/nutrition';

const KEYS = {
  LOGS: 'halocal_logs',
  WORKOUTS: 'halocal_workouts',
  GOALS: 'halocal_goals',
  GEMINI_KEY: 'halocal_gemini_key',
  COACH: 'halocal_coach'
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

export const storage = {
  getData(): StorageData {
    try {
      const logsRaw = localStorage.getItem(KEYS.LOGS);
      const workoutsRaw = localStorage.getItem(KEYS.WORKOUTS);
      const goalsRaw = localStorage.getItem(KEYS.GOALS);
      const keyRaw = localStorage.getItem(KEYS.GEMINI_KEY);
      const coachRaw = localStorage.getItem(KEYS.COACH);

      let parsedGoals = goalsRaw ? JSON.parse(goalsRaw) : DEFAULT_GOALS;
      if (parsedGoals.addedSugar === undefined) parsedGoals.addedSugar = DEFAULT_GOALS.addedSugar;
      if (parsedGoals.fiber === undefined) parsedGoals.fiber = DEFAULT_GOALS.fiber;
      if (parsedGoals.sodium === undefined) parsedGoals.sodium = DEFAULT_GOALS.sodium;

      return {
        logs: logsRaw ? JSON.parse(logsRaw) : [],
        workouts: workoutsRaw ? JSON.parse(workoutsRaw) : [],
        goals: parsedGoals,
        geminiKey: keyRaw ? atob(keyRaw) : '',
        coachPersonality: (coachRaw as CoachPersonality) || 'encouraging'
      };
    } catch (e) {
      console.error('Error reading from localStorage', e);
      return {
        logs: [],
        workouts: [],
        goals: DEFAULT_GOALS,
        geminiKey: '',
        coachPersonality: 'encouraging'
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

  clearAll(): void {
    localStorage.removeItem(KEYS.LOGS);
    localStorage.removeItem(KEYS.WORKOUTS);
    localStorage.removeItem(KEYS.GOALS);
    localStorage.removeItem(KEYS.GEMINI_KEY);
    localStorage.removeItem(KEYS.COACH);
  }
};
