import { Capacitor } from '@capacitor/core';

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
export async function shareText(title: string, text: string, filename = 'halocal-backup.json'): Promise<boolean> {
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
