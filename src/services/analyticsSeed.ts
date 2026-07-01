import type { MealLog, WaterLog, Supplement, UserGoals } from '../types/nutrition';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function mealAt(
  dayOffset: number,
  hour: number,
  mealType: MealLog['mealType'],
  items: Omit<MealLog['items'][0], 'id'>[],
  ref = Date.now()
): MealLog {
  const day = startOfDay(ref) + dayOffset * MS_PER_DAY + hour * 3600_000;
  return {
    id: `seed-${day}-${mealType}`,
    timestamp: day,
    mealType,
    items: items.map((item, i) => ({ ...item, id: `seed-item-${day}-${i}` })),
  };
}

const food = (
  name: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  extras: Partial<MealLog['items'][0]> = {}
): Omit<MealLog['items'][0], 'id'> => ({
  name,
  quantity: '1 serving',
  calories,
  protein,
  carbs,
  fat,
  confidence: 'high',
  ...extras,
});

/** ~14 days of varied meals, water, and supplements for analytics demos/tests. */
export function buildAnalyticsSeed(referenceDate = Date.now()): {
  logs: MealLog[];
  waterLogs: WaterLog[];
  supplements: Supplement[];
  goals: UserGoals;
} {
  const logs: MealLog[] = [];
  const waterLogs: WaterLog[] = [];

  const dayProfiles: { cal: number; protein: number; water: number; isWeekend: boolean }[] = [];
  for (let offset = -13; offset <= 0; offset++) {
    const d = new Date(startOfDay(referenceDate) + offset * MS_PER_DAY);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const base = isWeekend ? 2450 : 1980;
    const jitter = (offset * 37) % 280;
    dayProfiles.push({
      cal: base + jitter - (offset === -3 ? 400 : 0),
      protein: isWeekend ? 95 : offset % 4 === 0 ? 110 : 145,
      water: isWeekend ? 1600 : 2100 + (offset % 3) * 150,
      isWeekend,
    });
  }

  dayProfiles.forEach((profile, i) => {
    const offset = i - 13;
    const lunchCal = Math.round(profile.cal * 0.42);
    const dinnerCal = Math.round(profile.cal * 0.38);
    const breakfastCal = Math.round(profile.cal * 0.2);
    const pShare = profile.protein / 3;

    logs.push(
      mealAt(offset, 8, 'breakfast', [
        food('Oatmeal & berries', breakfastCal, pShare, breakfastCal * 0.55, breakfastCal * 0.15, {
          fiber: 8,
        }),
      ], referenceDate),
      mealAt(offset, 13, 'lunch', [
        food('Chicken rice bowl', lunchCal, pShare + 10, lunchCal * 0.45, lunchCal * 0.2, {
          sodium: 680,
        }),
      ], referenceDate),
      mealAt(offset, 19, 'dinner', [
        food(
          profile.isWeekend ? 'Pizza night' : 'Salmon & veg',
          dinnerCal,
          pShare - 5,
          dinnerCal * 0.35,
          dinnerCal * 0.35,
          { saturatedFat: profile.isWeekend ? 14 : 4 }
        ),
      ], referenceDate)
    );

    if (profile.isWeekend) {
      logs.push(
        mealAt(offset, 21, 'snack', [
          food('Ice cream', 320, 4, 38, 16, { addedSugar: 22 }),
        ], referenceDate)
      );
    }

    const dayStart = startOfDay(referenceDate) + offset * MS_PER_DAY;
    waterLogs.push(
      { id: `w-am-${offset}`, timestamp: dayStart + 9 * 3600_000, milliliters: Math.round(profile.water * 0.35) },
      { id: `w-pm-${offset}`, timestamp: dayStart + 17 * 3600_000, milliliters: Math.round(profile.water * 0.65) }
    );
  });

  const suppTakenDays = [-12, -11, -9, -7, -5, -3, -1, 0];
  const supplements: Supplement[] = [
    {
      id: 'seed-vitd',
      name: 'Vitamin D3',
      dosage: '2000 IU',
      schedule: 'Morning',
      takenToday: suppTakenDays.includes(0),
      lastTakenTimestamp:
        startOfDay(referenceDate) + (suppTakenDays.includes(0) ? 0 : -1) * MS_PER_DAY + 8 * 3600_000,
    },
    {
      id: 'seed-mag',
      name: 'Magnesium',
      dosage: '400mg',
      schedule: 'Evening',
      takenToday: false,
      lastTakenTimestamp: startOfDay(referenceDate) - 3 * MS_PER_DAY + 21 * 3600_000,
    },
  ];

  const goals: UserGoals = {
    calories: 2000,
    protein: 150,
    carbs: 220,
    fat: 65,
    hydration: 2000,
    fiber: 28,
    sodium: 2300,
    addedSugar: 30,
  };

  return { logs, waterLogs, supplements, goals };
}

/** Keys/values for Playwright `addInitScript` / manual localStorage seeding. */
export function analyticsSeedLocalStorage(
  referenceDate = Date.now()
): Record<string, string> {
  const { logs, waterLogs, supplements, goals } = buildAnalyticsSeed(referenceDate);
  return {
    hellocal_profile: JSON.stringify({ onboardingComplete: true }),
    hellocal_schema_version: '4',
    hellocal_logs: JSON.stringify(logs),
    hellocal_water: JSON.stringify(waterLogs),
    hellocal_supplements: JSON.stringify(supplements),
    hellocal_goals: JSON.stringify(goals),
    hellocal_workouts: '[]',
    hellocal_hydration: '[]',
  };
}
