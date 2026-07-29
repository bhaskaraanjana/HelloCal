import React, { useState, useMemo } from 'react';
import { Sparkles, Activity, Target, User } from 'lucide-react';
import {
  deriveGoals,
  calcTDEE,
  ACTIVITY_LABELS,
  GOAL_LABELS,
  kgToLb,
  lbToKg,
  cmToFeetInches,
  feetInchesToCm,
} from '../services/nutritionMath';
import type {
  UserProfile,
  UserGoals,
  Sex,
  ActivityLevel,
  GoalDirection,
} from '../types/nutrition';

interface OnboardingProps {
  isOpen: boolean;
  initialProfile: UserProfile;
  onComplete: (profile: UserProfile, derivedGoals: UserGoals) => void;
  onSkip: () => void;
}

const ACTIVITY_OPTIONS: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'veryActive',
];

const GOAL_OPTIONS: GoalDirection[] = ['lose', 'maintain', 'gain'];

const GOAL_ACCENTS: Record<GoalDirection, string> = {
  lose: 'var(--accent-blue)',
  maintain: 'var(--accent-teal)',
  gain: 'var(--accent-amber)',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '1.5rem',
};

const sectionTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontFamily: 'var(--font-display)',
  fontSize: '0.85rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  marginBottom: '0.75rem',
};

