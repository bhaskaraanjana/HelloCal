import React, { useState, useEffect } from 'react';
import type { MealLog, FoodItem, UserGoals, CoachPersonality, CoachResponse } from './types/nutrition';
import { storage } from './services/storage';
import { Dashboard } from './components/Dashboard';
import { VoiceInput } from './components/VoiceInput';
import { FoodTimeline } from './components/FoodTimeline';
import { Analytics } from './components/Analytics';
import { Settings } from './components/Settings';
import { RefinementModal } from './components/RefinementModal';
import { Utensils, LayoutDashboard, BarChart2, Settings as SettingsIcon, Heart, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export const App: React.FC = () => {
  // 1. Core States loaded from localStorage on mount
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [goals, setGoals] = useState<UserGoals>({ calories: 2000, protein: 130, carbs: 220, fat: 65 });
  const [geminiKey, setGeminiKey] = useState('');
  const [coachPersonality, setCoachPersonality] = useState<CoachPersonality>('encouraging');

  // Loading indicator on first mount
  const [isLoaded, setIsLoaded] = useState(false);

  // Tab View
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'analytics' | 'settings'>('dashboard');

  // Refinement modal states
  const [refinementOpen, setRefinementOpen] = useState(false);
  const [stagedItems, setStagedItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [stagedCoaching, setStagedCoaching] = useState('');

  // Floating notifications/toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize
  useEffect(() => {
    const data = storage.getData();
    setLogs(data.logs);
    setGoals(data.goals);
    setGeminiKey(data.geminiKey);
    setCoachPersonality(data.coachPersonality);
    setIsLoaded(true);
  }, []);

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
    setStagedItems(response.items);
    setStagedCoaching(response.coachingMessage);
    setRefinementOpen(true);
  };

  const handleConfirmSaveMeal = (itemsToLog: Omit<FoodItem, 'id'>[]) => {
    if (itemsToLog.length === 0) return;

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

    // Dynamic celebration triggers
    const mealCals = loggedItems.reduce((sum, item) => sum + item.calories, 0);
    
    // Check if daily goal is reached
    const today = new Date();
    today.setHours(0,0,0,0);
    const startOfToday = today.getTime();
    const todayLogs = updatedLogs.filter(log => log.timestamp >= startOfToday);
    const totalTodayCals = todayLogs.reduce((sum, log) => sum + log.items.reduce((s, i) => s + i.calories, 0), 0);

    triggerToast(`Logged ${loggedItems.length} food item(s) successfully! (+${mealCals} kcal)`);

    if (totalTodayCals >= goals.calories - 50 && totalTodayCals <= goals.calories + 100) {
      // Near perfect goal matching celebration!
      setTimeout(() => {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }, 500);
      triggerToast('🎯 Incredible! You hit your calorie target halo perfectly today!');
    } else {
      // Small celebratory burst
      confetti({ particleCount: 50, spread: 30, origin: { y: 0.8 } });
    }
  };

  const handleDeleteLogEntry = (id: string) => {
    const updatedLogs = logs.filter(log => log.id !== id);
    setLogs(updatedLogs);
    storage.saveLogs(updatedLogs);
    triggerToast('Log entry removed.');
  };

  const handleImportJson = (jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (Array.isArray(parsed.logs) && parsed.goals) {
        storage.saveLogs(parsed.logs);
        storage.saveGoals(parsed.goals);
        if (parsed.geminiKey) storage.saveGeminiKey(parsed.geminiKey);
        if (parsed.coachPersonality) storage.saveCoach(parsed.coachPersonality);
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
    setGoals({ calories: 2000, protein: 130, carbs: 220, fat: 65 });
    setGeminiKey('');
    setCoachPersonality('encouraging');
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
    goals,
    geminiKey,
    coachPersonality
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
          <Dashboard logs={logs} goals={goals} />
        )}
        
        {activeTab === 'timeline' && (
          <FoodTimeline logs={logs} onDeleteLog={handleDeleteLogEntry} goals={goals} />
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
        onSave={handleConfirmSaveMeal}
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
