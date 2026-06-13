export interface FoodItem {
  id: string;
  name: string;
  quantity: string;
  calories: number;
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
  confidence: 'high' | 'guess';
  sugar?: number;       // total sugar in grams
  addedSugar?: number;  // added sugar in grams
  fiber?: number;       // fiber in grams
  sodium?: number;      // sodium in milligrams
}

export interface MealLog {
  id: string;
  timestamp: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: FoodItem[];
}

export interface WorkoutLog {
  id: string;
  timestamp: number;
  activity: string;       // e.g. "Running"
  duration: number;       // in minutes
  caloriesBurned: number; // in kcal
  notes?: string;
}

export interface UserGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  addedSugar?: number; // target limit in grams
  fiber?: number;      // target intake in grams
  sodium?: number;     // target limit in milligrams
  waterTarget?: number; // target intake in milliliters
}

export interface WaterLog {
  id: string;
  timestamp: number;
  milliliters: number;
}

export interface BodyMetric {
  id: string;
  timestamp: number;
  weight: number;       // stored in kilograms (canonical)
  unit: 'kg' | 'lb';    // unit the user entered with (for display)
  bodyFat?: number;     // percentage
  waist?: number;       // centimeters
}

export interface FavoriteFood {
  id: string;
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  addedSugar?: number;
  fiber?: number;
  sodium?: number;
  frequency: number;    // how many times logged (for recents ranking)
  lastLogged: number;   // timestamp
  pinned?: boolean;     // explicitly marked favorite
}

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
export type GoalDirection = 'lose' | 'maintain' | 'gain';

export interface UserProfile {
  age?: number;
  sex?: Sex;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: ActivityLevel;
  goalDirection?: GoalDirection;
  preferredWeightUnit?: 'kg' | 'lb';
  onboardingComplete?: boolean;
  onboardingSkipped?: boolean; // skipped setup; re-prompt once after first log
}

export interface AppSettings {
  theme: 'obsidian' | 'cyberpunk' | 'ocean' | 'emerald';
  visibleMacros: {
    protein: boolean;
    carbs: boolean;
    fat: boolean;
  };
  visibleMicros: {
    addedSugar: boolean;
    fiber: boolean;
    sodium: boolean;
  };
  visibleWidgets: {
    calorieHalo: boolean;
    macros: boolean;
    micros: boolean;
    workouts: boolean;
    mealSlots: boolean;
    goalCompletion: boolean;
    water?: boolean;
    streak?: boolean;
  };
}

export interface CommandResponse {
  updatedGoals?: Partial<UserGoals>;
  updatedSettings?: Partial<AppSettings>;
  aiResponse: string;
}

export interface StorageData {
  logs: MealLog[];
  workouts: WorkoutLog[];
  goals: UserGoals;
  geminiKey: string;
  coachPersonality: CoachPersonality;
  appSettings?: AppSettings;
  waterLogs: WaterLog[];
  bodyMetrics: BodyMetric[];
  favorites: FavoriteFood[];
  profile: UserProfile;
}

export type CoachPersonality = 'encouraging' | 'strict' | 'analytical' | 'chill';

export interface CoachResponse {
  type: 'food' | 'workout' | 'mixed';
  items?: Omit<FoodItem, 'id'>[];
  workout?: Omit<WorkoutLog, 'id'>;
  coachingMessage: string;
}

