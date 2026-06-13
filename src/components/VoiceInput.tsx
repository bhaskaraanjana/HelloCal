import React, { useState, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, AlertCircle, Camera, ScanLine, Search } from 'lucide-react';
import { gemini } from '../services/gemini';
import { localParser } from '../services/localParser';
import { capturePhotoNative, isNative } from '../services/native';
import { scanBarcodeNative } from '../services/barcode';
import { lookupBarcode, barcodeResultToCoachResponse } from '../services/foodDb';
import { BarcodeScanner } from './BarcodeScanner';
import type { CoachPersonality, CoachResponse } from '../types/nutrition';

interface VoiceInputProps {
  apiKey: string;
  personality: CoachPersonality;
  onParsingSuccess: (response: CoachResponse) => void;
  onError: (message: string) => void;
  onOpenSettings?: () => void;
  onOpenSearch?: () => void;
  weightKg?: number;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  apiKey,
  personality,
  onParsingSuccess,
  onError,
  onOpenSettings,
  onOpenSearch,
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

  // Upload/Process Audio Blob
  const processAudio = async (blob: Blob) => {
    if (!apiKey) {
      setStatus('idle');
      const errorMsg = 'Gemini API Key is required to process audio logs. Please enter a key in Settings, or type your meals below!';
      setMicError(errorMsg);
      onError(errorMsg);
      return;
    }

    try {
      const parsedData = await gemini.parseVoice(blob, apiKey, personality, weightKg);
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
    if (!apiKey) {
      const errorMsg = 'Gemini API Key is required for visual food photo scanning. Please enter a key in Settings!';
      setMicError(errorMsg);
      onError(errorMsg);
      return;
    }

    setStatus('processing');
    setMicError(null);

    try {
      const parsedData = await gemini.parseImage(blob, apiKey, personality, weightKg);
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
    if (!apiKey) {
      const errorMsg = 'Gemini API Key is required for visual food photo scanning. Please enter a key in Settings!';
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
        onError('That product was not found in the food database. Try a photo scan or type it instead.');
        return;
      }
      onParsingSuccess(barcodeResultToCoachResponse(result));
    } catch (err: any) {
      console.error('Barcode lookup error:', err);
      onError('Could not look up that barcode. Please check your connection and try again.');
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
      if (apiKey) {
        const parsedData = await gemini.parseText(query, apiKey, personality, weightKg);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      
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
        className="glass-card" 
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          border: status === 'recording' ? '1px solid var(--accent-purple)' : '1px solid var(--border-glass)',
          background: status === 'recording' ? 'rgba(139, 92, 246, 0.04)' : 'var(--bg-glass)',
          boxShadow: status === 'recording' ? '0 0 30px var(--accent-purple-glow)' : '0 8px 32px 0 rgba(0,0,0,0.3)',
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

        {/* Text Guidelines */}
        <div style={{ zIndex: 1 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            {status === 'idle' && 'Log Food or Workout'}
            {status === 'recording' && 'Listening...'}
            {status === 'processing' && 'AI Scanner Thinking...'}
            {apiKey && <Sparkles size={18} color="var(--accent-purple)" style={{ animation: 'float 2s infinite' }} />}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '420px', margin: '0 auto' }}>
            {status === 'idle' && (
              apiKey
                ? 'Talk, snap a food photo, scan a barcode, or type below! (e.g. "I did a 40 min run")'
                : 'Scan a barcode or type your food/workouts below. Add a Gemini API key in Settings to unlock voice & photo AI tracking!'
            )}
            {status === 'recording' && 'Speak clearly! Mention ingredients, portions, or workout duration.'}
            {status === 'processing' && 'Gemini is scanning visual details and scaling metrics...'}
          </p>
        </div>

        {/* Dynamic Waveform Visualizer when recording */}
        {status === 'recording' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '40px', zIndex: 1 }}>
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
        <div style={{ zIndex: 1, display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'center' }}>
          {status === 'idle' ? (
            <>
              {/* Voice Pill */}
              <button
                onClick={startRecording}
                title="Voice Log"
                aria-label="Start voice logging"
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

        {/* Custom spin style injection */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}} />

        {/* Error warning info */}
        {micError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '10px',
            backgroundColor: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.15)',
            color: '#fda4af',
            fontSize: '0.85rem',
            maxWidth: '450px',
            zIndex: 1
          }}>
            <AlertCircle size={16} />
            <span>{micError}</span>
          </div>
        )}
      </div>

      {/* Search the food database — no key needed, surfaces millions of products. */}
      {onOpenSearch && (
        <button
          type="button"
          onClick={onOpenSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.7rem 1rem',
            borderRadius: '14px',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-secondary)',
            fontSize: '0.88rem',
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <Search size={16} color="var(--accent-purple)" />
          Search the food database
        </button>
      )}

      {/* No-key disclosure: explain up front that voice/photo/barcode need a key,
          so users aren't surprised by an error only after tapping. Typing is free. */}
      {!apiKey && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.6rem 0.9rem',
          borderRadius: '12px',
          background: 'rgba(139, 92, 246, 0.06)',
          border: '1px solid var(--border-glass)',
          color: 'var(--text-secondary)',
          fontSize: '0.82rem',
          lineHeight: 1.4
        }}>
          <Sparkles size={15} color="var(--accent-purple)" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            Voice &amp; photo logging need a free Gemini key. Typing &amp; barcode scanning work right now.
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
              Add key
            </button>
          )}
        </div>
      )}

      {/* Text fallback input bar */}
      <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input 
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type what you ate or your workout (e.g. 'Ran for 30 minutes' or 'Oatmeal')..."
            disabled={status === 'processing'}
            style={{
              width: '100%',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)',
              borderRadius: '16px',
              padding: '1rem 1.25rem',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              outline: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              transition: 'var(--transition-smooth)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-purple)';
              e.currentTarget.style.boxShadow = '0 4px 25px var(--accent-purple-glow)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-glass)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
            }}
          />
        </div>
        <button
          type="submit"
          disabled={status === 'processing' || !textInput.trim()}
          aria-label="Log typed entry"
          className="btn btn-primary"
          style={{
            borderRadius: '16px',
            padding: '0 1.5rem',
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
