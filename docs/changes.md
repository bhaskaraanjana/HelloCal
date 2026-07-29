# Internal Documentation

## Version 1.0.90
* **Date**: July 29, 2026
* **Changes**:
  * **Profile-based All-Macro Goal Recalculations**: Updated `updateNutrientGoals` and `Dashboard` to dynamically recalculate ALL macronutrient targets (protein based on `weightKg * 1.8`, fat, carbs) and micronutrient targets (fiber) when caloric intake is changed.
  * **AI Supplement Macro & Micro Fetching**: Updated Gemini supplement advisor to fetch all associated micro and macro nutrients (calories, protein, carbs, fat, fiber, sodium, added sugar, iron) when looking up or adding supplements. Added an AI "✨ Auto-fill" button to supplement cards in the settings drawer.

## Version 1.0.89
* **Date**: July 29, 2026
* **Changes**:
  * **Dynamic Nutrient Limit Updates**: Automatically recalculates macro limits (protein, fat, carbs) and micro limits (fiber) when the calorie target is changed or updated on the dashboard.
  * **Supplement Nutrient Integration**: Added optional macro/micro properties to supplements. Taken supplements now count directly towards daily calorie, macro, and micro consumed totals across the dashboard, progress rings, and analytics history.

## Version 1.0.88
* **Date**: July 7, 2026
* **Changes**:
  * **Design Critique & Usability Fixes**:
    * **Step-by-Step Onboarding**: Refactored [Onboarding.tsx](file:///c:/dev/HelloCal/src/components/Onboarding.tsx) into a 3-step wizard with progress indicators, solid headings (replacing banned text gradients), and sequential validation.
    * **Custom Dialog Modals**: Replaced native browser `alert()` and `confirm()` popup boxes in [Settings.tsx](file:///c:/dev/HelloCal/src/components/Settings.tsx) with custom glassmorphic `CustomModal` dialogs.
    * **GPU-Accelerated Progress Transitions**: Replaced layout-reflowing `width` transitions in [index.css](file:///c:/dev/HelloCal/src/index.css) with GPU-friendly `transform: scaleX(var(--progress-scale, 0))` on progress bars in [HydrationTracker.tsx](file:///c:/dev/HelloCal/src/components/HydrationTracker.tsx) and [AnalyticsMicroPanel.tsx](file:///c:/dev/HelloCal/src/components/analytics/AnalyticsMicroPanel.tsx).
    * **Design System & Style Alignments**: Replaced `.analytics-insight` side-stripes with full-border glass cards and background tints. Aligned border-radius and colors to theme design tokens (`--radius-sm`, `--radius-xs`).
    * **Chart Theme Colors**: Aligned axes tick colors in [analyticsChartTheme.ts](file:///c:/dev/HelloCal/src/services/analyticsChartTheme.ts) to system muted steel (`#aab6c7`).
    * **Voice Recording Keyboard Shortcut**: Added keydown window listeners in [VoiceInput.tsx](file:///c:/dev/HelloCal/src/components/VoiceInput.tsx) to trigger/toggle voice input using the Spacebar shortcut when typing inputs are inactive.
    * **Interactive Logo Click Easter Egg**: Added click Easter egg in [App.tsx](file:///c:/dev/HelloCal/src/App.tsx) and [index.css](file:///c:/dev/HelloCal/src/index.css) (Variant 4 accepted via Impeccable live server) that triggers a chromatic aberration glitch animation and fires neon confetti sparks.
    * **Test Verification**: Created `.env.test` file to isolate Supabase credentials in tests, updated stale `storage.test.ts` schema expectations, and deleted obsolete first-log tests to make the test suite pass with 100% success.

## Version 1.0.87
* **Date**: July 7, 2026
* **Changes**:
  * **Impeccable Setup & Critique**: Initiated dual-agent design assessment critique snapshotted to `.impeccable/critique/` database.

## Version 1.0.86
* **Date**: June 30, 2026
* **Changes**:
  * **Fix all 5 detect anti-patterns**:
    * Replaced overused `Inter` body font with `DM Sans` across `index.css`, `DESIGN.md`.
    * Replaced undocumented `#000` in `BarcodeScanner.tsx` with `var(--bg-primary)`.
    * Replaced undocumented `#334155`/`#475569` bottle cap colors in `HydrationTracker.tsx` with `var(--bg-secondary)` / `var(--bg-glass-active)`.
    * Replaced off-scale `3px` border-radius in `HydrationTracker.tsx` with `var(--radius-xs)`.
    * Added `--radius-xs: 4px` token to `index.css` and `2xs: 4px` to `DESIGN.md` rounded scale.

## Version 1.0.85
* **Date**: June 30, 2026
* **Changes**:
  * **Homepage Decluttering**:
    * **Components**: [App.tsx](file:///c:/dev/HelloCal/src/App.tsx), [Dashboard.tsx](file:///c:/dev/HelloCal/src/components/Dashboard.tsx)
    * **Action**: Removed Quick Start logging nudge card, Drag Handle tip text, and "Serverless & Private" reference in the footer.
    * **Details**: Cleaned up the dashboard grid header to directly show the panels grid without cluttering layout guidelines. Simplified the footer text.

## Version 1.0.84
* **Date**: June 30, 2026
* **Changes**:
  * **Update Variant 2 (Water Bottle shape)**:
    * **Component**: [HydrationTracker.tsx](file:///c:/dev/HelloCal/src/components/HydrationTracker.tsx)
    * **Action**: Updated Variant 2 from an oval capsule beaker shape to a sleek sports water bottle structure.
    * **Details**: Removed the `border-radius: 40px` and styled the container with flat-bottomed rounded corners (`border-radius: 12px 12px 24px 24px`), a linear-gradient dark slate bottle cap, and a translucent collar/neck piece.

## Version 1.0.83
* **Date**: June 30, 2026
* **Changes**:
  * **Redesign Water Icon**:
    * **Component**: [HydrationTracker.tsx](file:///c:/dev/HelloCal/src/components/HydrationTracker.tsx)
    * **Action**: Replaced simple lucide Droplet icon with a custom glowing dual-layer SVG water droplet icon.
    * **Details**: Added stroke drop-shadow neon aura filter matching the Obsidian Console design rules, and scaled with a secondary internal filled droplet indicator at 0.35 opacity.

## Version 1.0.82
* **Date**: June 30, 2026
* **Changes**:
  * **Move Streak Badge to App Logo (Quieter Design)**:
    * **Component**: [App.tsx](file:///c:/dev/HelloCal/src/App.tsx)
    * **Action**: Hidden the main dashboard card `StreakBadge` completely.
    * **Details**: Integrated a smaller, quieter `X-day streak` caption display directly under the `HelloCal` text logo in the header logo container. Removed unused `StreakBadge` import.

## Version 1.0.81
* **Date**: June 30, 2026
* **Changes**:
  * **Remove Quick Add Component**:
    * **Component**: [QuickLogBar.tsx](file:///c:/dev/HelloCal/src/components/QuickLogBar.tsx)
    * **Details**: Hidden the Quick Add section from the dashboard by returning `null` from the component.
  * **Version Display in Settings**:
    * **Component**: [Settings.tsx](file:///c:/dev/HelloCal/src/components/Settings.tsx)
    * **Details**: Displayed the version and commit hash footer at the bottom of settings.
