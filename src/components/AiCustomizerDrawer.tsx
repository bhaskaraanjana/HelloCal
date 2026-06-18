import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Sparkles, AlertCircle, X } from 'lucide-react';
import { gemini } from '../services/gemini';
import type { UserGoals, AppSettings } from '../types/nutrition';

interface AiCustomizerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoals: UserGoals;
  currentSettings: AppSettings;
  apiKey: string;
  scope: 'general' | 'macronutrients' | 'micronutrients' | 'widgets';
  onCustomizationSuccess: (
    updatedGoals: Partial<UserGoals>,
    updatedSettings: Partial<AppSettings>,
    message: string
  ) => void;
  onError: (message: string) => void;
}

export const AiCustomizerDrawer: React.FC<AiCustomizerDrawerProps> = ({
  isOpen,
  onClose,
  currentGoals,
  currentSettings,
  apiKey,
  scope,
  onCustomizationSuccess,
  onError
}) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [textInput, setTextInput] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setErrorText(null);
      setTextInput('');
      setStatus('idle');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Scoped suggestions helper
  const getSuggestions = () => {
    switch (scope) {
      case 'macronutrients':
        return [
          'hide fats counter',
          'make protein target 150g',
          'set carbs goal to 200g',
          'show all macros'
        ];
      case 'micronutrients':
        return [
          'hide added sugar',
          'make sodium limit 1800mg',
          'set fiber goal to 35g',
          'show all micros'
        ];
      case 'widgets':
        return [
          'hide workouts list',
          'hide stats summaries',
          'hide calorie progress ring',
          'show all cards'
        ];
      default:
        return [
          'change theme to cyberpunk',
          'switch color to emerald green',
          'make theme ocean blue',
          'set calorie goal to 2200'
        ];
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    processCommand(suggestion, null);
  };



  // Start Voice Recording
  const startRecording = async () => {
    setErrorText(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = 'Microphone access is not supported in this browser.';
      setErrorText(errMsg);
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
          setErrorText('Recorded voice was empty.');
          setStatus('idle');
          return;
        }
        await processCommand('', audioBlob);
      };

      recorder.start(250);
      setStatus('recording');
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      setErrorText('Could not access microphone. Check permissions.');
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

  // Call Gemini command center
  const processCommand = async (text: string, voiceBlob: Blob | null) => {
    if (!apiKey) {
      const errorMsg = 'Gemini API Key is required to run the AI Dashboard Customizer. Enter a key in Settings!';
      setErrorText(errorMsg);
      onError(errorMsg);
      return;
    }

    setStatus('processing');
    setErrorText(null);

    try {
      const query = text.trim();
      const response = await gemini.executeAppCommand(
        query,
        voiceBlob,
        currentGoals,
        currentSettings,
        apiKey
      );

      onCustomizationSuccess(
        response.updatedGoals || {},
        response.updatedSettings || {},
        response.aiResponse || 'Visual updates applied successfully!'
      );
      onClose();
    } catch (err: any) {
      console.error('Gemini customizer error:', err);
      const friendlyErr = err.message || 'Failed to interpret design command. Please try again.';
      setErrorText(friendlyErr);
      onError(friendlyErr);
      setStatus('idle');
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    processCommand(textInput, null);
    setTextInput('');
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="AI dashboard customizer" style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 5, 8, 0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
    }} onClick={onClose}>
      
      {/* Bottom Sheet Drawer */}
      <div 
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: 'var(--bg-glass)',
          border: '1px solid var(--border-glass-glow)',
          borderBottom: 'none',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          padding: '2rem 1.5rem 2.5rem 1.5rem',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.4)',
          maxHeight: '85vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          animation: 'bottomSheetIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header Title & Close */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-purple)'
            }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                AI Dashboard Architect
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Customizing: <strong style={{ color: 'var(--accent-purple)' }}>{scope.toUpperCase()}</strong>
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn-icon" aria-label="Close" style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X size={18} color="var(--text-muted)" />
          </button>
        </div>

        {/* Info Guidelines */}
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
          Ask the AI to change anything on this dashboard. You can add or hide specific counters, change themes, or modify targets.
        </p>

        {/* Suggestion Pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
            Suggested Commands:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {getSuggestions().map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={status === 'processing'}
                style={{
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid var(--border-glass)',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                  fontFamily: 'var(--font-body)'
                }}
                onMouseEnter={(e) => {
                  if (status !== 'processing') {
                    e.currentTarget.style.borderColor = 'var(--accent-purple)';
                    e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (status !== 'processing') {
                    e.currentTarget.style.borderColor = 'var(--border-glass)';
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.015)';
                  }
                }}
              >
                ✨ "{suggestion}"
              </button>
            ))}
          </div>
        </div>

        {/* Recording Console */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1.5rem',
          borderRadius: '16px',
          border: status === 'recording' ? '1px solid var(--accent-rose)' : '1px solid var(--border-glass)',
          background: status === 'recording' ? 'rgba(244, 63, 94, 0.03)' : 'rgba(255,255,255,0.005)',
          position: 'relative'
        }}>
          {status === 'recording' && (
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-rose)', animation: 'pulse 1s infinite alternate' }}>
              🔴 LISTENING...
            </span>
          )}
          {status === 'processing' && (
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-purple)', animation: 'pulse 1s infinite alternate' }}>
              ⚡ COMPILING DESIGN CHANGE...
            </span>
          )}
          {status === 'idle' && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Tap Microphone to Speak Command
            </span>
          )}

          {/* Glowing Microphone button */}
          {status === 'idle' ? (
            <button
              onClick={startRecording}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-purple)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 0 15px var(--accent-purple-glow)',
                transition: 'var(--transition-spring)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Mic size={24} />
            </button>
          ) : status === 'recording' ? (
            <button
              onClick={stopRecording}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-rose)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 0 20px var(--accent-rose-glow)',
                animation: 'pulseBorder 1.5s infinite'
              }}
            >
              <MicOff size={24} />
            </button>
          ) : (
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              border: '3px solid var(--accent-purple)',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite'
            }} />
          )}
        </div>

        {/* Text Fallback Form */}
        <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            aria-label="Type a layout command"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={status === 'processing'}
            placeholder="Or type a layout command (e.g. 'hide stats')..."
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-glass)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'var(--transition-smooth)'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-glass)'}
          />
          <button
            type="submit"
            disabled={status === 'processing' || !textInput.trim()}
            className="btn btn-primary"
            style={{
              borderRadius: '12px',
              padding: '0 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Send size={16} />
          </button>
        </form>

        {/* Error warnings */}
        {errorText && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.15)',
            color: '#fda4af',
            fontSize: '0.8rem'
          }}>
            <AlertCircle size={14} />
            <span>{errorText}</span>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bottomSheetIn {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes pulseBorder {
          0% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(244, 63, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); }
        }
      `}} />
    </div>
  );
};
export default AiCustomizerDrawer;
