import React, { useState, useEffect } from 'react';
import type { MealLog, FoodItem, WorkoutLog, UserGoals, CoachPersonality, CoachResponse, AppSettings } from './types/nutrition';
import { storage } from './services/storage';
import { Dashboard } from './components/Dashboard';
import { VoiceInput } from './components/VoiceInput';
import { FoodTimeline } from './components/FoodTimeline';
import { Analytics } from './components/Analytics';
import { Settings } from './components/Settings';
import { RefinementModal } from './components/RefinementModal';
import { Utensils, LayoutDashboard, BarChart2, Settings as SettingsIcon, Heart, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AiCustomizerDrawer } from './components/AiCustomizerDrawer';

export const App: React.FC = () => {
  // 1. Core States loaded from localStorage on mount
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [goals, setGoals] = useState<UserGoals>({ calories: 2000, protein: 130, carbs: 220, fat: 65, addedSugar: 30, fiber: 30, sodium: 2300 });
  const [geminiKey, setGeminiKey] = useState('');
  const [coachPersonality, setCoachPersonality] = useState<CoachPersonality>('encouraging');

  // Dashboard Dynamic Customizer Layout settings state
  const [appSettings, setAppSettings] = useState<AppSettings>({
    theme: 'obsidian',
    visibleMacros: { protein: true, carbs: true, fat: true },
    visibleMicros: { addedSugar: true, fiber: true, sodium: true },
    visibleWidgets: { calorieHalo: true, macros: true, micros: true, workouts: true, mealSlots: true, goalCompletion: true }
  });
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerScope, setCustomizerScope] = useState<'general' | 'macronutrients' | 'micronutrients' | 'widgets'>('general');

  // Loading indicator on first mount
  const [isLoaded, setIsLoaded] = useState(false);

  // Tab View
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'analytics' | 'settings'>('dashboard');

  // Refinement modal states
  const [refinementOpen, setRefinementOpen] = useState(false);
  const [stagedItems, setStagedItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [stagedWorkout, setStagedWorkout] = useState<Omit<WorkoutLog, 'id'> | null>(null);
  const [stagedLogType, setStagedLogType] = useState<'food' | 'workout' | 'mixed'>('food');
  const [stagedCoaching, setStagedCoaching] = useState('');

  // Floating notifications/toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize
  useEffect(() => {
    const data = storage.getData();
    setLogs(data.logs);
    setWorkouts(data.workouts || []);
    setGoals(data.goals);
    setGeminiKey(data.geminiKey);
    setCoachPersonality(data.coachPersonality);
    if (data.appSettings) {
      setAppSettings(data.appSettings);
    }
    setIsLoaded(true);
  }, []);

  // Sync theme class onto document.body whenever theme state updates
  useEffect(() => {
    document.body.className = `theme-${appSettings.theme}`;
  }, [appSettings.theme]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // State Updates & Persistence
  const handleSaveGoals = (newGoals: UserGoals) => {
    setGoals(newGoals);
    storage.saveGoals(newGoals);
    triggerToast('Daily target budgets successfully locked in.');
    confetti({ particleCount: 60, spread: 40, colors: ['#8b5cf6', '#06b6d4', '#10b981'] });
  };

  const handleSaveKey = (newKey: string) => {
    setGeminiKey(newKey);
    storage.saveGeminiKey(newKey);
    triggerToast(newKey.trim() ? 'Gemini AI Supermode key has been activated!' : 'Gemini Key removed. App is now in smart offline mode.');
  };

  const handleSavePersonality = (newPersonality: CoachPersonality) => {
    setCoachPersonality(newPersonality);
    storage.saveCoach(newPersonality);
    triggerToast(`AI Coach personality shifted to: ${newPersonality.toUpperCase()}.`);
  };

  // Core Log Action
  const handleLoggingSuccess = (response: CoachResponse) => {
    setStagedItems(response.items || []);
    setStagedWorkout(response.workout || null);
    setStagedLogType(response.type || 'food');
    setStagedCoaching(response.coachingMessage || '');
    setRefinementOpen(true);
  };

  const handleConfirmSave = (itemsToLog: Omit<FoodItem, 'id'>[], workoutToLog: Omit<WorkoutLog, 'id'> | null) => {
    let savedFood = false;
    let savedWorkout = false;

    // 1. Handle Food Items
    if (itemsToLog.length > 0) {
      // Detect meal slot type automatically based on local time
      const hour = new Date().getHours();
      let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'snack';
      if (hour >= 4 && hour < 11) {
        mealType = 'breakfast';
      } else if (hour >= 11 && hour < 16) {
        mealType = 'lunch';
      } else if (hour >= 17 && hour < 22) {
        mealType = 'dinner';
      }

      // Add unique IDs to food items
      const loggedItems: FoodItem[] = itemsToLog.map(item => ({
        ...item,
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      }));

      const newLogEntry: MealLog = {
        id: `meal_${Date.now()}`,
        timestamp: Date.now(),
        mealType,
        items: loggedItems
      };

      const updatedLogs = [newLogEntry, ...logs];
      setLogs(updatedLogs);
      storage.saveLogs(updatedLogs);

      const mealCals = loggedItems.reduce((sum, item) => sum + item.calories, 0);
      triggerToast(`Logged ${loggedItems.length} food item(s) successfully! (+${mealCals} kcal)`);
      savedFood = true;
    }

    // 2. Handle Workout
    if (workoutToLog) {
      const newWorkoutEntry: WorkoutLog = {
        ...workoutToLog,
        id: `workout_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: Date.now()
      };

      const updatedWorkouts = [newWorkoutEntry, ...workouts];
      setWorkouts(updatedWorkouts);
      storage.saveWorkouts(updatedWorkouts);

      triggerToast(`Workout logged successfully! (-${workoutToLog.caloriesBurned} kcal)`);
      savedWorkout = true;
    }

    // Celebration triggers
    if (savedFood || savedWorkout) {
      // Sum today's remaining calories to see if close to target budget
      const today = new Date();
      today.setHours(0,0,0,0);
      const startOfToday = today.getTime();
      
      const todayLogs = logs.filter(log => log.timestamp >= startOfToday);
      let consumed = itemsToLog.reduce((s, i) => s + i.calories, 0);
      todayLogs.forEach(log => {
        log.items.forEach(item => { consumed += item.calories; });
      });

      const todayWorkouts = workouts.filter(w => w.timestamp >= startOfToday);
      let activeBurn = workoutToLog ? workoutToLog.caloriesBurned : 0;
      todayWorkouts.forEach(w => { activeBurn += w.caloriesBurned; });

      const expandedGoal = (goals.calories || 2000) + activeBurn;

      if (consumed >= expandedGoal - 50 && consumed <= expandedGoal + 100) {
        setTimeout(() => {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        }, 500);
        triggerToast('🎯 Incredible! You hit your calorie target halo perfectly today!');
      } else {
        confetti({ particleCount: 60, spread: 40, origin: { y: 0.8 } });
      }
    }
  };

  const handleDeleteLogEntry = (id: string) => {
    const updatedLogs = logs.filter(log => log.id !== id);
    setLogs(updatedLogs);
    storage.saveLogs(updatedLogs);
    triggerToast('Log entry removed.');
  };

  const handleDeleteWorkoutEntry = (id: string) => {
    const updatedWorkouts = workouts.filter(w => w.id !== id);
    setWorkouts(updatedWorkouts);
    storage.saveWorkouts(updatedWorkouts);
    triggerToast('Workout entry removed.');
  };

  const handleImportJson = (jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (Array.isArray(parsed.logs) && parsed.goals) {
        storage.saveLogs(parsed.logs);
        storage.saveGoals(parsed.goals);
        if (parsed.workouts) {
          storage.saveWorkouts(parsed.workouts);
          setWorkouts(parsed.workouts);
        } else {
          storage.saveWorkouts([]);
          setWorkouts([]);
        }
        if (parsed.geminiKey) storage.saveGeminiKey(parsed.geminiKey);
        if (parsed.coachPersonality) storage.saveCoach(parsed.coachPersonality);
        if (parsed.appSettings) {
          storage.saveAppSettings(parsed.appSettings);
          setAppSettings(parsed.appSettings);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleClearData = () => {
    storage.clearAll();
    setLogs([]);
    setWorkouts([]);
    setGoals({ calories: 2000, protein: 130, carbs: 220, fat: 65, addedSugar: 30, fiber: 30, sodium: 2300 });
    setGeminiKey('');
    setCoachPersonality('encouraging');
    setAppSettings({
      theme: 'obsidian',
      visibleMacros: { protein: true, carbs: true, fat: true },
      visibleMicros: { addedSugar: true, fiber: true, sodium: true },
      visibleWidgets: { calorieHalo: true, macros: true, micros: true, workouts: true, mealSlots: true, goalCompletion: true }
    });
  };

  // Callback handler for AI customization actions
  const handleCustomizationSuccess = (
    updatedGoals: Partial<UserGoals>,
    updatedSettings: Partial<AppSettings>,
    message: string
  ) => {
    let newGoals = { ...goals };
    if (Object.keys(updatedGoals).length > 0) {
      newGoals = { ...goals, ...updatedGoals };
      setGoals(newGoals);
      storage.saveGoals(newGoals);
    }

    let newSettings = { ...appSettings };
    if (Object.keys(updatedSettings).length > 0) {
      newSettings = {
        ...appSettings,
        ...updatedSettings,
        visibleMacros: {
          ...appSettings.visibleMacros,
          ...(updatedSettings.visibleMacros || {})
        },
        visibleMicros: {
          ...appSettings.visibleMicros,
          ...(updatedSettings.visibleMicros || {})
        },
        visibleWidgets: {
          ...appSettings.visibleWidgets,
          ...(updatedSettings.visibleWidgets || {})
        }
      };
      if (updatedSettings.theme) {
        newSettings.theme = updatedSettings.theme;
      }
      setAppSettings(newSettings);
      storage.saveAppSettings(newSettings);
    }

    triggerToast(message);
    confetti({ particleCount: 80, spread: 50, origin: { y: 0.8 } });
  };

  const handleTriggerCustomize = (scope: 'general' | 'macronutrients' | 'micronutrients' | 'widgets') => {
    setCustomizerScope(scope);
    setCustomizerOpen(true);
  };

  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-display)'
      }}>
        <img 
          src="/favicon.png" 
          alt="HaloCal Logo" 
          className="loading-logo"
        />
        <span>Powering HaloCal...</span>
      </div>
    );
  }

  // Get raw serialization strings for backup downloads
  const backupJsonString = JSON.stringify({
    logs,
    workouts,
    goals,
    geminiKey,
    coachPersonality,
    appSettings
  });

  return (
    <div className="app-container">
      
      {/* 1. Header Layout & Navigation Tabs */}
      <header className="header">
        <div className="logo-container">
          <img 
            src="/favicon.png" 
            alt="HaloCal Logo" 
            className="header-logo"
          />
          <h1 className="logo-text">Halo<span>Cal</span></h1>
        </div>

        {/* Dynamic Navigation Board */}
        <nav className="nav-tabs">
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <Utensils size={16} />
            <span>Timeline</span>
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart2 size={16} />
            <span>Analytics</span>
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={16} />
            <span>Settings</span>
          </button>
        </nav>
      </header>

      {/* 2. Main Voice Action Console */}
      <section style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
        <VoiceInput 
          apiKey={geminiKey}
          personality={coachPersonality}
          onParsingSuccess={handleLoggingSuccess}
          onError={(msg) => triggerToast(msg)}
        />
      </section>

      {/* 3. Dynamic Tab Portals */}
      <main style={{ flex: 1, marginBottom: '3rem' }}>
        {activeTab === 'dashboard' && (
          <Dashboard 
            logs={logs} 
            workouts={workouts} 
            goals={goals} 
            appSettings={appSettings}
            onTriggerCustomize={handleTriggerCustomize}
          />
        )}
        
        {activeTab === 'timeline' && (
          <FoodTimeline 
            logs={logs} 
            workouts={workouts} 
            onDeleteLog={handleDeleteLogEntry} 
            onDeleteWorkout={handleDeleteWorkoutEntry} 
            goals={goals} 
          />
        )}
        
        {activeTab === 'analytics' && (
          <Analytics logs={logs} goals={goals} />
        )}
        
        {activeTab === 'settings' && (
          <Settings 
            apiKey={geminiKey}
            personality={coachPersonality}
            goals={goals}
            onSaveKey={handleSaveKey}
            onSavePersonality={handleSavePersonality}
            onSaveGoals={handleSaveGoals}
            onClearData={handleClearData}
            onImportData={handleImportJson}
            exportDataJson={backupJsonString}
          />
        )}
      </main>

      {/* 4. Interactive Staged Review Modal */}
      <RefinementModal 
        isOpen={refinementOpen}
        onClose={() => setRefinementOpen(false)}
        parsedItems={stagedItems}
        parsedWorkout={stagedWorkout}
        logType={stagedLogType}
        onSave={handleConfirmSave}
        coachingMessage={stagedCoaching}
        apiKey={geminiKey}
        personality={coachPersonality}
      />

      {/* 5. Sleek Toast Notification Banner */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast">
            <CheckCircle size={18} color="var(--accent-teal)" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* 5.5. AI Customizer Bottom Sheet Drawer */}
      <AiCustomizerDrawer
        isOpen={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        currentGoals={goals}
        currentSettings={appSettings}
        apiKey={geminiKey}
        scope={customizerScope}
        onCustomizationSuccess={handleCustomizationSuccess}
        onError={(msg) => triggerToast(msg)}
      />

      {/* 6. Footer Signature */}
      <footer style={{
        textAlign: 'center',
        padding: '1rem 0',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-display)',
        borderTop: '1px solid var(--border-glass)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem'
      }}>
        <span>HaloCal 🟡 Serverless & Private. Made with</span>
        <Heart size={10} color="var(--accent-rose)" fill="var(--accent-rose)" />
        <span>for healthier days.</span>
      </footer>

    </div>
  );
};
export default App;
