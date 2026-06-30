# Internal Documentation

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
