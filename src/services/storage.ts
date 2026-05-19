import type { MealLog, UserGoals, CoachPersonality, StorageData } from '../types/nutrition';

const KEYS = {
  LOGS: 'halocal_logs',
  GOALS: 'halocal_goals',
  GEMINI_KEY: 'halocal_gemini_key',
  COACH: 'halocal_coach'
};

const DEFAULT_GOALS: UserGoals = {
  calories: 2000,
  protein: 130,
  carbs: 220,
  fat: 65
};

export const storage = {
  getData(): StorageData {
    try {
      const logsRaw = localStorage.getItem(KEYS.LOGS);
      const goalsRaw = localStorage.getItem(KEYS.GOALS);
      const keyRaw = localStorage.getItem(KEYS.GEMINI_KEY);
      const coachRaw = localStorage.getItem(KEYS.COACH);

      return {
        logs: logsRaw ? JSON.parse(logsRaw) : [],
        goals: goalsRaw ? JSON.parse(goalsRaw) : DEFAULT_GOALS,
        geminiKey: keyRaw ? atob(keyRaw) : '', // Simple base64 encode for API key to avoid raw text in plain local storage inspects
        coachPersonality: (coachRaw as CoachPersonality) || 'encouraging'
      };
    } catch (e) {
      console.error('Error reading from localStorage', e);
      return {
        logs: [],
        goals: DEFAULT_GOALS,
        geminiKey: '',
        coachPersonality: 'encouraging'
      };
    }
  },

  saveLogs(logs: MealLog[]): void {
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  },

  saveGoals(goals: UserGoals): void {
    localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
  },

  saveGeminiKey(key: string): void {
    // Basic obfuscation to avoid raw string inspect, and trim whitespace
    const cleanKey = key.trim();
    localStorage.setItem(KEYS.GEMINI_KEY, btoa(cleanKey));
  },

  saveCoach(coach: CoachPersonality): void {
    localStorage.setItem(KEYS.COACH, coach);
  },

  clearAll(): void {
    localStorage.removeItem(KEYS.LOGS);
    localStorage.removeItem(KEYS.GOALS);
    localStorage.removeItem(KEYS.GEMINI_KEY);
    localStorage.removeItem(KEYS.COACH);
  }
};
