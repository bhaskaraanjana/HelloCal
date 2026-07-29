import React, { useState, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, AlertCircle, Camera, ScanLine } from 'lucide-react';
import { gemini } from '../services/gemini';
import { localParser } from '../services/localParser';
import { capturePhotoNative, isNative } from '../services/native';
import { scanBarcodeNative } from '../services/barcode';
import { lookupBarcode, barcodeResultToCoachResponse } from '../services/foodDb';
import { BarcodeScanner } from './BarcodeScanner';
import type { CoachPersonality, CoachResponse } from '../types/nutrition';
import { isAiReady, type AiAccess } from '../services/aiRuntime';

interface VoiceInputProps {
  aiAccess: AiAccess;
  personality: CoachPersonality;
  onParsingSuccess: (response: CoachResponse) => void;
  onError: (message: string) => void;
  onOpenSettings?: () => void;
  weightKg?: number;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  aiAccess,
  personality,
  onParsingSuccess,
  onError,
  onOpenSettings,
  weightKg
}) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [textInput, setTextInput] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start Voice Recording
  const startRecording = async () => {
    setMicError(null);
    audioChunksRef.current = [];
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = 'Microphone access is not supported in this browser.';
      setMicError(errMsg);
      onError(errMsg);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm' };
      let recorder: MediaRecorder;
      
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        if (audioBlob.size === 0) {
          onError('Recorded audio was empty. Please try again.');
          setStatus('idle');
          return;
        }
        
        await processAudio(audioBlob);
      };

      recorder.start(250);
      setStatus('recording');
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      const friendlyErr = 'Could not access your microphone. Please enable browser permissions.';
      setMicError(friendlyErr);
      onError(friendlyErr);
      setStatus('idle');
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
      setStatus('processing');
    }
  };

  const aiReady = isAiReady(aiAccess);

  // Keyboard shortcut listener for voice recording (Spacebar toggles)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true'
        ) {
          return;
        }
      }

      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (status === 'idle') {
          startRecording();
        } else if (status === 'recording') {
          stopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [status, aiReady]);

  // Upload/Process Audio Blob
  const processAudio = async (blob: Blob) => {
    if (!aiReady) {
      setStatus('idle');
      const errorMsg = aiAccess.provider === 'hosted'
        ? 'Sign in with Google in Settings to use voice logging, or type your meals below.'
        : 'Gemini API key is required to process audio. Add a key in Settings, or type your meals below!';
      setMicError(errorMsg);
      onError(errorMsg);
      return;
    }

    try {
      const parsedData = await gemini.parseVoice(blob, aiAccess, personality, weightKg);
      onParsingSuccess(parsedData);
    } catch (err: any) {
      console.error('Gemini Audio Error:', err);
      onError(err.message || 'Failed to parse audio. Please speak clearly or try again.');
    } finally {
      setStatus('idle');
    }
  };

  // Shared image-processing pipeline (used by both web upload and native camera).
  const processImageBlob = async (blob: Blob) => {
    if (!aiReady) {
      const errorMsg = aiAccess.provider === 'hosted'
        ? 'Sign in with Google in Settings to use photo scanning.'
        : 'Gemini API key is required for photo scanning. Add a key in Settings!';
      setMicError(errorMsg);
      onError(errorMsg);
      return;
    }

    setStatus('processing');
    setMicError(null);

    try {
      const parsedData = await gemini.parseImage(blob, aiAccess, personality, weightKg);
      onParsingSuccess(parsedData);
    } catch (err: any) {
      console.error('Gemini Photo Error:', err);
      onError(err.message || 'Failed to parse image. Please take a clearer picture or try again.');
    } finally {
      setStatus('idle');
    }
  };

  // Process Photo Selection (web file input)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageBlob(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset uploader input
    }
  };

  // Camera button: native camera on device, file picker on web.
  const handleCameraClick = async () => {
    if (!aiReady) {
      const errorMsg = aiAccess.provider === 'hosted'
        ? 'Sign in with Google in Settings to use photo scanning.'
        : 'Gemini API key is required for photo scanning. Add a key in Settings!';
      setMicError(errorMsg);
      onError(errorMsg);
      return;
    }
    if (isNative()) {
      const blob = await capturePhotoNative();
      if (blob) {
        await processImageBlob(blob);
        return;
      }
      // Fall through to web input if native capture returned nothing.
    }
    fileInputRef.current?.click();
  };

  // Resolve a scanned barcode against the food database and stage the result.
  const resolveBarcode = async (code: string) => {
    setStatus('processing');
    setMicError(null);
    try {
      const result = await lookupBarcode(code);
      if (!result) {
        // Genuine not-found — persist inline guidance pointing at the photo/type
        // actions already on screen, rather than a toast that vanishes.
        setMicError('That product isn’t in the food database. Snap a photo of the label, search, or type it below instead.');
        return;
      }
      onParsingSuccess(barcodeResultToCoachResponse(result));
    } catch (err: any) {
      console.error('Barcode lookup error:', err);
      setMicError('Couldn’t reach the food database. Check your connection, or type the item below.');
    } finally {
      setStatus('idle');
    }
  };

  // Barcode button: native ML Kit scanner on device, web camera modal in the browser.
  const handleScanClick = async () => {
    setMicError(null);
    if (isNative()) {
      const code = await scanBarcodeNative();
      if (code) await resolveBarcode(code);
      return;
    }
    setScannerOpen(true);
  };

  // Process Text Inputs
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = textInput.trim();
    if (!query) return;

    setStatus('processing');
    setTextInput('');
    setMicError(null);

    try {
      if (aiReady) {
        const parsedData = await gemini.parseText(query, aiAccess, personality, weightKg);
        onParsingSuccess(parsedData);
      } else {
        const parsedData = localParser.parseText(query);
        onParsingSuccess(parsedData);
      }
    } catch (err: any) {
      console.error('Text Parsing Error:', err);
      onError(err.message || 'Failed to parse text. Please type clearly.');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="voice-log-root">
      
      {/* Hidden File Input for Native PWA Camera Uploader */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        capture="environment" 
        onChange={handleImageSelect} 
        style={{ display: 'none' }} 
      />

      {/* Logging Area Card */}
      <div 
        className={`glass-card voice-log-card${status === 'recording' ? ' is-recording' : ''}`}
        style={{
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Glow circles behind buttons */}
        {status === 'recording' && (
          <div style={{
            position: 'absolute',
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, var(--accent-purple-glow) 0%, transparent 70%)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />
        )}

        {/* Text Guidelines + actions */}
        <div className="voice-log-card__hero" style={{ zIndex: 1 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {status === 'idle' && 'Log Food'}
              {status === 'recording' && 'Listening...'}
              {status === 'processing' && 'AI Scanner Thinking...'}
              {aiReady && <Sparkles size={16} color="var(--accent-purple)" style={{ animation: 'float 2s infinite' }} />}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto', lineHeight: 1.45 }}>
              {status === 'idle' && (
                aiReady
                  ? 'Talk (or press Space), snap a photo, scan a barcode, or type below.'
                  : aiAccess.provider === 'hosted'
                    ? 'Sign in with Google in Settings for voice & photo AI, or type / scan a barcode now.'
                    : 'Scan a barcode or type what you ate. Add a Gemini key in Settings for voice & photo.'
              )}
              {status === 'recording' && 'Speak clearly — mention ingredients and portions.'}
              {status === 'processing' && 'Gemini is scanning visual details and scaling metrics...'}
            </p>
          </div>

          {/* Dynamic Waveform Visualizer when recording */}
          {status === 'recording' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '36px' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => {
                const animDuration = 0.5 + Math.random() * 0.7;
                return (
                  <div 
                    key={bar}
                    style={{
                      width: '4px',
                      backgroundColor: 'var(--accent-purple)',
                      borderRadius: '99px',
                      height: '100%',
                      animation: `wave ${animDuration}s ease-in-out infinite`,
                      boxShadow: '0 0 8px var(--accent-purple-glow)'
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Action Buttons Group */}
          <div className="voice-log-card__actions">
          {status === 'idle' ? (
            <>
              {/* Voice Pill */}
              <button
                onClick={startRecording}
                title="Voice Log (Press Space)"
                aria-label="Start voice logging (Press Space)"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-purple)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                  boxShadow: '0 0 20px var(--accent-purple-glow)',
                  transition: 'var(--transition-spring)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.08)';
                  e.currentTarget.style.boxShadow = '0 0 30px var(--accent-purple)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 0 20px var(--accent-purple-glow)';
                }}
              >
                <Mic size={32} />
              </button>

              {/* Camera Pill */}
              <button
                onClick={handleCameraClick}
                title="Photo Scan"
                aria-label="Scan a food photo"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-teal)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                  boxShadow: '0 0 20px var(--accent-teal-glow)',
                  transition: 'var(--transition-spring)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.08)';
                  e.currentTarget.style.boxShadow = '0 0 30px var(--accent-teal)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 0 20px var(--accent-teal-glow)';
                }}
              >
                <Camera size={32} />
              </button>

              {/* Barcode Pill */}
              <button
                onClick={handleScanClick}
                title="Scan Barcode"
                aria-label="Scan a product barcode"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-amber)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                  boxShadow: '0 0 20px var(--accent-amber-glow)',
                  transition: 'var(--transition-spring)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.08)';
                  e.currentTarget.style.boxShadow = '0 0 30px var(--accent-amber)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 0 20px var(--accent-amber-glow)';
                }}
              >
                <ScanLine size={32} />
              </button>
            </>
          ) : status === 'recording' ? (
            <button
              onClick={stopRecording}
              aria-label="Stop recording"
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-rose)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                boxShadow: '0 0 25px var(--accent-rose-glow)',
                animation: 'pulseBorder 1.5s infinite',
                transition: 'var(--transition-smooth)'
              }}
            >
              <MicOff size={32} />
            </button>
          ) : (
            <div 
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: '3px solid var(--accent-purple)',
                borderTopColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'spin 1s linear infinite'
              }}
            />
          )}
          </div>

          {/* Error warning info */}
          {micError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 0.85rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.15)',
              color: '#fda4af',
              fontSize: '0.82rem',
              maxWidth: '450px',
              margin: '0 auto'
            }}>
              <AlertCircle size={16} />
              <span>{micError}</span>
            </div>
          )}
        </div>

        {/* Custom spin style injection */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}} />

        {!aiReady && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.55rem 0.75rem',
            borderRadius: '12px',
            background: 'rgba(139, 92, 246, 0.06)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            lineHeight: 1.4,
            textAlign: 'left'
          }}>
            <Sparkles size={15} color="var(--accent-purple)" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              {aiAccess.provider === 'hosted'
                ? 'Voice & photo AI use HelloCal’s cloud — sign in with Google in Settings. Typing & barcode scanning work now.'
                : 'Voice & photo logging need a Gemini key in Settings. Typing & barcode scanning work right now.'}
            </span>
              {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                style={{
                  flexShrink: 0,
                  background: 'rgba(139, 92, 246, 0.16)',
                  border: '1px solid var(--border-glass-glow)',
                  color: 'var(--accent-purple)',
                  borderRadius: '99px',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {aiAccess.provider === 'hosted' ? 'Sign in' : 'Add key'}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleTextSubmit} className="voice-log-form">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type what you ate (e.g. oatmeal with berries)..."
            disabled={status === 'processing'}
            className="input-field"
            aria-label="Type what you ate"
          />
          <button
            type="submit"
            disabled={status === 'processing' || !textInput.trim()}
            aria-label="Log typed entry"
            className="btn btn-primary"
            style={{
              borderRadius: '14px',
              padding: '0 1.15rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (!textInput.trim() || status === 'processing') ? 0.6 : 1,
              cursor: (!textInput.trim() || status === 'processing') ? 'not-allowed' : 'pointer'
            }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Web barcode scanner modal (native uses the ML Kit full-screen scanner instead) */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={(code) => {
          setScannerOpen(false);
          resolveBarcode(code);
        }}
      />

    </div>
  );
};
export default VoiceInput;