const Onboarding: React.FC<OnboardingProps> = ({
  isOpen,
  initialProfile,
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState(1);
  const [sex, setSex] = useState<Sex | undefined>(initialProfile.sex);
  const [age, setAge] = useState<string>(
    initialProfile.age != null ? String(initialProfile.age) : ''
  );
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [heightCmInput, setHeightCmInput] = useState<string>(() =>
    initialProfile.heightCm != null ? String(Math.round(initialProfile.heightCm)) : ''
  );
  const [heightFtInput, setHeightFtInput] = useState<string>(() => {
    if (initialProfile.heightCm == null) return '';
    const { feet } = cmToFeetInches(initialProfile.heightCm);
    return String(feet);
  });
  const [heightInInput, setHeightInInput] = useState<string>(() => {
    if (initialProfile.heightCm == null) return '';
    const { inches } = cmToFeetInches(initialProfile.heightCm);
    return String(inches);
  });
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>(
    initialProfile.preferredWeightUnit ?? 'kg'
  );
  const [weightInput, setWeightInput] = useState<string>(() => {
    if (initialProfile.weightKg == null) return '';
    const unit = initialProfile.preferredWeightUnit ?? 'kg';
    const val = unit === 'lb' ? kgToLb(initialProfile.weightKg) : initialProfile.weightKg;
    return String(Math.round(val * 10) / 10);
  });
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | undefined>(
    initialProfile.activityLevel
  );
  const [goalDirection, setGoalDirection] = useState<GoalDirection | undefined>(
    initialProfile.goalDirection
  );

  // Canonical weight in kg, derived from the current input + unit.
  const weightKg = useMemo<number | undefined>(() => {
    const raw = parseFloat(weightInput);
    if (!Number.isFinite(raw) || raw <= 0) return undefined;
    return weightUnit === 'lb' ? lbToKg(raw) : raw;
  }, [weightInput, weightUnit]);

  const resolvedHeightCm = useMemo<number | undefined>(() => {
    if (heightUnit === 'cm') {
      const raw = parseFloat(heightCmInput);
      return Number.isFinite(raw) && raw > 0 ? raw : undefined;
    }
    const ft = parseInt(heightFtInput, 10);
    const inches = parseInt(heightInInput, 10);
    if (!Number.isFinite(ft) || ft < 0) return undefined;
    const inVal = Number.isFinite(inches) && inches >= 0 ? inches : 0;
    const cm = feetInchesToCm(ft, inVal);
    return cm > 0 ? Math.round(cm * 10) / 10 : undefined;
  }, [heightUnit, heightCmInput, heightFtInput, heightInInput]);

  const draftProfile = useMemo<UserProfile>(() => {
    const parsedAge = parseInt(age, 10);
    return {
      ...initialProfile,
      sex,
      age: Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : undefined,
      heightCm: resolvedHeightCm,
      weightKg,
      activityLevel,
      goalDirection,
      preferredWeightUnit: weightUnit,
    };
  }, [
    initialProfile,
    sex,
    age,
    resolvedHeightCm,
    weightKg,
    activityLevel,
    goalDirection,
    weightUnit,
  ]);

  const tdee = useMemo(() => calcTDEE(draftProfile), [draftProfile]);
  const derivedGoals = useMemo(() => deriveGoals(draftProfile), [draftProfile]);

  const isStep1Valid = useMemo(() => {
    const parsedAge = parseInt(age, 10);
    const parsedWeight = parseFloat(weightInput);
    return (
      sex !== undefined &&
      Number.isFinite(parsedAge) &&
      parsedAge > 0 &&
      Number.isFinite(parsedWeight) &&
      parsedWeight > 0 &&
      resolvedHeightCm !== undefined
    );
  }, [sex, age, weightInput, resolvedHeightCm]);

  const isStep2Valid = useMemo(() => {
    return activityLevel !== undefined && goalDirection !== undefined;
  }, [activityLevel, goalDirection]);

  if (!isOpen) return null;

  const handleSwitchUnit = (next: 'kg' | 'lb') => {
    if (next === weightUnit) return;
    if (weightKg != null) {
      const val = next === 'lb' ? kgToLb(weightKg) : weightKg;
      setWeightInput(String(Math.round(val * 10) / 10));
    }
    setWeightUnit(next);
  };

  const handleSwitchHeightUnit = (next: 'cm' | 'ft') => {
    if (next === heightUnit) return;
    if (resolvedHeightCm != null) {
      if (next === 'ft') {
        const { feet, inches } = cmToFeetInches(resolvedHeightCm);
        setHeightFtInput(String(feet));
        setHeightInInput(String(inches));
      } else {
        setHeightCmInput(String(Math.round(resolvedHeightCm)));
      }
    }
    setHeightUnit(next);
  };

  const unitToggle = (options: readonly string[], active: string, onSelect: (v: string) => void, ariaLabel: string) => (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        borderRadius: '12px',
        border: '1px solid var(--border-glass)',
        overflow: 'hidden',
        flexShrink: 0,
        alignSelf: 'stretch',
      }}
    >
      {options.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onSelect(u)}
          aria-pressed={active === u}
          style={{
            flex: 1,
            minWidth: '3.25rem',
            padding: '0.8rem 1rem',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '0.9rem',
            lineHeight: 1,
            transition: 'var(--transition-smooth)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: active === u ? 'var(--accent-purple)' : 'rgba(255,255,255,0.03)',
            color: active === u ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: active === u ? '0 0 12px var(--accent-purple-glow)' : 'none',
          }}
        >
          {u}
        </button>
      ))}
    </div>
  );

  const handleBuildPlan = () => {
    if (!derivedGoals) return;
    onComplete(
      { ...draftProfile, onboardingComplete: true, preferredWeightUnit: weightUnit },
      derivedGoals
    );
  };

  const toggleBtnBase: React.CSSProperties = {
    flex: 1,
    padding: '0.7rem 0.5rem',
    borderRadius: '12px',
    border: '1px solid var(--border-glass)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
  };

  const activeToggle = (accent: string, glow: string): React.CSSProperties => ({
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text-primary)',
    borderColor: accent,
    boxShadow: `0 0 12px ${glow}`,
  });

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Welcome onboarding">
      <div className="modal-content" style={{ maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div
          style={{
            padding: '1.5rem 1.75rem 1rem 1.75rem',
            textAlign: 'center',
            borderBottom: '1px solid var(--border-glass)',
          }}
        >
          {/* Progress Indicators */}
          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginBottom: '1rem' }}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  width: '36px',
                  height: '4px',
                  borderRadius: '2px',
                  background: s <= step ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: s <= step ? '0 0 8px var(--accent-purple-glow)' : 'none',
                  transition: 'background-color 0.3s ease, box-shadow 0.3s ease'
                }}
              />
            ))}
          </div>

          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 0.85rem auto',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid var(--border-glass-glow)',
              boxShadow: '0 0 24px var(--accent-purple-glow)',
            }}
          >
            <Sparkles size={28} color="var(--accent-purple)" />
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 800,
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Welcome to Hello<span style={{ color: 'var(--accent-purple)' }}>Cal</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>
            {step === 1 && 'Let\'s personalize your bio metrics.'}
            {step === 2 && 'How active are you, and what is your goal?'}
            {step === 3 && 'Here is your personalized daily nutrition target plan.'}
          </p>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
          {step === 1 && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>
                <User size={15} color="var(--accent-purple)" /> About you
              </div>

              {/* Sex + Age — one row; sex gets more width */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
                <div className="input-group" style={{ flex: 1.65, marginBottom: 0 }}>
                  <label className="input-label">Sex</label>
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button
                      type="button"
                      onClick={() => setSex('male')}
                      aria-pressed={sex === 'male'}
                      style={{
                        ...toggleBtnBase,
                        ...(sex === 'male'
                          ? activeToggle('var(--accent-blue)', 'var(--accent-blue-glow)')
                          : {}),
                      }}
                    >
                      Male
                    </button>
                    <button
                      type="button"
                      onClick={() => setSex('female')}
                      aria-pressed={sex === 'female'}
                      style={{
                        ...toggleBtnBase,
                        ...(sex === 'female'
                          ? activeToggle('var(--accent-rose)', 'var(--accent-rose-glow)')
                          : {}),
                      }}
                    >
                      Female
                    </button>
                  </div>
                </div>
                <div className="input-group" style={{ flex: 0.85, marginBottom: 0 }}>
                  <label className="input-label" htmlFor="onb-age">
                    Age
                  </label>
                  <input
                    id="onb-age"
                    className="input-field"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={120}
                    placeholder="years"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
              </div>

              {/* Weight — full row with unit toggle */}
              <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label" htmlFor="onb-weight">
                  Weight
                </label>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'stretch' }}>
                  <input
                    id="onb-weight"
                    className="input-field"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    placeholder={weightUnit}
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  {unitToggle(['kg', 'lb'], weightUnit, (u) => handleSwitchUnit(u as 'kg' | 'lb'), 'Weight unit')}
                </div>
              </div>

              {/* Height — full row with cm / ft toggle */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Height</label>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'stretch' }}>
                  {heightUnit === 'cm' ? (
                    <input
                      id="onb-height-cm"
                      className="input-field"
                      type="number"
                      inputMode="decimal"
                      min={50}
                      max={260}
                      placeholder="cm"
                      value={heightCmInput}
                      onChange={(e) => setHeightCmInput(e.target.value)}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 0, alignItems: 'stretch' }}>
                      <input
                        id="onb-height-ft"
                        className="input-field"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={8}
                        placeholder="ft"
                        value={heightFtInput}
                        onChange={(e) => setHeightFtInput(e.target.value)}
                        style={{ flex: 1, minWidth: 0 }}
                        aria-label="Height feet"
                      />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flexShrink: 0, alignSelf: 'center' }}>ft</span>
                      <input
                        id="onb-height-in"
                        className="input-field"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={11}
                        placeholder="in"
                        value={heightInInput}
                        onChange={(e) => setHeightInInput(e.target.value)}
                        style={{ flex: 1, minWidth: 0 }}
                        aria-label="Height inches"
                      />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flexShrink: 0, alignSelf: 'center' }}>in</span>
                    </div>
                  )}
                  {unitToggle(['cm', 'ft'], heightUnit, (u) => handleSwitchHeightUnit(u as 'cm' | 'ft'), 'Height unit')}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <>
              {/* Section: Activity */}
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>
                  <Activity size={15} color="var(--accent-teal)" /> Activity level
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {ACTIVITY_OPTIONS.map((level) => {
                    const active = activityLevel === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setActivityLevel(level)}
                        aria-pressed={active}
                        style={{
                          textAlign: 'left',
                          padding: '0.7rem 0.95rem',
                          borderRadius: '12px',
                          border: `1px solid ${active ? 'var(--accent-teal)' : 'var(--border-glass)'}`,
                          background: active ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.9rem',
                          fontWeight: active ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'var(--transition-smooth)',
                          boxShadow: active ? '0 0 12px var(--accent-teal-glow)' : 'none',
                        }}
                      >
                        {ACTIVITY_LABELS[level]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section: Goal */}
              <div style={{ ...sectionStyle, marginBottom: 0 }}>
                <div style={sectionTitleStyle}>
                  <Target size={15} color="var(--accent-amber)" /> Your goal
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  {GOAL_OPTIONS.map((goal) => {
                    const active = goalDirection === goal;
                    const accent = GOAL_ACCENTS[goal];
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => setGoalDirection(goal)}
                        aria-pressed={active}
                        style={{
                          ...toggleBtnBase,
                          fontSize: '0.85rem',
                          ...(active
                            ? {
                                background: 'rgba(255,255,255,0.06)',
                                color: 'var(--text-primary)',
                                borderColor: accent,
                                boxShadow: `0 0 12px ${accent}`,
                              }
                            : {}),
                        }}
                      >
                        {GOAL_LABELS[goal]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <div
              className="glass-card"
              style={{
                padding: '1.25rem 1.5rem',
                borderColor: derivedGoals ? 'var(--border-glass-glow)' : 'var(--border-glass)',
                background: 'rgba(255, 255, 255, 0.01)',
              }}
            >
              {derivedGoals && tdee != null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Maintenance (TDEE)
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        {tdee.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>kcal</span>
                      </div>
                    </div>
                    <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-glass)' }} />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Your daily target
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 800, color: 'var(--accent-purple)', textShadow: '0 0 18px var(--accent-purple-glow)', marginTop: '0.2rem' }}>
                        {derivedGoals.calories.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>kcal</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed var(--border-glass)', paddingTop: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                      Target Macronutrients
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <div style={{ flex: 1, background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '10px', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Protein</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.1rem' }}>{derivedGoals.protein}g</div>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.15)', borderRadius: '10px', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Carbs</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.1rem' }}>{derivedGoals.carbs}g</div>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '10px', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Fat</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.1rem' }}>{derivedGoals.fat}g</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  <Sparkles size={16} color="var(--accent-purple)" />
                  <span>Fill in the fields above and we&apos;ll compute your personalized calorie target.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '1.1rem 1.75rem 1.5rem 1.75rem',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          {step === 1 && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!isStep1Valid}
                style={{
                  width: '100%',
                  opacity: isStep1Valid ? 1 : 0.45,
                  cursor: isStep1Valid ? 'pointer' : 'not-allowed',
                }}
              >
                Next: Activity & Goal
              </button>
              <button
                type="button"
                onClick={onSkip}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  padding: '0.4rem',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                }}
              >
                Skip for now
              </button>
            </>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(1)}
                style={{ flex: 1, fontSize: '0.9rem', padding: '0.8rem 1rem' }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(3)}
                disabled={!isStep2Valid}
                style={{
                  flex: 2.2,
                  opacity: isStep2Valid ? 1 : 0.45,
                  cursor: isStep2Valid ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  padding: '0.8rem 1rem',
                }}
              >
                Next: View Target
              </button>
            </div>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBuildPlan}
                disabled={!derivedGoals}
                style={{
                  width: '100%',
                  opacity: derivedGoals ? 1 : 0.45,
                  cursor: derivedGoals ? 'pointer' : 'not-allowed',
                }}
              >
                <Sparkles size={18} /> Build my plan
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', padding: '0 0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    padding: '0.2rem',
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={onSkip}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    padding: '0.2rem',
                  }}
                >
                  Skip for now
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export { Onboarding };
export default Onboarding;
