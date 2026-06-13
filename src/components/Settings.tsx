import React, { useState } from 'react';
import type { UserGoals, CoachPersonality, MealReminders } from '../types/nutrition';
import { clampGoal } from '../services/validation';
import { shareText, isNative } from '../services/native';
import { Eye, EyeOff, Sparkles, Goal, ShieldAlert, Key, HardDriveDownload, HardDriveUpload, Bell } from 'lucide-react';

interface SettingsProps {
  apiKey: string;
  personality: CoachPersonality;
  goals: UserGoals;
  onSaveKey: (key: string) => void;
  onSavePersonality: (personality: CoachPersonality) => void;
  onSaveGoals: (goals: UserGoals) => void;
  onClearData: () => void;
  onImportData: (jsonData: string) => boolean;
  exportDataJson: string;
  reminders?: MealReminders;
  onSaveReminders?: (r: MealReminders) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  apiKey,
  personality,
  goals,
  onSaveKey,
  onSavePersonality,
  onSaveGoals,
  onClearData,
  onImportData,
  exportDataJson,
  reminders,
  onSaveReminders
}) => {
  const rem: MealReminders = reminders || { enabled: false, breakfast: '08:00', lunch: '12:30', dinner: '18:30' };
  const [remEnabled, setRemEnabled] = useState(rem.enabled);
  const [remBreakfast, setRemBreakfast] = useState(rem.breakfast);
  const [remLunch, setRemLunch] = useState(rem.lunch);
  const [remDinner, setRemDinner] = useState(rem.dinner);

  const handleSaveReminders = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveReminders?.({ enabled: remEnabled, breakfast: remBreakfast, lunch: remLunch, dinner: remDinner });
    triggerSaveStatus('reminders');
  };
  const [keyInput, setKeyInput] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [caloriesInput, setCaloriesInput] = useState(goals.calories);
  const [proteinInput, setProteinInput] = useState(goals.protein);
  const [carbsInput, setCarbsInput] = useState(goals.carbs);
  const [fatInput, setFatInput] = useState(goals.fat);
  const [addedSugarInput, setAddedSugarInput] = useState(goals.addedSugar || 30);
  const [fiberInput, setFiberInput] = useState(goals.fiber || 30);
  const [sodiumInput, setSodiumInput] = useState(goals.sodium || 2300);

  const [saveStatus, setSaveStatus] = useState<{ [key: string]: boolean }>({});

  const triggerSaveStatus = (key: string) => {
    setSaveStatus(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setSaveStatus(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const handleSaveKey = () => {
    onSaveKey(keyInput);
    triggerSaveStatus('key');
  };

  const handleSaveGoals = (e: React.FormEvent) => {
    e.preventDefault();
    const clamped: UserGoals = {
      calories: clampGoal('calories', Number(caloriesInput), 2000),
      protein: clampGoal('protein', Number(proteinInput), 130),
      carbs: clampGoal('carbs', Number(carbsInput), 220),
      fat: clampGoal('fat', Number(fatInput), 65),
      addedSugar: clampGoal('addedSugar', Number(addedSugarInput), 30),
      fiber: clampGoal('fiber', Number(fiberInput), 30),
      sodium: clampGoal('sodium', Number(sodiumInput), 2300),
    };
    // Reflect any clamping back into the inputs so the user sees the corrected values.
    setCaloriesInput(clamped.calories);
    setProteinInput(clamped.protein);
    setCarbsInput(clamped.carbs);
    setFatInput(clamped.fat);
    setAddedSugarInput(clamped.addedSugar!);
    setFiberInput(clamped.fiber!);
    setSodiumInput(clamped.sodium!);
    onSaveGoals(clamped);
    triggerSaveStatus('goals');
  };

  const handleSelectPersonality = (p: CoachPersonality) => {
    onSavePersonality(p);
    triggerSaveStatus('personality');
  };

  const handleExport = () => {
    const filename = `hellocal_backup_${new Date().toISOString().split('T')[0]}.json`;
    // On native, use the share sheet (saves to Files/Drive/email); on web, downloads the file.
    if (isNative()) {
      shareText('HelloCal Backup', exportDataJson, filename);
      return;
    }
    const blob = new Blob([exportDataJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = onImportData(content);
      if (success) {
        alert('Data successfully imported and active! Reloading...');
        window.location.reload();
      } else {
        alert('Failed to import data. Please verify the JSON file structure.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetWithConfirmation = () => {
    if (confirm('CAUTION: Are you absolutely sure you want to wipe all logs, calorie goals, and API keys? This operation is irreversible!')) {
      onClearData();
      alert('All local database items have been purged.');
      window.location.reload();
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
      
      {/* 1. API Configuration */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{
          fontSize: '1.15rem',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          paddingBottom: '0.5rem'
        }}>
          <Key size={18} color="var(--accent-purple)" />
          AI Supermode Key Setup
        </h3>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          HelloCal processes standard transcripts offline. However, to unlock the <strong>Multimodal Microphone Recording</strong> (whisper tracking, auto serving-sizes, conversational coaching), you must enter a Gemini API Key. 
          You can get a free personal API key in seconds from the <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-purple)', textDecoration: 'none', fontWeight: 650 }}>Google AI Studio Portal</a>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Paste your Gemini API key (AIzaSy...)"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '0.75rem 2.5rem 0.75rem 1rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem'
                }}
              />
              <button 
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button onClick={handleSaveKey} className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }}>
              {saveStatus['key'] ? 'Saved!' : 'Save Key'}
            </button>
          </div>
          
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            🔑 Don't have a key? Find and generate your free Gemini API key in 10 seconds at: 
            <a 
              href="https://aistudio.google.com/api-keys" 
              target="_blank" 
              rel="noreferrer" 
              style={{ 
                color: 'var(--accent-purple)', 
                textDecoration: 'underline', 
                fontWeight: 650 
              }}
            >
              Google AI Studio Keys ↗
            </a>
          </span>
        </div>
      </div>

      {/* 2. Personalities Selector */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{
          fontSize: '1.15rem',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          paddingBottom: '0.5rem'
        }}>
          <Sparkles size={18} color="var(--accent-teal)" style={{ animation: 'float 2s infinite' }} />
          Select AI Coach Tone
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem'
        }}>
          {([
            { id: 'encouraging', label: 'Warm Coach', desc: 'Positive, motivating, congratulatory, very gentle on diet slips.' },
            { id: 'strict', label: 'Strict Trainer', desc: 'Direct, no-nonsense. Demands high protein, alerts on junk sugars.' },
            { id: 'analytical', label: 'Scientist', desc: 'Analytical, objective facts. Focuses on fiber, glycemic loads, biology.' },
            { id: 'chill', label: 'Chill Buddy', desc: 'Super relaxed, laidback, casual high-fives and zero food guilt.' }
          ] as const).map(p => (
            <button
              key={p.id}
              onClick={() => handleSelectPersonality(p.id)}
              style={{
                background: personality === p.id ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.01)',
                border: personality === p.id ? '1px solid var(--accent-purple)' : '1px solid var(--border-glass)',
                borderRadius: '16px',
                padding: '1.25rem 1rem',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                boxShadow: personality === p.id ? '0 0 15px rgba(139, 92, 246, 0.1)' : 'none',
                transition: 'var(--transition-smooth)'
              }}
              onMouseEnter={(e) => {
                if (personality !== p.id) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (personality !== p.id) {
                  e.currentTarget.style.borderColor = 'var(--border-glass)';
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)';
                }
              }}
            >
              <span style={{ 
                fontSize: '0.95rem', 
                fontWeight: 700, 
                fontFamily: 'var(--font-display)',
                color: personality === p.id ? 'var(--accent-purple)' : 'var(--text-primary)'
              }}>
                {p.label}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                {p.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Goal Managers */}
      <div className="glass-card">
        <h3 style={{
          fontSize: '1.15rem',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          paddingBottom: '0.5rem',
          marginBottom: '1.25rem'
        }}>
          <Goal size={18} color="var(--accent-amber)" />
          Configure Daily Targets
        </h3>

        <form onSubmit={handleSaveGoals} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
            {/* Calories Limit */}
            <div className="input-group">
              <label className="input-label">Calories Budget (kcal)</label>
              <input 
                type="number" 
                value={caloriesInput} 
                onChange={(e) => setCaloriesInput(parseInt(e.target.value) || 0)}
                className="input-field"
              />
            </div>
            
            {/* Protein Goal */}
            <div className="input-group">
              <label className="input-label">Protein Goal (g)</label>
              <input 
                type="number" 
                value={proteinInput} 
                onChange={(e) => setProteinInput(parseInt(e.target.value) || 0)}
                className="input-field"
              />
            </div>
            
            {/* Carbs Goal */}
            <div className="input-group">
              <label className="input-label">Carbs Goal (g)</label>
              <input 
                type="number" 
                value={carbsInput} 
                onChange={(e) => setCarbsInput(parseInt(e.target.value) || 0)}
                className="input-field"
              />
            </div>
            
            {/* Fat Goal */}
            <div className="input-group">
              <label className="input-label">Fats Goal (g)</label>
              <input 
                type="number" 
                value={fatInput} 
                onChange={(e) => setFatInput(parseInt(e.target.value) || 0)}
                className="input-field"
              />
            </div>
          </div>

          <div style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-display)',
            borderTop: '1px dashed rgba(255,255,255,0.06)',
            paddingTop: '0.75rem',
            marginTop: '0.25rem'
          }}>
            🎯 Daily Micronutrient Budgets
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
            {/* Added Sugar Limit */}
            <div className="input-group">
              <label className="input-label">Added Sugar Limit (g)</label>
              <input 
                type="number" 
                value={addedSugarInput} 
                onChange={(e) => setAddedSugarInput(parseInt(e.target.value) || 0)}
                className="input-field"
              />
            </div>

            {/* Dietary Fiber Target */}
            <div className="input-group">
              <label className="input-label">Dietary Fiber Target (g)</label>
              <input 
                type="number" 
                value={fiberInput} 
                onChange={(e) => setFiberInput(parseInt(e.target.value) || 0)}
                className="input-field"
              />
            </div>

            {/* Sodium Limit */}
            <div className="input-group">
              <label className="input-label">Sodium Limit (mg)</label>
              <input 
                type="number" 
                value={sodiumInput} 
                onChange={(e) => setSodiumInput(parseInt(e.target.value) || 0)}
                className="input-field"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ 
              alignSelf: 'flex-start',
              padding: '0.75rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {saveStatus['goals'] ? 'Goals Locked!' : 'Lock Target Budgets'}
          </button>
        </form>
      </div>

      {/* 3.5 Meal Reminders */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={18} color="var(--accent-purple)" /> Meal Reminders
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Gentle daily nudges to log your meals.{!isNative() && ' On the web, reminders fire only while HelloCal is open in a tab — install the app for true background reminders.'}
        </p>
        <form onSubmit={handleSaveReminders} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={remEnabled}
              onChange={(e) => setRemEnabled(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-purple)' }}
            />
            Enable meal reminders
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.85rem', opacity: remEnabled ? 1 : 0.5 }}>
            {([
              ['Breakfast', remBreakfast, setRemBreakfast],
              ['Lunch', remLunch, setRemLunch],
              ['Dinner', remDinner, setRemDinner],
            ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>{label}</label>
                <input
                  type="time"
                  value={value}
                  disabled={!remEnabled}
                  onChange={(e) => setter(e.target.value)}
                  aria-label={`${label} reminder time`}
                  style={{ padding: '0.6rem', border: '1px solid var(--border-glass)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                />
              </div>
            ))}
          </div>

          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}>
            {saveStatus['reminders'] ? 'Reminders Saved!' : 'Save Reminders'}
          </button>
        </form>
      </div>

      {/* 4. Data Center */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{
          fontSize: '1.15rem',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          paddingBottom: '0.5rem'
        }}>
          <ShieldAlert size={18} color="var(--accent-rose)" />
          Backup & Device Integrity Center
        </h3>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          All food timelines, targets, and API credentials are kept strictly in this web browser's local sandbox memory (`localStorage`). None of this data is sent to external clouds or servers. You can backup your logs locally, or reset the app here.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Export button */}
          <button 
            onClick={handleExport} 
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
          >
            <HardDriveDownload size={16} /> Export Backup JSON
          </button>

          {/* Import input trigger */}
          <label 
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}
          >
            <HardDriveUpload size={16} /> Restore Backup JSON
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport} 
              style={{ display: 'none' }}
            />
          </label>

          {/* Purge button */}
          <button 
            onClick={handleResetWithConfirmation} 
            className="btn btn-danger"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginLeft: 'auto' }}
          >
            Wipe Local Data
          </button>
        </div>
      </div>

    </div>
  );
};
export default Settings;
