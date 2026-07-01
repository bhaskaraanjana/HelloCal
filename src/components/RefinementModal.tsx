import React, { useState, useEffect, useRef } from 'react';
import type { FoodItem, WorkoutLog, CoachPersonality } from '../types/nutrition';
import { gemini } from '../services/gemini';
import { localParser } from '../services/localParser';
import { Trash2, Plus, Sparkles, Check, X, Mic, MicOff, Send, AlertCircle, Bookmark } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { scaleNutrients } from '../services/logMath';
import { isAiReady, type AiAccess } from '../services/aiRuntime';

interface RefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedItems: Omit<FoodItem, 'id'>[];
  parsedWorkout: Omit<WorkoutLog, 'id'> | null;
  logType: 'food' | 'workout' | 'mixed';
  onSave: (items: Omit<FoodItem, 'id'>[], workout: Omit<WorkoutLog, 'id'> | null, mealType?: MealSlot, timestamp?: number) => void;
  coachingMessage?: string;
  aiAccess: AiAccess;
  personality: CoachPersonality;
  calorieGoal?: number;
  consumedToday?: number;
  onSaveTemplate?: (name: string, items: Omit<FoodItem, 'id'>[]) => void;
  weightKg?: number;
  initialMealType?: MealSlot;
  isEditing?: boolean;
  initialTimestamp?: number; // when editing/instant-editing: seed the When control
}

