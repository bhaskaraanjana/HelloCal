# Internal Documentation

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
