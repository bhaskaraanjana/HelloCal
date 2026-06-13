# HelloCal merge plan (ours = base, port upstream's features)

Base decision: **OURS** (HelloCal). Ours owns the engineering core (131 tests, native
Capacitor, sanitize-on-load, schema migrations, error boundary, lazy Chart.js).
Upstream (`bhaskaraanjana/Halo-Cal`, cloned at `C:\DEV\halo-cal-upstream`) is more
feature-rich; its standout pieces are additive modules we graft onto ours.

Branch: `merge-upstream`.

## Steps (commit each green)
1. [x] Branch + green baseline (131 tests).
2. [ ] Types: add `iron?` (FoodItem/RecipeIngredient), `iron?`/`hydration?` (UserGoals);
   add Recipe, RecipeIngredient, MealPreset, Supplement, CustomMicro, HydrationLog;
   AppSettings.visibleMicros{} -> customMicros[] (keep reminders/water/streak);
   extend StorageData union; CommandResponse.newSupplement?.
3. [ ] Storage v3: KEYS + save/get + sanitize for presets/hydrationLogs/recipes/supplements;
   migrate() v3 (visibleMicros->customMicros; water->hydration; seed presets/recipes;
   goals.iron=18, hydration from waterTarget). Round-trip in import/export/clear.
4. [ ] gemini.ts: add fetchSupplementInfo, fetchMicronutrientInfo, parseRecipeDescription.
5. [ ] **Analytics fix (headline):** replace ours with upstream's period-aware version;
   keep lazy+Suspense; pass workouts; ChartJS.register(...registerables); +Analytics.test.
6. [ ] HydrationTracker (replace WaterTracker UI), HydrationLog{amount}, hydration CSS vars.
7. [ ] Supplements: state + daily-reset-on-init + widget + AI add (fetchSupplementInfo).
8. [ ] Dashboard: render customMicros[]; port drag-drop/collapse onto OURS clean Dashboard
   (NOT upstream monolith); add hydration/supplement/micros panels; fix Dashboard.test.
9. [ ] RecipeBox + CustomModal + Recipes tab; MealPresetsShelf + auto-save-on-keyword.
10. [ ] FoodTimeline: merge upstream missed-meal modal + clone/preset INTO ours (keep
    copyDay/copyMeal/scaleItem/edit); VoiceInput customRecipes prop.
11. [ ] Settings: Health Apps connect panel + CustomModal confirms; keep reminders/cloud.
12. [ ] (optional) syncEngine behind lazy getSupabase, cloud optional, sanitize pulls.
13. [ ] Branding consolidation (HelloCal everywhere) + tooling (vitest.config + setup.ts) + sw v4.
14. [ ] Validate: build + full vitest + **Playwright UI tests** (no auth gate; log meal;
    analytics toggles; hydration; supplement; recipe; missed-meal; export/import round-trip).

## Hard risks
- AppSettings visibleMicros->customMicros breaks Dashboard.test (update fixtures + v3 migration).
- Water->Hydration model/key/target collision — migrate milliliters->amount or lose history.
- Don't adopt upstream's forced auth/guest gate (keep no-login UX).
- Don't swap the 1942-line upstream Dashboard wholesale (lose memoization/tests).
- StorageData union grows: import/export/clear must round-trip every new field via sanitize.
- Keep ours' richer RefinementModal/VoiceInput signatures.
- Branding: ours=HelloCal; ensure no half-rebrand.
