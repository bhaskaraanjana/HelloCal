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
  iron?: number;        // iron in milligrams
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
  waterTarget?: number; // target intake in milliliters (legacy water tracker)
  hydration?: number;   // target water intake in ml (HydrationTracker)
  iron?: number;        // target iron in mg
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

export interface MealTemplate {
  id: string;
  name: string;
  items: Omit<FoodItem, 'id'>[];
  createdAt: number;
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
  // Legacy fixed micros (addedSugar/fiber/sodium). customMicros[] (below) is the
  // newer, more expressive model adopted from upstream; both coexist during merge.
  customMicros?: CustomMicro[];
  visibleWidgets: {
    calorieHalo: boolean;
    macros: boolean;
    micros: boolean;
    workouts: boolean;
    mealSlots: boolean;
    goalCompletion: boolean;
    water?: boolean;
    streak?: boolean;
    hydration?: boolean;
    supplements?: boolean;
  };
  reminders?: MealReminders;
  supplementReminders?: SupplementReminders;
  // Per-panel display options (ultra-customisable dashboard panels)
  showBurnBreakdown?: boolean;   // calorieHalo: show "Base + Burn" subline
  showMealBreakdown?: boolean;   // mealSlots: show B/L/D/S chips
  goalScoreBasis?: 'calories' | 'macros' | 'deficit'; // goalCompletion scoring
}

export interface CustomMicro {
  id: string;
  name: string;
  emoji: string;
  unit: string;
  dailyLimit: number;
  isLimit: boolean;
  color: string;
  glowColor: string;
  fieldKey: string;
  hidden?: boolean; // hidden from the dashboard HUD but kept configured
}

export interface MealReminders {
  enabled: boolean;
  breakfast: string; // "HH:MM" 24h local time
  lunch: string;
  dinner: string;
  snack: string;
}

export interface SupplementReminders {
  enabled: boolean;
  morning: string;   // "HH:MM" 24h local time
  lunch: string;
  bedtime: string;
}

export interface CommandResponse {
  updatedGoals?: Partial<UserGoals>;
  updatedSettings?: Partial<AppSettings>;
  newSupplement?: {
    name: string;
    dosage: string;
    schedule: string;
  };
  aiResponse: string;
}

// ----- Upstream feature models (hydration, supplements, presets, recipes) -----

export interface HydrationLog {
  id: string;
  timestamp: number;
  amount: number; // in ml
}

export interface Supplement {
  id: string;
  name: string;
  dosage: string;
  schedule: string;
  takenToday: boolean;
  lastTakenTimestamp?: number;
}

export interface MealPreset {
  id: string;
  name: string;
  icon: string; // emoji like 🥤, 🥣
  items: Omit<FoodItem, 'id'>[];
  isCustomFood?: boolean;
}

export interface RecipeIngredient {
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
  iron?: number;
}

export interface Recipe {
  id: string;
  name: string;
  icon: string; // emoji like 🥣
  servings: number;
  yieldUnit: string; // e.g. "cup", "muffin", "slice", "serving"
  ingredients: RecipeIngredient[];
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
  mealTemplates?: MealTemplate[];
  hydrationLogs?: HydrationLog[];
  supplements?: Supplement[];
  presets?: MealPreset[];
  recipes?: Recipe[];
}

export type CoachPersonality = 'encouraging' | 'strict' | 'analytical' | 'chill';

export interface CoachResponse {
  type: 'food' | 'workout' | 'mixed';
  items?: Omit<FoodItem, 'id'>[];
  workout?: Omit<WorkoutLog, 'id'>;
  coachingMessage: string;
}

