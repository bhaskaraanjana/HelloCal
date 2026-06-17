import { Capacitor } from '@capacitor/core';
import type { MealReminders, SupplementReminders, Supplement } from '../types/nutrition';

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const getPlatform = (): string => Capacitor.getPlatform();

/**
 * Initialize native chrome (status bar + splash) once the app has mounted.
 * No-ops on the web. Failures are swallowed so the web build never breaks.
 */
export async function initNative(): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    if (getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0a0b10' });
    }
  } catch (e) {
    console.warn('StatusBar init skipped', e);
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (e) {
    console.warn('SplashScreen hide skipped', e);
  }
}

type HapticStyle = 'light' | 'medium' | 'heavy';

/** Fire a haptic impact on native devices; silent no-op on web. */
export async function haptic(style: HapticStyle = 'medium'): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[style] });
  } catch {
    /* ignore */
  }
}

/** A celebratory success haptic pattern (notification) on native. */
export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* ignore */
  }
}

/**
 * Share text/JSON. Uses the native share sheet on device and the Web Share API
 * (or a download fallback) in the browser.
 */
export async function shareText(title: string, text: string, filename = 'hellocal-backup.json'): Promise<boolean> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text });
      return true;
    } catch {
      return false;
    }
  }
  // Web: prefer the Web Share API if present.
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title, text });
      return true;
    } catch {
      /* user cancelled or unsupported — fall through to download */
    }
  }
  // Fallback: download as a file.
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

// ----- Meal reminders -----

type ReminderDef = { id: number; slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'; time: string; title: string; body: string };

const reminderDefs = (r: MealReminders): ReminderDef[] => [
  { id: 1, slot: 'breakfast', time: r.breakfast, title: '🍳 Breakfast time', body: 'Log your breakfast in HelloCal to stay on your halo.' },
  { id: 2, slot: 'lunch', time: r.lunch, title: '🥗 Lunch check-in', body: 'Got a minute? Log your lunch in HelloCal.' },
  { id: 3, slot: 'dinner', time: r.dinner, title: '🍱 Dinner time', body: 'Round out your day — log dinner in HelloCal.' },
  { id: 4, slot: 'snack', time: r.snack, title: '🍎 Snack check-in', body: 'Quick energy boost? Log your snack in HelloCal.' },
];

export const parseHM = (hm: string): { hour: number; minute: number } | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

/** Request notification permission on native (LocalNotifications) or web (Notification API). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const res = await LocalNotifications.requestPermissions();
      return res.display === 'granted';
    } catch {
      return false;
    }
  }
  if (typeof Notification === 'undefined') return false;
  try {
    if (Notification.permission === 'granted') return true;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Schedule (or clear) daily meal reminders. Native only — uses repeating local
 * notifications. On web this is a no-op (background web push needs a server);
 * the app fires best-effort foreground nudges via showLocalNotification instead.
 */
export async function scheduleMealReminders(reminders: MealReminders): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const defs = reminderDefs(reminders);
    // Always clear the prior meal-reminder set first.
    await LocalNotifications.cancel({ notifications: defs.map((d) => ({ id: d.id })) });
    if (!reminders.enabled) return;
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;
    const toSchedule = defs
      .map((d) => {
        const hm = parseHM(d.time);
        if (!hm) return null;
        return {
          id: d.id,
          title: d.title,
          body: d.body,
          schedule: { on: { hour: hm.hour, minute: hm.minute }, allowWhileIdle: true, repeats: true },
        };
      })
      .filter(Boolean);
    if (toSchedule.length) {
      await LocalNotifications.schedule({ notifications: toSchedule as never });
    }
  } catch (e) {
    console.warn('scheduleMealReminders failed', e);
  }
}

/**
 * Schedule (or clear) daily supplement reminders. Native only — uses repeating local
 * notifications. On web this is a no-op; the app fires best-effort foreground nudges instead.
 */
export async function scheduleSupplementReminders(reminders: SupplementReminders, supplements: Supplement[]): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    // Always clear the prior supplement-reminder set first (ids 11, 12, 13).
    await LocalNotifications.cancel({ notifications: [{ id: 11 }, { id: 12 }, { id: 13 }] });
    if (!reminders.enabled) return;
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;
    
    const slots: { id: number; key: 'morning' | 'lunch' | 'bedtime'; label: string; time: string }[] = [
      { id: 11, key: 'morning', label: 'Morning', time: reminders.morning },
      { id: 12, key: 'lunch', label: 'Lunch', time: reminders.lunch },
      { id: 13, key: 'bedtime', label: 'Bedtime', time: reminders.bedtime },
    ];
    
    const toSchedule = slots
      .map((slot) => {
        const hm = parseHM(slot.time);
        if (!hm) return null;
        
        const inSlot = supplements.filter((s) => s.schedule.toLowerCase() === slot.key);
        if (inSlot.length === 0) return null;
        
        const suppListStr = inSlot.map((s) => s.name + (s.dosage ? ` (${s.dosage})` : '')).join(', ');
        
        return {
          id: slot.id,
          title: `💊 Time for your ${slot.label} Supplements`,
          body: `Take: ${suppListStr}`,
          schedule: { on: { hour: hm.hour, minute: hm.minute }, allowWhileIdle: true, repeats: true },
        };
      })
      .filter(Boolean);
      
    if (toSchedule.length) {
      await LocalNotifications.schedule({ notifications: toSchedule as never });
    }
  } catch (e) {
    console.warn('scheduleSupplementReminders failed', e);
  }
}

/** Fire an immediate notification — native LocalNotifications or a web Notification. */
export async function showLocalNotification(title: string, body: string): Promise<void> {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') return;
      await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 100000) + 100, title, body }] as never });
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Capture a photo. On native, uses the Camera plugin (returns a Blob).
 * On web, returns null so callers fall back to the existing <input capture> flow.
 */
export async function capturePhotoNative(): Promise<Blob | null> {
  if (!isNative()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
    });
    if (!photo.webPath) return null;
    const res = await fetch(photo.webPath);
    return await res.blob();
  } catch (e) {
    console.warn('Native camera capture failed', e);
    return null;
  }
}
