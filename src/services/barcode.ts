import { isNative } from './native';

/**
 * Scan a barcode using the native ML Kit scanner (Android/iOS).
 * Returns the raw barcode value, or null if unsupported / cancelled / denied.
 * On web this returns null — callers should fall back to the web <BarcodeScanner> modal.
 */
export async function scanBarcodeNative(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');

    const supported = await BarcodeScanner.isSupported();
    if (!supported.supported) return null;

    const perm = await BarcodeScanner.requestPermissions();
    if (perm.camera !== 'granted' && perm.camera !== 'limited') return null;

    // Android needs the Google barcode module installed on first use.
    try {
      const avail = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!avail.available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }
    } catch {
      /* iOS has no installable module — ignore */
    }

    const { barcodes } = await BarcodeScanner.scan();
    return barcodes?.[0]?.rawValue || null;
  } catch (e) {
    console.warn('Native barcode scan failed', e);
    return null;
  }
}
