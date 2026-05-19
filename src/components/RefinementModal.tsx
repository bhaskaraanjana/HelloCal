import React, { useState, useEffect, useRef } from 'react';
import type { FoodItem, CoachPersonality } from '../types/nutrition';
import { gemini } from '../services/gemini';
import { localParser } from '../services/localParser';
import { Trash2, Plus, Sparkles, Check, X, Mic, MicOff, Send, AlertCircle, Loader2 } from 'lucide-react';

interface RefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedItems: Omit<FoodItem, 'id'>[];
  onSave: (items: Omit<FoodItem, 'id'>[]) => void;
  coachingMessage?: string;
  apiKey: string;
  personality: CoachPersonality;
}

export const RefinementModal: React.FC<RefinementModalProps> = ({
  isOpen,
  onClose,
  parsedItems,
  onSave,
  coachingMessage: initialCoaching,
  apiKey,
  personality
}) => {
  const [items, setItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [coaching, setCoaching] = useState('');
  
  // Correction States
  const [corrStatus, setCorrStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [corrInput, setCorrInput] = useState('');
  const [corrError, setCorrError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setItems(JSON.parse(JSON.stringify(parsedItems)));
      setCoaching(initialCoaching || '');
      setCorrStatus('idle');
      setCorrInput('');
      setCorrError(null);
    }
  }, [isOpen, parsedItems, initialCoaching]);

  if (!isOpen) return null;

  const handleUpdateField = (index: number, field: keyof Omit<FoodItem, 'id'>, value: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        name: 'New Food',
        quantity: '1 serving',
        calories: 100,
        protein: 5,
        carbs: 15,
        fat: 2,
        confidence: 'high'
      }
    ]);
  };

  const handleConfirmSave = () => {
    onSave(items);
    onClose();
  };

  // 🎙️ VOICE CORRECTION PROCESSORS
  const startRecording = async () => {
    setCorrError(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCorrError('Microphone is not supported in this browser.');
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
          setCorrError('Recorded audio was empty.');
          setCorrStatus('idle');
          return;
        }
        await processVoiceCorrection(audioBlob);
      };

      recorder.start(250);
      setCorrStatus('recording');
    } catch (err) {
      setCorrError('Microphone access denied.');
      setCorrStatus('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && corrStatus === 'recording') {
      mediaRecorderRef.current.stop();
      setCorrStatus('processing');
    }
  };

  const processVoiceCorrection = async (blob: Blob) => {
    if (!apiKey) {
      setCorrStatus('idle');
      setCorrError('Gemini API key required for voice corrections.');
      return;
    }

    try {
      const res = await gemini.correctVoice(items, blob, apiKey, personality);
      setItems(res.items);
      setCoaching(res.coachingMessage);
      setCorrError(null);
    } catch (err: any) {
      setCorrError(err.message || 'Correction failed. Try again.');
    } finally {
      setCorrStatus('idle');
    }
  };

  // 📝 TEXT CORRECTION PROCESSORS (including smart local offline commands)
  const handleTextCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = corrInput.trim();
    if (!query) return;

    setCorrStatus('processing');
    setCorrInput('');
    setCorrError(null);

    try {
      if (apiKey) {
        // AI supermode correction
        const res = await gemini.correctText(items, query, apiKey, personality);
        setItems(res.items);
        setCoaching(res.coachingMessage);
      } else {
        // Smart offline local correction command parser!
        applyLocalCorrectionCommand(query);
      }
    } catch (err: any) {
      setCorrError(err.message || 'Correction failed.');
    } finally {
      setCorrStatus('idle');
    }
  };

  const applyLocalCorrectionCommand = (cmd: string) => {
    const norm = cmd.toLowerCase().trim();
    
    // Command 1: REMOVE / DELETE
    if (norm.startsWith('remove') || norm.startsWith('delete') || norm.startsWith('no') || norm.startsWith('without')) {
      const targetWord = norm.replace(/^(remove|delete|no|without)\s+/, '').trim();
      const updated = items.filter(item => !item.name.toLowerCase().includes(targetWord));
      
      if (updated.length !== items.length) {
        setItems(updated);
        setCoaching(`Offline Mode: Removed item containing "${targetWord}".`);
      } else {
        setCorrError(`Offline Command: Could not find item matching "${targetWord}" to remove.`);
      }
      return;
    }

    // Command 2: ADD
    if (norm.startsWith('add') || norm.startsWith('with') || norm.startsWith('and')) {
      const targetPhrase = norm.replace(/^(add|with|and)\s+/, '').trim();
      const parsedRes = localParser.parseText(targetPhrase);
      
      if (parsedRes.items && parsedRes.items.length > 0) {
        setItems([...items, ...parsedRes.items]);
        setCoaching(`Offline Mode: Added "${parsedRes.items[0].name}" successfully.`);
      } else {
        setCorrError(`Offline Command: Could not parse food to add.`);
      }
      return;
    }

    // Command 3: CHANGE / MAKE (e.g. "change eggs to 2")
    if (norm.includes('change') || norm.includes('make') || norm.includes('to')) {
      // Find numbers in command
      const numMatch = norm.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        const newQtyVal = parseFloat(numMatch[1]);
        // Search staged items for key match
        let changed = false;
        const updated = items.map(item => {
          if (norm.includes(item.name.toLowerCase()) || item.name.toLowerCase().split(' ').some(w => norm.includes(w))) {
            changed = true;
            // Scale calories & macros proportionally based on portion count
            const oldQtyVal = parseFloat(item.quantity) || 1;
            const ratio = oldQtyVal > 0 ? newQtyVal / oldQtyVal : newQtyVal;
            
            return {
              ...item,
              quantity: item.quantity.replace(/\d+/, newQtyVal.toString()),
              calories: Math.round(item.calories * ratio),
              protein: Math.round(item.protein * ratio * 10) / 10,
              carbs: Math.round(item.carbs * ratio * 10) / 10,
              fat: Math.round(item.fat * ratio * 10) / 10
            };
          }
          return item;
        });

        if (changed) {
          setItems(updated);
          setCoaching('Offline Mode: Updated portion size and scaled nutrients.');
        } else {
          setCorrError('Offline Command: Could not find matching food to change.');
        }
        return;
      }
    }

    // Default: treat as text parsing append
    const parsedRes = localParser.parseText(cmd);
    setItems([...items, ...parsedRes.items]);
    setCoaching('Offline Mode: Appended parsed food.');
  };

  const totalCalories = items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
  const totalProtein = items.reduce((sum, item) => sum + (Number(item.protein) || 0), 0);
  const totalCarbs = items.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0);
  const totalFat = items.reduce((sum, item) => sum + (Number(item.fat) || 0), 0);

  return (
    <div className="modal-overlay">
      <div 
        className="modal-content" 
        style={{ 
          maxHeight: '92vh', 
          display: 'flex', 
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* Bottom Sheet Drag Handle Pill */}
        <div className="bottom-sheet-handle" />
        
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.01)'
        }}>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} color="var(--accent-purple)" />
            Review & Refine Log
          </h2>
          <button onClick={onClose} className="btn-icon" style={{ borderRadius: '50%', width: '32px', height: '32px' }}>
            <X size={16} />
          </button>
        </div>

        {/* AI Coaching Message Panel */}
        {coaching && (
          <div style={{
            padding: '0.8rem 1.25rem',
            background: 'rgba(139, 92, 246, 0.05)',
            borderBottom: '1px solid rgba(139, 92, 246, 0.1)',
            fontSize: '0.85rem',
            color: '#c084fc',
            fontStyle: 'italic',
            lineHeight: '1.4'
          }}>
            <strong>HaloCal Coach:</strong> "{coaching}"
          </div>
        )}

        {/* Food Editing Feed */}
        <div style={{
          padding: '1.25rem',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
              No food items remaining. Add a new item to log.
            </div>
          ) : (
            items.map((item, index) => (
              <div 
                key={index} 
                className="glass-card" 
                style={{ 
                  padding: '0.85rem', 
                  borderRadius: '16px',
                  backgroundColor: 'rgba(255,255,255,0.01)',
                  position: 'relative'
                }}
              >
                {/* Confidence Badge */}
                <span style={{
                  position: 'absolute',
                  top: '0.6rem',
                  right: '2.5rem',
                  fontSize: '0.65rem',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '99px',
                  backgroundColor: item.confidence === 'high' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  color: item.confidence === 'high' ? 'var(--accent-teal)' : 'var(--accent-amber)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)'
                }}>
                  {item.confidence === 'high' ? 'AI Resolved' : 'Assumed'}
                </span>

                {/* Edit Form Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '0.5rem', marginBottom: '0.5rem', paddingRight: '1.5rem' }}>
                  {/* Name field */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <input 
                      type="text" 
                      value={item.name}
                      onChange={(e) => handleUpdateField(index, 'name', e.target.value)}
                      placeholder="Food name"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        padding: '0.2rem 0',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Quantity field */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <input 
                      type="text" 
                      value={item.quantity}
                      onChange={(e) => handleUpdateField(index, 'quantity', e.target.value)}
                      placeholder="Portion size"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        padding: '0.2rem 0',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Quick macro/calorie input values */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.4rem' }}>
                  {/* Calories */}
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '0.25rem', fontFamily: 'var(--font-display)' }}>Kcal</span>
                    <input 
                      type="number" 
                      value={item.calories}
                      onChange={(e) => handleUpdateField(index, 'calories', parseInt(e.target.value) || 0)}
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                    />
                  </div>

                  {/* Protein */}
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(16,185,129,0.03)', borderRadius: '8px', padding: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-teal)', marginRight: '0.25rem', fontFamily: 'var(--font-display)' }}>P(g)</span>
                    <input 
                      type="number" 
                      value={item.protein}
                      onChange={(e) => handleUpdateField(index, 'protein', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                    />
                  </div>

                  {/* Carbs */}
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(6,182,212,0.03)', borderRadius: '8px', padding: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', marginRight: '0.25rem', fontFamily: 'var(--font-display)' }}>C(g)</span>
                    <input 
                      type="number" 
                      value={item.carbs}
                      onChange={(e) => handleUpdateField(index, 'carbs', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                    />
                  </div>

                  {/* Fat */}
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(139,92,246,0.03)', borderRadius: '8px', padding: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-purple)', marginRight: '0.25rem', fontFamily: 'var(--font-display)' }}>F(g)</span>
                    <input 
                      type="number" 
                      value={item.fat}
                      onChange={(e) => handleUpdateField(index, 'fat', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                    />
                  </div>
                </div>

                {/* Trash Icon */}
                <button 
                  onClick={() => handleRemoveItem(index)}
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}

          {/* Add Food Button */}
          <button 
            onClick={handleAddItem}
            className="btn btn-secondary" 
            style={{
              padding: '0.4rem 0.8rem',
              borderStyle: 'dashed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
              borderRadius: '12px'
            }}
          >
            <Plus size={14} /> Add Food Item
          </button>
        </div>

        {/* Dynamic Speech & Text CORRECTION Overlay (Interactive refinement) */}
        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border-glass)',
          background: corrStatus === 'recording' ? 'rgba(244,63,94,0.04)' : 'rgba(255,255,255,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-display)' }}>
              <Sparkles size={12} color="var(--accent-purple)" />
              {corrStatus === 'recording' ? 'Recording correction...' : 'Verbal Correction (Speak or type updates)'}
            </span>
            {corrError && (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <AlertCircle size={10} /> {corrError}
              </span>
            )}
          </div>

          <form onSubmit={handleTextCorrectionSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            
            {/* Microphone Correction button */}
            {corrStatus === 'idle' ? (
              <button 
                type="button"
                onClick={startRecording}
                className="btn-icon"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  borderColor: 'var(--border-glass-glow)',
                  color: 'var(--accent-purple)',
                  boxShadow: '0 0 10px rgba(139, 92, 246, 0.1)'
                }}
              >
                <Mic size={16} />
              </button>
            ) : corrStatus === 'recording' ? (
              <button 
                type="button"
                onClick={stopRecording}
                className="btn-icon"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-rose)',
                  borderColor: 'var(--accent-rose)',
                  color: '#fff',
                  animation: 'pulseBorder 1.5s infinite'
                }}
              >
                <MicOff size={16} />
              </button>
            ) : (
              <div 
                style={{
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-purple)'
                }}
              >
                <Loader2 size={18} className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            {/* Input Bar or Waveform */}
            {corrStatus === 'recording' ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                height: '38px',
                background: 'rgba(244, 63, 94, 0.08)',
                border: '1px dashed var(--accent-rose)',
                borderRadius: '20px',
                padding: '0 1rem'
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', marginRight: '0.5rem', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                  Listening...
                </span>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => {
                  const animDuration = 0.4 + Math.random() * 0.6;
                  return (
                    <div 
                      key={bar}
                      style={{
                        width: '3px',
                        backgroundColor: 'var(--accent-rose)',
                        borderRadius: '99px',
                        height: '60%',
                        animation: `wave ${animDuration}s ease-in-out infinite`,
                        boxShadow: '0 0 6px var(--accent-rose-glow)'
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <input 
                type="text"
                value={corrInput}
                onChange={(e) => setCorrInput(e.target.value)}
                placeholder={apiKey ? "Speak mic or type: 'remove croissant', 'add banana'..." : "Type offline: 'remove salad', 'add milk', 'make eggs 2'..."}
                disabled={corrStatus === 'processing'}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '20px',
                  padding: '0.5rem 1rem',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            )}

            <button 
              type="submit" 
              disabled={corrStatus === 'processing' || !corrInput.trim()}
              className="btn btn-primary"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>

        {/* Modal Footer (Summary & CTA) */}
        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.01)'
        }}>
          {/* Aggregated Nutrition */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Log Summary</span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-purple)' }}>{totalCalories}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>kcal •</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-teal)' }}>{Math.round(totalProtein)}g</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>P •</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue)' }}>{Math.round(totalCarbs)}g</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>C •</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-amber)' }}>{Math.round(totalFat)}g</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>F</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              Cancel
            </button>
            <button 
              onClick={handleConfirmSave} 
              className="btn btn-primary"
              disabled={items.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
            >
              <Check size={14} /> Log Meal
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
export default RefinementModal;