/** Format an epoch ms to the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function toLocalDatetimeInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const MEAL_SLOTS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: '🍳 Breakfast' },
  { key: 'lunch', label: '🥗 Lunch' },
  { key: 'dinner', label: '🍱 Dinner' },
  { key: 'snack', label: '🍎 Snack' },
];

// In-progress edits are mirrored to sessionStorage so an accidental close (or a
// failed correction the user gives up on) doesn't lose a complex meal.
const DRAFT_KEY = 'hellocal_refine_draft';
const DRAFT_TTL = 30 * 60 * 1000;
interface RefineDraft {
  items: Omit<FoodItem, 'id'>[];
  workout: Omit<WorkoutLog, 'id'> | null;
  coaching: string;
  modalLogType: 'food' | 'workout' | 'mixed';
  mealSlot?: MealSlot;
  ts: number;
}
const readDraft = (): RefineDraft | null => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as RefineDraft;
    if (!d?.ts || Date.now() - d.ts > DRAFT_TTL) {
      sessionStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return d;
  } catch {
    return null;
  }
};
const clearDraft = () => {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
};

interface MicroFieldConfig {
  key: keyof FoodItem;
  label: string;
  unit: string;
  color: string;
  bg: string;
  integer?: boolean;
}

const ADDITIONAL_MICROS: MicroFieldConfig[] = [
  { key: 'sugar', label: 'Sugar', unit: 'g', color: 'var(--accent-rose)', bg: 'rgba(244,63,94,0.03)' },
  { key: 'saturatedFat', label: 'Sat Fat', unit: 'g', color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.03)' },
  { key: 'transFat', label: 'Trans Fat', unit: 'g', color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.03)' },
  { key: 'iron', label: 'Iron', unit: 'mg', color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.03)' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', color: 'var(--accent-teal)', bg: 'rgba(16,185,129,0.03)', integer: true },
  { key: 'potassium', label: 'Potassium', unit: 'mg', color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.03)', integer: true },
  { key: 'cholesterol', label: 'Cholest', unit: 'mg', color: 'var(--accent-rose)', bg: 'rgba(244,63,94,0.03)', integer: true },
  { key: 'vitaminA', label: 'Vit A', unit: 'mcg', color: 'var(--accent-teal)', bg: 'rgba(16,185,129,0.03)' },
  { key: 'vitaminC', label: 'Vit C', unit: 'mg', color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.03)' },
  { key: 'vitaminD', label: 'Vit D', unit: 'mcg', color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.03)' },
  { key: 'vitaminB12', label: 'Vit B12', unit: 'mcg', color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.03)' },
  { key: 'zinc', label: 'Zinc', unit: 'mg', color: 'var(--accent-teal)', bg: 'rgba(16,185,129,0.03)' },
  { key: 'magnesium', label: 'Magnes', unit: 'mg', color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.03)', integer: true },
  { key: 'folate', label: 'Folate', unit: 'mcg', color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.03)' }
];

export const RefinementModal: React.FC<RefinementModalProps> = ({
  isOpen,
  onClose,
  parsedItems,
  parsedWorkout,
  logType,
  onSave,
  coachingMessage: initialCoaching,
  aiAccess,
  personality,
  calorieGoal,
  consumedToday = 0,
  onSaveTemplate,
  weightKg,
  initialMealType,
  isEditing,
  initialTimestamp
}) => {
  const [items, setItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [newMicroInputs, setNewMicroInputs] = useState<Record<number, { name: string; val: string; unit: string }>>({});
  const [workout, setWorkout] = useState<Omit<WorkoutLog, 'id'> | null>(null);
  const [coaching, setCoaching] = useState('');
  const [modalLogType, setModalLogType] = useState<'food' | 'workout' | 'mixed'>('food');
  
  const aiReady = isAiReady(aiAccess);

  // Correction States
  const [corrStatus, setCorrStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [corrInput, setCorrInput] = useState('');
  const [corrError, setCorrError] = useState<string | null>(null);
  // Preset naming: null = not naming, string = inline name field is open.
  const [presetName, setPresetName] = useState<string | null>(null);
  // Chosen meal slot; undefined = auto-detect by time of day at save.
  const [mealSlot, setMealSlot] = useState<MealSlot | undefined>(undefined);
  const [logTime, setLogTime] = useState(''); // datetime-local; empty = now (backfill)
  const [seededLogTime, setSeededLogTime] = useState(''); // value the field opened with
  const [draftAvailable, setDraftAvailable] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, containerRef);

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
      setPresetName(null);
      setMealSlot(initialMealType);
      // When editing (or instant-editing) an existing log, seed the When control with
      // its current time so the user can adjust it; a new log defaults to empty (=now).
      const seeded = isEditing && initialTimestamp ? toLocalDatetimeInput(initialTimestamp) : '';
      setLogTime(seeded);
      setSeededLogTime(seeded);
      // Offer to restore a recent draft for a NEW log only when it differs from
      // the parse we're showing (avoids nagging when nothing was lost).
      if (!isEditing) {
        const d = readDraft();
        setDraftAvailable(!!d && d.items.length > 0 && JSON.stringify(d.items) !== JSON.stringify(parsedItems));
      } else {
        setDraftAvailable(false);
      }
    }
  }, [isOpen, parsedItems, parsedWorkout, logType, initialCoaching, initialMealType, isEditing, initialTimestamp]);

  // Mirror in-progress edits to sessionStorage (new logs only — edits have a
  // persisted source of truth already).
  useEffect(() => {
    if (!isOpen || isEditing) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ items, workout, coaching, modalLogType, mealSlot, ts: Date.now() }));
    } catch {
      /* ignore */
    }
  }, [isOpen, isEditing, items, workout, coaching, modalLogType, mealSlot]);

  // Escape-to-close + background scroll lock while the modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleUpdateField = (index: number, field: keyof Omit<FoodItem, 'id'>, value: any) => {
    const updated = [...items];
    const nextItem = {
      ...updated[index],
      [field]: value
    };
    if (field === 'sugar' && nextItem.addedSugar !== undefined && nextItem.addedSugar > value) {
      nextItem.addedSugar = value;
    } else if (field === 'addedSugar' && nextItem.sugar !== undefined && value > nextItem.sugar) {
      nextItem.sugar = value;
    }
    updated[index] = nextItem;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Quick-scale + offline portion correction share scaleNutrients (services/logMath)
  // so calories/sodium round to integers and no nutrient is silently left behind.
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
    clearDraft();
    // Only emit a timestamp when the user actually changed the When field. Otherwise
    // an unchanged edit would round the original time down to the minute (the input's
    // precision), shifting same-minute meals; passing undefined makes App keep the
    // original full-precision timestamp.
    const changed = logTime !== seededLogTime;
    const parsedTs = changed && logTime ? new Date(logTime).getTime() : NaN;
    const timestamp = Number.isFinite(parsedTs) ? parsedTs : undefined;
    onSave(
      items,
      (modalLogType === 'workout' || modalLogType === 'mixed') ? workout : null,
      modalLogType === 'workout' ? undefined : mealSlot,
      timestamp
    );
    onClose();
  };

  const restoreDraft = () => {
    const d = readDraft();
    if (d) {
      setItems(d.items.map((it) => ({ ...it })));
      setWorkout(d.workout ? { ...d.workout } : null);
      setCoaching(d.coaching);
      setModalLogType(d.modalLogType);
      if (d.mealSlot) setMealSlot(d.mealSlot);
    }
    setDraftAvailable(false);
  };

  const dismissDraft = () => {
    clearDraft();
    setDraftAvailable(false);
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
    if (!aiReady) {
      setCorrStatus('idle');
      setCorrError('Gemini API key required for voice corrections.');
      return;
    }

    try {
      const res = await gemini.correctVoice(items, workout, blob, aiAccess, personality, weightKg);
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
      if (aiReady) {
        const res = await gemini.correctText(items, workout, query, aiAccess, personality, weightKg);
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
          // Anchor to a well-formed token so typos like "1..5x" are rejected
          // rather than yielding a bogus 0.5x from a matched substring.
          const m = newPortion.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*x(?:$|\s)/);
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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Review and refine log">
      <div
        ref={containerRef}
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
          <button onClick={onClose} className="btn-icon" aria-label="Close" style={{ borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
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

          {/* Unsaved-draft restore prompt */}
          {draftAvailable && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 0.85rem',
              marginBottom: '1rem',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}>
              <span style={{ flex: 1 }}>You have an unsaved draft from earlier.</span>
              <button type="button" onClick={restoreDraft} className="btn btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                Restore
              </button>
              <button type="button" onClick={dismissDraft} aria-label="Dismiss draft" className="btn-icon" style={{ width: '26px', height: '26px', borderRadius: '50%' }}>
                <X size={13} />
              </button>
            </div>
          )}

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

              {/* Meal slot picker — "Auto" assigns by time of day; otherwise an explicit slot. */}
              <div role="group" aria-label="Meal slot" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.25rem' }}>
                {([{ key: undefined, label: 'Auto' }, ...MEAL_SLOTS] as { key: MealSlot | undefined; label: string }[]).map(({ key, label }) => {
                  const selected = mealSlot === key;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setMealSlot(key)}
                      style={{
                        padding: '0.3rem 0.7rem',
                        borderRadius: '99px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-display)',
                        cursor: 'pointer',
                        background: selected ? 'var(--accent-purple)' : 'rgba(139,92,246,0.08)',
                        border: `1px solid ${selected ? 'var(--accent-purple)' : 'var(--border-glass)'}`,
                        color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        transition: 'var(--transition-smooth)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* When: log now (default) / backfill a past date/time / change the time
                  of the meal being edited. Shown in edit mode too so an instant-logged
                  item can be moved to an earlier time after the fact. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>When</span>
                <input
                  type="datetime-local"
                  value={logTime}
                  onChange={(e) => setLogTime(e.target.value)}
                  aria-label="Log date and time (leave blank for now)"
                  style={{ background: 'var(--bg-glass-light)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.55rem', color: 'var(--text-primary)', fontSize: '0.78rem', outline: 'none' }}
                />
                {logTime ? (
                  <button type="button" onClick={() => setLogTime('')} style={{ padding: '0.3rem 0.6rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(139,92,246,0.08)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Now</button>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>= now (set to backfill a missed meal)</span>
                )}
              </div>

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

                    {/* Expandable Extra Micronutrients section */}
                    <div style={{ marginTop: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          padding: '0.2rem 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontFamily: 'var(--font-display)',
                          textDecoration: 'underline'
                        }}
                      >
                        {expandedItems[index] ? 'Hide extra micronutrients ▲' : 'Show extra micronutrients ▼'}
                      </button>

                      {expandedItems[index] && (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '0.4rem',
                            borderTop: '1px dashed var(--border-glass)',
                          paddingTop: '0.5rem'
                        }}>
                          {ADDITIONAL_MICROS.map((micro) => {
                            const val = (item as any)[micro.key] !== undefined ? (item as any)[micro.key] : 0;
                            return (
                              <div key={micro.key} style={{ display: 'flex', alignItems: 'center', background: micro.bg, borderRadius: '8px', padding: '0.25rem' }}>
                                <span style={{ fontSize: '0.62rem', color: micro.color, marginRight: '0.25rem', fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }}>
                                  {micro.label}({micro.unit})
                                </span>
                                <input
                                  type="number"
                                  value={val}
                                  onChange={(e) => {
                                    const parsed = micro.integer ? parseInt(e.target.value) : parseFloat(e.target.value);
                                    handleUpdateField(index, micro.key as any, parsed || 0);
                                  }}
                                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                                />
                              </div>
                            );
                          })}

                          {item.micros && Object.keys(item.micros).map((mKey) => {
                            const val = item.micros?.[mKey] ?? 0;
                            if (ADDITIONAL_MICROS.some(m => m.key === mKey)) return null;
                            return (
                              <div key={mKey} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', padding: '0.25rem', border: '1px solid var(--border-glass)' }}>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginRight: '0.25rem', fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }}>
                                  {mKey}
                                </span>
                                <input
                                  type="number"
                                  value={val}
                                  onChange={(e) => {
                                    const parsed = parseFloat(e.target.value) || 0;
                                    const updated = [...items];
                                    const nextItem = { ...updated[index] };
                                    if (nextItem.micros) {
                                      nextItem.micros = {
                                        ...nextItem.micros,
                                        [mKey]: parsed
                                      };
                                    }
                                    updated[index] = nextItem;
                                    setItems(updated);
                                  }}
                                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...items];
                                    const nextItem = { ...updated[index] };
                                    if (nextItem.micros) {
                                      const copy = { ...nextItem.micros };
                                      delete copy[mKey];
                                      nextItem.micros = Object.keys(copy).length > 0 ? copy : undefined;
                                    }
                                    updated[index] = nextItem;
                                    setItems(updated);
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', fontSize: '0.75rem', cursor: 'pointer', padding: '0 0.15rem' }}
                                  title={`Remove ${mKey}`}
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}

                          <div style={{
                            gridColumn: 'span 3',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            marginTop: '0.5rem',
                            borderTop: '1px solid rgba(255,255,255,0.03)',
                            paddingTop: '0.5rem'
                          }}>
                            <input
                              type="text"
                              placeholder="Nutrient Name (e.g. Copper)"
                              value={newMicroInputs[index]?.name ?? ''}
                              onChange={(e) => setNewMicroInputs(prev => ({
                                ...prev,
                                [index]: { ...(prev[index] ?? { val: '', unit: 'mg' }), name: e.target.value }
                              }))}
                              style={{ flex: 2, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.75rem', padding: '0.2rem 0.4rem', outline: 'none' }}
                            />
                            <input
                              type="number"
                              placeholder="Value"
                              value={newMicroInputs[index]?.val ?? ''}
                              onChange={(e) => setNewMicroInputs(prev => ({
                                ...prev,
                                [index]: { ...(prev[index] ?? { name: '', unit: 'mg' }), val: e.target.value }
                              }))}
                              style={{ flex: 1, background: 'var(--bg-glass-light)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.75rem', padding: '0.2rem 0.4rem', outline: 'none', width: '50px' }}
                            />
                            <select
                              value={newMicroInputs[index]?.unit ?? 'mg'}
                              onChange={(e) => setNewMicroInputs(prev => ({
                                ...prev,
                                [index]: { ...(prev[index] ?? { name: '', val: '' }), unit: e.target.value }
                              }))}
                              style={{ background: 'var(--bg-glass-light)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '0.75rem', padding: '0.18rem' }}
                            >
                              <option value="mg">mg</option>
                              <option value="mcg">mcg</option>
                              <option value="g">g</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const pending = newMicroInputs[index];
                                if (!pending || !pending.name.trim() || !pending.val) return;
                                const normName = pending.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                                const val = parseFloat(pending.val) || 0;
                                
                                const updated = [...items];
                                const nextItem = { ...updated[index] };
                                nextItem.micros = {
                                  ...(nextItem.micros || {}),
                                  [normName]: val
                                };
                                updated[index] = nextItem;
                                setItems(updated);
                                
                                setNewMicroInputs(prev => ({
                                  ...prev,
                                  [index]: { name: '', val: '', unit: 'mg' }
                                }));
                              }}
                              disabled={!newMicroInputs[index]?.name.trim() || !newMicroInputs[index]?.val}
                              style={{
                                background: 'var(--accent-purple)',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                color: '#fff',
                                fontSize: '0.72rem',
                                padding: '0.22rem 0.5rem',
                                cursor: 'pointer',
                                opacity: (!newMicroInputs[index]?.name.trim() || !newMicroInputs[index]?.val) ? 0.5 : 1
                              }}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
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
                          aria-label={`Scale ${item.name} by ${label}`}
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

              {/* Save the staged items as a one-tap reusable preset. */}
              {onSaveTemplate && items.length > 0 && (
                presetName === null ? (
                  <button
                    type="button"
                    onClick={() => setPresetName('')}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '0.5rem 0', borderRadius: '12px', fontSize: '0.8rem' }}
                  >
                    <Bookmark size={14} /> Save as preset
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <input
                      autoFocus
                      aria-label="Preset name"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && presetName.trim()) {
                          onSaveTemplate(presetName.trim(), items);
                          setPresetName(null);
                        }
                      }}
                      placeholder="Preset name (e.g. My breakfast)"
                      style={{ flex: 1, background: 'var(--bg-glass-light)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}
                    />
                    <button
                      type="button"
                      disabled={!presetName.trim()}
                      onClick={() => { onSaveTemplate(presetName.trim(), items); setPresetName(null); }}
                      className="btn btn-primary"
                      style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem' }}
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setPresetName(null)} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                      Cancel
                    </button>
                  </div>
                )
              )}
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
                aria-label="Type a correction or command"
                value={corrInput}
                onChange={(e) => setCorrInput(e.target.value)}
                placeholder={aiReady ? "Speak/type corrections (e.g. 'remove the eggs, make yogurt double portion')..." : "Type changes (offline commands support 'remove yogurt', etc)..."}
                disabled={corrStatus === 'processing'}
                style={{
                  width: '100%',
                  background: 'var(--bg-glass-light)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '99px',
                  padding: '0.6rem 2.5rem 0.6rem 1rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {/* Mic Icon within input for corrections */}
              {aiReady && (
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
