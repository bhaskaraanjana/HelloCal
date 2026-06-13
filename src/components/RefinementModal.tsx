import React, { useState, useEffect, useRef } from 'react';
import type { FoodItem, WorkoutLog, CoachPersonality } from '../types/nutrition';
import { gemini } from '../services/gemini';
import { localParser } from '../services/localParser';
import { Trash2, Plus, Sparkles, Check, X, Mic, MicOff, Send, AlertCircle } from 'lucide-react';

interface RefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedItems: Omit<FoodItem, 'id'>[];
  parsedWorkout: Omit<WorkoutLog, 'id'> | null;
  logType: 'food' | 'workout' | 'mixed';
  onSave: (items: Omit<FoodItem, 'id'>[], workout: Omit<WorkoutLog, 'id'> | null) => void;
  coachingMessage?: string;
  apiKey: string;
  personality: CoachPersonality;
  calorieGoal?: number;
  consumedToday?: number;
}

export const RefinementModal: React.FC<RefinementModalProps> = ({
  isOpen,
  onClose,
  parsedItems,
  parsedWorkout,
  logType,
  onSave,
  coachingMessage: initialCoaching,
  apiKey,
  personality,
  calorieGoal,
  consumedToday = 0
}) => {
  const [items, setItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [workout, setWorkout] = useState<Omit<WorkoutLog, 'id'> | null>(null);
  const [coaching, setCoaching] = useState('');
  const [modalLogType, setModalLogType] = useState<'food' | 'workout' | 'mixed'>('food');
  
  // Correction States
  const [corrStatus, setCorrStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [corrInput, setCorrInput] = useState('');
  const [corrError, setCorrError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setItems(parsedItems.map((it) => ({ ...it })));
      setWorkout(parsedWorkout ? { ...parsedWorkout } : null);
      setCoaching(initialCoaching || '');
      setModalLogType(logType);
      setCorrStatus('idle');
      setCorrInput('');
      setCorrError(null);
    }
  }, [isOpen, parsedItems, parsedWorkout, logType, initialCoaching]);

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

  // Scale every nutrient field of an item by a factor (calories/sodium are whole
  // numbers, the rest keep one decimal). Used by both the quick-scale buttons and
  // the offline portion-correction command so no nutrient is silently left behind.
  const NUTRIENT_FIELDS: (keyof Omit<FoodItem, 'id'>)[] = [
    'calories', 'protein', 'carbs', 'fat', 'sugar', 'addedSugar', 'fiber', 'sodium',
  ];
  const scaleNutrients = (item: Omit<FoodItem, 'id'>, factor: number): Omit<FoodItem, 'id'> => {
    const out: Omit<FoodItem, 'id'> = { ...item };
    for (const k of NUTRIENT_FIELDS) {
      const v = out[k];
      if (typeof v === 'number') {
        const scaled = v * factor;
        (out as Record<string, unknown>)[k] =
          k === 'calories' || k === 'sodium' ? Math.round(scaled) : Math.round(scaled * 10) / 10;
      }
    }
    return out;
  };

  const applyQuickScale = (index: number, factor: number) => {
    setItems(items.map((it, i) => (i === index ? scaleNutrients(it, factor) : it)));
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
        sugar: 0,
        addedSugar: 0,
        fiber: 0,
        sodium: 0,
        confidence: 'high'
      }
    ]);
  };

  const handleConfirmSave = () => {
    onSave(items, (modalLogType === 'workout' || modalLogType === 'mixed') ? workout : null);
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
    } catch (err: any) {
      console.error(err);
      setCorrError('Microphone permission blocked.');
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
      const res = await gemini.correctVoice(items, workout, blob, apiKey, personality);
      setItems(res.items || []);
      if (res.workout) setWorkout(res.workout);
      if (res.type) setModalLogType(res.type);
      setCoaching(res.coachingMessage);
      setCorrError(null);
    } catch (err: any) {
      setCorrError(err.message || 'Correction failed. Try again.');
    } finally {
      setCorrStatus('idle');
    }
  };

  // 📝 TEXT CORRECTION PROCESSORS
  const handleTextCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = corrInput.trim();
    if (!query) return;

    setCorrStatus('processing');
    setCorrInput('');
    setCorrError(null);

    try {
      if (apiKey) {
        const res = await gemini.correctText(items, workout, query, apiKey, personality);
        setItems(res.items || []);
        if (res.workout) setWorkout(res.workout);
        if (res.type) setModalLogType(res.type);
        setCoaching(res.coachingMessage);
      } else {
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

    // Command 2: CHANGE / PORTION ADJUST
    if (norm.startsWith('change') || norm.startsWith('make') || norm.startsWith('set')) {
      const match = norm.match(/(?:change|make|set)\s+(.+?)\s+(?:to|portion)\s+(.+)/);
      if (match) {
        const targetFood = match[1].trim();
        const newPortion = match[2].trim();

        // Resolve a scale multiplier from words ("double"/"half") or an explicit
        // "1.5x". If we can't, tell the user instead of silently leaving 1x.
        let multiplier: number | null = null;
        if (/\b(double|twice|two|2x)\b/.test(newPortion)) multiplier = 2;
        else if (/\b(triple|three|3x)\b/.test(newPortion)) multiplier = 3;
        else if (/\b(half|0\.5x)\b/.test(newPortion)) multiplier = 0.5;
        else {
          const m = newPortion.match(/([0-9]*\.?[0-9]+)\s*x/);
          if (m) multiplier = parseFloat(m[1]);
        }

        if (multiplier == null || !Number.isFinite(multiplier) || multiplier <= 0) {
          setCorrError('Could not read that portion — try "double", "half", or "1.5x".');
          return;
        }

        let changed = false;
        const updated = items.map(item => {
          if (item.name.toLowerCase().includes(targetFood)) {
            changed = true;
            return { ...scaleNutrients(item, multiplier as number), quantity: newPortion };
          }
          return item;
        });

        if (changed) {
          setItems(updated);
          setCoaching('Offline Mode: Updated portion size and scaled all nutrients.');
        } else {
          setCorrError(`Offline Command: Could not find "${targetFood}" to change.`);
        }
        return;
      }
    }

    // Default: treat as text parsing append
    const parsedRes = localParser.parseText(cmd);
    setItems([...items, ...(parsedRes.items || [])]);
    setCoaching('Offline Mode: Appended parsed food.');
  };

  const totalCalories = items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
  // How much of the daily calorie budget remains if this log is saved as-is — lets
  // the user decide before confirming, instead of discovering it on the dashboard.
  const remainingAfterLog =
    calorieGoal != null ? calorieGoal - (consumedToday + totalCalories) : null;
  const totalProtein = items.reduce((sum, item) => sum + (Number(item.protein) || 0), 0);
  const totalCarbs = items.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0);
  const totalFat = items.reduce((sum, item) => sum + (Number(item.fat) || 0), 0);

  const disabledButton = 
    (modalLogType === 'food' && items.length === 0) ||
    (modalLogType === 'workout' && !workout) ||
    (modalLogType === 'mixed' && items.length === 0 && !workout);

  const buttonText = 
    modalLogType === 'workout' ? 'Log Workout' :
    modalLogType === 'mixed' ? 'Log Meal & Workout' : 'Log Meal';

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
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-display)',
            lineHeight: '1.4',
            maxHeight: '100px',
            overflowY: 'auto'
          }}>
            🌟 <strong style={{ color: 'var(--accent-purple)' }}>AI Coach:</strong> {coaching}
          </div>
        )}

        {/* Scrollable Center Form Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          
          {/* Active Workout Log Card */}
          {(modalLogType === 'workout' || modalLogType === 'mixed') && workout && (
            <div 
              className="glass-card" 
              style={{ 
                padding: '1.25rem', 
                marginBottom: '1.5rem', 
                border: '1px solid rgba(6, 182, 212, 0.2)',
                backgroundColor: 'rgba(6, 182, 212, 0.02)'
              }}
            >
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-teal)', fontFamily: 'var(--font-display)' }}>
                🏃‍♂️ Workout Logs Staged
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem', fontFamily: 'var(--font-display)' }}>Activity Name</label>
                  <input 
                    type="text" 
                    value={workout.activity} 
                    onChange={(e) => setWorkout({ ...workout, activity: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-glass)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem', fontFamily: 'var(--font-display)' }}>Duration (minutes)</label>
                  <input 
                    type="number" 
                    value={workout.duration} 
                    onChange={(e) => setWorkout({ ...workout, duration: Number(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-glass)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem', fontFamily: 'var(--font-display)' }}>Calories Burned (kcal)</label>
                  <input 
                    type="number" 
                    value={workout.caloriesBurned} 
                    onChange={(e) => setWorkout({ ...workout, caloriesBurned: Number(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-glass)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', color: 'var(--accent-teal)', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Food Editing Feed */}
          {(modalLogType === 'food' || modalLogType === 'mixed') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.2rem', color: 'var(--accent-purple)', fontFamily: 'var(--font-display)' }}>
                🥗 Food & Portions Staged
              </h3>

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

                    {/* Primary macros/calorie input values */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.4rem' }}>
                      {/* Calories */}
                      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginRight: '0.25rem', fontFamily: 'var(--font-display)' }}>Kcal</span>
                        <input 
                          type="number" 
                          value={item.calories}
                          onChange={(e) => handleUpdateField(index, 'calories', parseInt(e.target.value) || 0)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                        />
                      </div>

                      {/* Protein */}
                      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(16,185,129,0.03)', borderRadius: '8px', padding: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-teal)', marginRight: '0.25rem', fontFamily: 'var(--font-display)' }}>P(g)</span>
                        <input 
                          type="number" 
                          value={item.protein}
                          onChange={(e) => handleUpdateField(index, 'protein', parseFloat(e.target.value) || 0)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                        />
                      </div>

                      {/* Carbs */}
                      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(6,182,212,0.03)', borderRadius: '8px', padding: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-blue)', marginRight: '0.25rem', fontFamily: 'var(--font-display)' }}>C(g)</span>
                        <input 
                          type="number" 
                          value={item.carbs}
                          onChange={(e) => handleUpdateField(index, 'carbs', parseFloat(e.target.value) || 0)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                        />
                      </div>

                      {/* Fat */}
                      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(139,92,246,0.03)', borderRadius: '8px', padding: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-purple)', marginRight: '0.25rem', fontFamily: 'var(--font-display)' }}>F(g)</span>
                        <input 
                          type="number" 
                          value={item.fat}
                          onChange={(e) => handleUpdateField(index, 'fat', parseFloat(e.target.value) || 0)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                        />
                      </div>
                    </div>

                    {/* Secondary micronutrient values */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginTop: '0.4rem' }}>
                      {/* Added Sugar */}
                      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(244,63,94,0.03)', borderRadius: '8px', padding: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-rose)', marginRight: '0.25rem', fontFamily: 'var(--font-display)' }}>Sug(g)</span>
                        <input 
                          type="number" 
                          value={item.addedSugar !== undefined ? item.addedSugar : 0}
                          onChange={(e) => handleUpdateField(index, 'addedSugar', parseFloat(e.target.value) || 0)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                        />
                      </div>

                      {/* Fiber */}
                      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(16,185,129,0.03)', borderRadius: '8px', padding: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-teal)', marginRight: '0.25rem', fontFamily: 'var(--font-display)' }}>Fib(g)</span>
                        <input 
                          type="number" 
                          value={item.fiber !== undefined ? item.fiber : 0}
                          onChange={(e) => handleUpdateField(index, 'fiber', parseFloat(e.target.value) || 0)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                        />
                      </div>

                      {/* Sodium */}
                      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(245,158,11,0.03)', borderRadius: '8px', padding: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-amber)', marginRight: '0.25rem', fontFamily: 'var(--font-display)' }}>Na(mg)</span>
                        <input 
                          type="number" 
                          value={item.sodium !== undefined ? item.sodium : 0}
                          onChange={(e) => handleUpdateField(index, 'sodium', parseInt(e.target.value) || 0)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                        />
                      </div>
                    </div>

                    {/* Quick portion scaling — one tap to halve/grow a serving,
                        no mental macro math. Multipliers compose on current values. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>Scale</span>
                      {([['½×', 0.5], ['1.5×', 1.5], ['2×', 2]] as const).map(([label, factor]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => applyQuickScale(index, factor)}
                          style={{
                            flex: 1,
                            padding: '0.25rem 0',
                            borderRadius: '8px',
                            background: 'rgba(139, 92, 246, 0.08)',
                            border: '1px solid var(--border-glass)',
                            color: 'var(--accent-purple)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {label}
                        </button>
                      ))}
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

              {/* Add New Row Action */}
              <button 
                onClick={handleAddItem}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  marginTop: '0.25rem'
                }}
              >
                <Plus size={14} /> Add Another Item
              </button>
            </div>
          )}

        </div>

        {/* Dynamic Correction Input Pill Area */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--border-glass)',
          background: 'rgba(255,255,255,0.005)'
        }}>
          <form onSubmit={handleTextCorrectionSubmit} style={{ display: 'flex', gap: '0.6rem', width: '100%', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type="text"
                value={corrInput}
                onChange={(e) => setCorrInput(e.target.value)}
                placeholder={apiKey ? "Speak/type corrections (e.g. 'remove the eggs, make yogurt double portion')..." : "Type changes (offline commands support 'remove yogurt', etc)..."}
                disabled={corrStatus === 'processing'}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '99px',
                  padding: '0.6rem 2.5rem 0.6rem 1rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {/* Mic Icon within input for corrections */}
              {apiKey && (
                <button
                  type="button"
                  onClick={corrStatus === 'recording' ? stopRecording : startRecording}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: corrStatus === 'recording' ? 'var(--accent-rose)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {corrStatus === 'recording' ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
            </div>

            {corrStatus === 'processing' && (
              <div 
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '2px solid var(--accent-purple)',
                  borderTopColor: 'transparent',
                  animation: 'spin 1s linear infinite'
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
          {corrError && (
            <div style={{ color: '#fda4af', fontSize: '0.75rem', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertCircle size={12} />
              <span>{corrError}</span>
            </div>
          )}
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
          {/* Aggregated Nutrition (only for food/mixed) */}
          {(modalLogType === 'food' || modalLogType === 'mixed') ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Nutrients Summary</span>
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
              {remainingAfterLog != null && (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  marginTop: '0.1rem',
                  color: remainingAfterLog < 0 ? 'var(--accent-rose)' : 'var(--text-secondary)'
                }}>
                  {remainingAfterLog >= 0
                    ? `${Math.round(remainingAfterLog)} kcal left today after this`
                    : `${Math.abs(Math.round(remainingAfterLog))} kcal over budget`}
                </span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Workout Summary</span>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-teal)' }}>-{workout?.caloriesBurned || 0}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>kcal •</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{workout?.duration || 0}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mins active</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              Cancel
            </button>
            <button 
              onClick={handleConfirmSave} 
              className="btn btn-primary"
              disabled={disabledButton}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
            >
              <Check size={14} /> {buttonText}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
export default RefinementModal;
