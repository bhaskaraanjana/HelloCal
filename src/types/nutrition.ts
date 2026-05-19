export interface FoodItem {
  id: string;
  name: string;
  quantity: string;
  calories: number;
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
  confidence: 'high' | 'guess';
}

export interface MealLog {
  id: string;
  timestamp: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: FoodItem[];
}

export interface UserGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface StorageData {
  logs: MealLog[];
  goals: UserGoals;
  geminiKey: string;
  coachPersonality: CoachPersonality;
}

export type CoachPersonality = 'encouraging' | 'strict' | 'analytical' | 'chill';

export interface CoachResponse {
  items: Omit<FoodItem, 'id'>[];
  coachingMessage: string;
}
