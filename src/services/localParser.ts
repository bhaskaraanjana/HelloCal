import foodDb from '../assets/food-db.json';
import type { FoodItem, CoachResponse } from '../types/nutrition';

// Interface for localized database item
interface DbFood {
  key: string;
  name: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
}

export const localParser = {
  parseText(text: string): CoachResponse {
    const normalized = text.toLowerCase().trim();
    const items: Omit<FoodItem, 'id'>[] = [];
    
    // Split by common separators to identify separate food items
    // e.g. "2 eggs, a slice of toast, and some coffee" -> ["2 eggs", "a slice of toast", "some coffee"]
    const parts = normalized.split(/\band\b|\bwith\b|\bplus\b|,/);

    for (let part of parts) {
      part = part.trim();
      if (!part) continue;

      // Extract quantities
      // Regex matches numbers like "2", "1.5", "100", etc.
      const quantityMatch = part.match(/(\d+(?:\.\d+)?)\s*(g|grams|oz|ounces|cup|cups|serving|servings|slice|slices|piece|pieces|scoop|scoops|can|cans|glass|glasses|ml|medium)?/);
      let quantityVal = 1;
      let unit = '';
      
      if (quantityMatch) {
        quantityVal = parseFloat(quantityMatch[1]);
        unit = quantityMatch[2] || '';
      }

      // Try to find the closest food item key in our database
      let matchedFood: DbFood | null = null;
      let bestMatchScore = 0;

      for (const food of (foodDb as DbFood[])) {
        // Simple word checking: if the food key is contained in the text segment, or vice-versa
        // E.g., part = "scrambled eggs" -> matches food key "egg scrambled" or "egg"
        const foodWords = food.key.split(' ');
        let matchCount = 0;
        
        for (const word of foodWords) {
          if (part.includes(word)) {
            matchCount++;
          }
        }

        if (matchCount > 0) {
          const score = matchCount / foodWords.length;
          if (score > bestMatchScore) {
            bestMatchScore = score;
            matchedFood = food;
          }
        }
      }

      if (matchedFood) {
        // Calculate multiplier based on quantity and database serving size
        let multiplier = 1;

        const dbServing = matchedFood.servingSize.toLowerCase();
        const dbQuantityMatch = dbServing.match(/(\d+)\s*(g|ml|oz)/);

        if (dbQuantityMatch && unit && (unit.startsWith('g') || unit.startsWith('m') || unit.startsWith('o'))) {
          // If both have weight-based units, calculate exact ratio
          const dbWeight = parseFloat(dbQuantityMatch[1]);
          // Convert oz to g if needed (approx 28.3)
          const parsedWeight = unit.startsWith('oz') ? quantityVal * 28.3 : quantityVal;
          multiplier = parsedWeight / dbWeight;
        } else {
          // Fallback to direct multiplier (e.g. "3 eggs" vs serving "1 large" -> multiplier = 3)
          multiplier = quantityVal;
        }

        items.push({
          name: matchedFood.name,
          quantity: quantityMatch ? `${quantityVal} ${unit || 'serving'}`.trim() : matchedFood.servingSize,
          calories: Math.round(matchedFood.calories * multiplier),
          protein: Math.round(matchedFood.protein * multiplier * 10) / 10,
          carbs: Math.round(matchedFood.carbs * multiplier * 10) / 10,
          fat: Math.round(matchedFood.fat * multiplier * 10) / 10,
          confidence: 'high'
        });
      } else {
        // If we really can't find anything, try to capture if they typed a raw calorie amount
        // E.g. "300 calories of pizza" or "snack 150 kcal"
        const calorieExtract = part.match(/(\d+)\s*(?:cal|calories|kcal)/);
        if (calorieExtract) {
          const cals = parseInt(calorieExtract[1]);
          items.push({
            name: part.replace(/(\d+)\s*(?:cal|calories|kcal)/, '').replace(/\s+/g, ' ').trim() || 'Custom Meal',
            quantity: '1 serving',
            calories: cals,
            protein: Math.round((cals * 0.15) / 4), // Rough estimate: 15% protein
            carbs: Math.round((cals * 0.5) / 4),   // Rough estimate: 50% carbs
            fat: Math.round((cals * 0.35) / 9),     // Rough estimate: 35% fat
            confidence: 'guess'
          });
        }
      }
    }

    // Default if absolutely nothing was resolved
    if (items.length === 0) {
      items.push({
        name: text.length > 30 ? text.substring(0, 30) + '...' : text,
        quantity: '1 serving',
        calories: 150,
        protein: 5,
        carbs: 20,
        fat: 5,
        confidence: 'guess'
      });
    }

    const totalCals = items.reduce((sum, item) => sum + item.calories, 0);
    
    // Friendly fallback message
    const coachingMessage = `Offline Mode: Logged ${items.length} item(s) for a total of ~${totalCals} kcal. Activate the "Gemini AI Supermode" in settings to unlock smart portion sizes and customized coaching feedback!`;

    return {
      type: 'food',
      items,
      coachingMessage
    };
  }
};
