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
}

export interface StorageData {
  logs: MealLog[];
  workouts: WorkoutLog[];
  goals: UserGoals;
  geminiKey: string;
  coachPersonality: CoachPersonality;
}

export type CoachPersonality = 'encouraging' | 'strict' | 'analytical' | 'chill';

export interface CoachResponse {
  type: 'food' | 'workout' | 'mixed';
  items?: Omit<FoodItem, 'id'>[];
  workout?: Omit<WorkoutLog, 'id'>;
  coachingMessage: string;
}
