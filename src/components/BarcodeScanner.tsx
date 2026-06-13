import React, { useEffect, useRef, useState } from 'react';
import { X, ScanLine } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';

interface BarcodeScannerProps {
  isOpen: boolean;
  onResult: (barcode: string) => void;
  onClose: () => void;
}

/**
 * Web barcode scanner modal — uses @zxing/browser to decode UPC/EAN codes from the
 * device camera. The library is lazy-loaded so it stays out of the main bundle.
 */
export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onResult, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        if (cancelled || !videoRef.current) return;

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, _err, ctrl) => {
            if (result) {
              ctrl.stop();
              onResult(result.getText());
            }
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        console.warn('Web barcode scanner error', e);
        if (!cancelled) {
          setError('Could not access the camera. Please allow camera access, or use the photo/voice options.');
        }
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [isOpen, onResult]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Scan a barcode" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 460, padding: '1.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bottom-sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <ScanLine size={20} color="var(--accent-amber)" />
            Scan Barcode
          </h2>
          <button onClick={onClose} aria-label="Close scanner" className="btn-icon" style={{ width: 36, height: 36 }}>
            <X size={18} />
          </button>
        </div>

        {error ? (
          <p style={{ color: '#fda4af', fontSize: '0.9rem', padding: '1rem 0' }}>{error}</p>
        ) : (
          <div
            style={{
              position: 'relative',
              borderRadius: 16,
              overflow: 'hidden',
              background: '#000',
              aspectRatio: '4 / 3',
            }}
          >
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              playsInline
            />
            {/* Scanning reticle */}
            <div
              style={{
                position: 'absolute',
                inset: '22% 12%',
                border: '2px solid var(--accent-amber)',
                borderRadius: 12,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                pointerEvents: 'none',
              }}
            />
          </div>
        )}

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.85rem' }}>
          Point your camera at a product barcode. We'll look it up automatically.
        </p>
      </div>
    </div>
  );
};

export default BarcodeScanner;
