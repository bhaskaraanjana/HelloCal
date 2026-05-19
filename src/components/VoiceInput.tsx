import React, { useState, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, AlertCircle } from 'lucide-react';
import { gemini } from '../services/gemini';
import { localParser } from '../services/localParser';
import type { CoachPersonality, CoachResponse } from '../types/nutrition';

interface VoiceInputProps {
  apiKey: string;
  personality: CoachPersonality;
  onParsingSuccess: (response: CoachResponse) => void;
  onError: (message: string) => void;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  apiKey,
  personality,
  onParsingSuccess,
  onError
}) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [textInput, setTextInput] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
      // WebM is widely supported, fall back to wav/ogg if webm fails or is unsupported
      const options = { mimeType: 'audio/webm' };
      let recorder: MediaRecorder;
      
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        // Fallback for Safari/iOS which might prefer standard audio stream recording
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Stop all audio tracks to release microphone hardware icon
        stream.getTracks().forEach((track) => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        if (audioBlob.size === 0) {
          onError('Recorded audio was empty. Please try again.');
          setStatus('idle');
          return;
        }
        
        await processAudio(audioBlob);
      };

      recorder.start(250); // capture chunks every 250ms
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
      // Local fallback: we need a transcript to run localParser. 
      // We warn the user that they need an API Key for direct multimodal audio processing
      setStatus('idle');
      const errorMsg = 'Gemini API Key is required to process audio logs. Please enter a key in Settings, or type your meals below!';
      setMicError(errorMsg);
      onError(errorMsg);
      return;
    }

    try {
      const parsedData = await gemini.parseVoice(blob, apiKey, personality);
      onParsingSuccess(parsedData);
    } catch (err: any) {
      console.error('Gemini Audio Error:', err);
      onError(err.message || 'Failed to parse audio. Please speak clearly or try again.');
    } finally {
      setStatus('idle');
    }
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
        // Super mode text parsing
        const parsedData = await gemini.parseText(query, apiKey, personality);
        onParsingSuccess(parsedData);
      } else {
        // Smart offline local parsing
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
      
      {/* Voice Pill Logging Area */}
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
        {/* Glow circles behind the mic button */}
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
            {status === 'idle' && 'Log Your Meal'}
            {status === 'recording' && 'Listening...'}
            {status === 'processing' && 'AI Thinking...'}
            {apiKey && <Sparkles size={18} color="var(--accent-purple)" style={{ animation: 'float 2s infinite' }} />}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '380px', margin: '0 auto' }}>
            {status === 'idle' && (apiKey ? 'Tap the mic and say: "I had a cup of black coffee and a large butter croissant."' : 'Tap the mic to log (requires API key) or type your food below!')}
            {status === 'recording' && 'Speak clearly! Mention portion weights or counts if possible.'}
            {status === 'processing' && 'Gemini is parsing the nutritional values and scaling macros...'}
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

        {/* Main Glowing Micro Button */}
        <div style={{ zIndex: 1 }}>
          {status === 'idle' ? (
            <button 
              onClick={startRecording}
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
          ) : status === 'recording' ? (
            <button 
              onClick={stopRecording}
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

        {/* Mic Obstructed warning info */}
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

      {/* Text fallback input bar */}
      <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input 
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type what you ate (e.g. '3 boiled eggs and raw almonds')..."
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

    </div>
  );
};
export default VoiceInput;
