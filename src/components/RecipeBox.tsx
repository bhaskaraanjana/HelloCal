import React, { useState } from 'react';
import type { Recipe, RecipeIngredient } from '../types/nutrition';
import { gemini } from '../services/gemini';
import { 
  BookOpen, Plus, Trash2, Sparkles, Check, Loader2, 
  ChevronDown, ChevronUp, Play, AlertCircle, Mic, MicOff
} from 'lucide-react';
import confetti from 'canvas-confetti';

import { CustomModal } from './ui/CustomModal';

interface RecipeBoxProps {
  recipes: Recipe[];
  onSaveRecipes: (recipes: Recipe[]) => void;
  onLogRecipePortion: (recipe: Recipe, multiplier: number, portionName: string) => void;
  onTriggerToast: (msg: string) => void;
  apiKey: string;
}

export const RecipeBox: React.FC<RecipeBoxProps> = ({
  recipes,
  onSaveRecipes,
  onLogRecipePortion,
  onTriggerToast,
  apiKey
}) => {
  const [recipeToDelete, setRecipeToDelete] = useState<{ id: string, name: string } | null>(null);
  // Navigation & expansion states
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [portionRecipe, setPortionRecipe] = useState<Recipe | null>(null);
  const [portionMultiplier, setPortionMultiplier] = useState<number>(1);

  // AI & Parsing status indicators
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Form states for creating recipes
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('🥣');
  const [formServings, setFormServings] = useState<number>(4);
  const [formYieldUnit, setFormYieldUnit] = useState('serving');
  const [formIngredients, setFormIngredients] = useState<RecipeIngredient[]>([]);
  const [showMicros, setShowMicros] = useState(true);
  const [rowEstimatingIndex, setRowEstimatingIndex] = useState<number | null>(null);
  const lastAutoQueriesRef = React.useRef<Record<number, string>>({});



  // Full recipe description for text-to-recipe AI parsing
  const [recipeDescriptionInput, setRecipeDescriptionInput] = useState('');

  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = React.useRef<any>(null);
  const recipeStatus = isDictating ? 'recording' : isAiParsing ? 'processing' : 'idle';

  const handleToggleDictation = () => {
    if (isDictating) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsDictating(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onTriggerToast('🎙️ Speech Recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsDictating(true);
      onTriggerToast('🎙️ Listening... Dictate your recipe details now!');
    };

    recognition.onerror = (event: any) => {
      console.error(event);
      onTriggerToast('🎙️ Speech recognition error occurred.');
      setIsDictating(false);
    };

    recognition.onend = () => {
      setIsDictating(false);
    };

    recognition.onresult = (event: any) => {
      const results = event.results;
      const transcript = results[results.length - 1][0].transcript;
      setRecipeDescriptionInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Premium UI UX state expansions
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'high-protein' | 'low-carb' | 'low-calorie'>('all');
  const [cardPortions, setCardPortions] = useState<Record<string, number>>({});

  const adjustCardPortion = (recipeId: string, amount: number) => {
    const current = cardPortions[recipeId] ?? 1.0;
    const next = Math.max(0.1, Math.round((current + amount) * 10) / 10);
    setCardPortions(prev => ({
      ...prev,
      [recipeId]: next
    }));
  };

  const handleLogCardPortion = (recipe: Recipe) => {
    const qty = cardPortions[recipe.id] ?? 1.0;
    const ratio = qty / recipe.servings;
    onLogRecipePortion(recipe, ratio, `${qty} ${recipe.yieldUnit}(s) of ${recipe.name}`);
    confetti({
      particleCount: 80,
      spread: 50,
      colors: ['#8b5cf6', '#10b981', '#06b6d4'],
      origin: { y: 0.7 }
    });
  };

  const filteredRecipes: Recipe[] = recipes.filter((recipe: Recipe) => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.ingredients.some((ing: RecipeIngredient) => ing.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    const totalCals = recipe.ingredients.reduce((s: number, i: RecipeIngredient) => s + (i.calories || 0), 0);
    const totalProt = recipe.ingredients.reduce((s: number, i: RecipeIngredient) => s + (i.protein || 0), 0);
    const totalCarb = recipe.ingredients.reduce((s: number, i: RecipeIngredient) => s + (i.carbs || 0), 0);

    const servCals = totalCals / recipe.servings;
    const servProt = totalProt / recipe.servings;
    const servCarb = totalCarb / recipe.servings;

    if (activeFilter === 'high-protein') return servProt >= 15;
    if (activeFilter === 'low-carb') return servCarb <= 15;
    if (activeFilter === 'low-calorie') return servCals < 250;
    return true;
  });

  // Pre-selected emoji list for visual flavor
  const emojiDeck = ['🥣', '🧁', '🍲', '🍪', '🥧', '🥗', '🍛', '🍳', '🥤', '🥪', '🍞', '🍇', '🥞', '🍕'];

  const resetForm = () => {
    setFormName('');
    setFormIcon('🥣');
    setFormServings(4);
    setFormYieldUnit('serving');
    setFormIngredients([]);
    setShowMicros(true);
    setRecipeDescriptionInput('');
    setAiError(null);
  };

  // Add a blank ingredient row manually
  const handleAddIngredientRow = () => {
    const newIngredient: RecipeIngredient = {
      name: '',
      quantity: '100g',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sugar: 0,
      addedSugar: 0,
      fiber: 0,
      sodium: 0
    };
    setFormIngredients([...formIngredients, newIngredient]);
  };

  // Delete an ingredient row from editor and realign query cache
  const handleRemoveIngredientRow = (index: number) => {
    setFormIngredients(formIngredients.filter((_, i) => i !== index));
    // Realign lastAutoQueriesRef
    const newQueries: Record<number, string> = {};
    let newIdx = 0;
    formIngredients.forEach((_, i) => {
      if (i !== index) {
        newQueries[newIdx] = lastAutoQueriesRef.current[i] || '';
        newIdx++;
      }
    });
    lastAutoQueriesRef.current = newQueries;
  };

  // Auto search and estimate macro/micros for an ingredient row
  const autoEstimateIngredientRow = async (index: number) => {
    if (!apiKey) return; // Prevent calls without API key
    const ing = formIngredients[index];
    if (!ing) return;
    const name = ing.name.trim();
    const quantity = ing.quantity.trim();
    if (!name || !quantity) return;

    // To prevent duplicate queries, check if the query matches the last queried string
    const query = `${quantity} ${name}`;
    const lastQuery = lastAutoQueriesRef.current[index];
    if (query === lastQuery) return;
    lastAutoQueriesRef.current[index] = query;

    setRowEstimatingIndex(index);
    try {
      const description = `Recipe ingredient to estimate macros for: ${query}`;
      const parsed = await gemini.parseRecipeDescription(description, apiKey);
      if (parsed.ingredients && parsed.ingredients.length > 0) {
        const est = parsed.ingredients[0];
        setFormIngredients(prev => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = {
              ...updated[index],
              calories: est.calories || 0,
              protein: est.protein || 0,
              carbs: est.carbs || 0,
              fat: est.fat || 0,
              sugar: est.sugar || 0,
              addedSugar: est.addedSugar || 0,
              fiber: est.fiber || 0,
              sodium: est.sodium || 0
            };
          }
          return updated;
        });
        
        // Auto-enable showMicros if this has micros
        const hasMicros = (est.sugar && est.sugar > 0) || 
                          (est.addedSugar && est.addedSugar > 0) || 
                          (est.fiber && est.fiber > 0) || 
                          (est.sodium && est.sodium > 0);
        if (hasMicros) {
          setShowMicros(true);
        }

        onTriggerToast(`✨ Auto-estimated macros for "${name}"!`);
      }
    } catch (err) {
      console.error("Auto estimation error:", err);
    } finally {
      setRowEstimatingIndex(null);
    }
  };

  // Update specific fields of an ingredient row
  const handleUpdateIngredientField = (index: number, field: keyof RecipeIngredient, value: any) => {
    const updated = [...formIngredients];
    updated[index] = {
      ...updated[index],
      [field]: field === 'name' || field === 'quantity' ? value : Number(value) || 0
    };
    setFormIngredients(updated);
  };

  // Submit complete recipe
  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      onTriggerToast('Recipe Name is required.');
      return;
    }
    if (formIngredients.length === 0) {
      onTriggerToast('Please add at least one ingredient.');
      return;
    }

    const newRecipe: Recipe = {
      id: `recipe_${Date.now()}`,
      name: formName.trim(),
      icon: formIcon,
      servings: Math.max(1, formServings),
      yieldUnit: formYieldUnit.trim() || 'serving',
      ingredients: formIngredients
    };

    const updated = [newRecipe, ...recipes];
    onSaveRecipes(updated);
    onTriggerToast(`Recipe "${newRecipe.name}" saved to database!`);
    resetForm();
    setIsAddingNew(false);
  };

  // AI complete recipe parser
  const handleAiParseCompleteRecipe = async () => {
    const desc = recipeDescriptionInput.trim();
    if (!desc) {
      setAiError('Please enter a description or recipe text for the AI to parse.');
      return;
    }
    if (!apiKey) {
      setAiError('Gemini API Key is required. Please add it in Settings.');
      return;
    }

    setIsAiParsing(true);
    setAiError(null);

    try {
      const parsed = await gemini.parseRecipeDescription(desc, apiKey);
      setFormName(parsed.name || '');
      setFormServings(parsed.servings || 1);
      setFormYieldUnit(parsed.yieldUnit || 'serving');
      setFormIngredients(parsed.ingredients || []);
      
      // Auto-enable showMicros if any parsed ingredient has micro nutrients
      const hasMicros = parsed.ingredients?.some(ing => 
        (ing.sugar && ing.sugar > 0) ||
        (ing.addedSugar && ing.addedSugar > 0) ||
        (ing.fiber && ing.fiber > 0) ||
        (ing.sodium && ing.sodium > 0)
      );
      if (hasMicros) {
        setShowMicros(true);
      }

      // Auto-assign matching emoji if available
      const nameLower = parsed.name.toLowerCase();
      if (nameLower.includes('muffin') || nameLower.includes('cake') || nameLower.includes('cupcake')) setFormIcon('🧁');
      else if (nameLower.includes('granola') || nameLower.includes('oat')) setFormIcon('🥣');
      else if (nameLower.includes('soup') || nameLower.includes('stew')) setFormIcon('🍲');
      else if (nameLower.includes('cookie')) setFormIcon('🍪');
      else if (nameLower.includes('pie') || nameLower.includes('tart')) setFormIcon('🥧');
      else if (nameLower.includes('salad')) setFormIcon('🥗');
      else if (nameLower.includes('curry') || nameLower.includes('rice')) setFormIcon('🍛');
      else if (nameLower.includes('egg') || nameLower.includes('fry') || nameLower.includes('omelet')) setFormIcon('🍳');
      else if (nameLower.includes('smoothie') || nameLower.includes('shake') || nameLower.includes('drink')) setFormIcon('🥤');
      else if (nameLower.includes('sandwich') || nameLower.includes('burger')) setFormIcon('🥪');
      else if (nameLower.includes('bread') || nameLower.includes('toast')) setFormIcon('🍞');
      else if (nameLower.includes('pancake') || nameLower.includes('waffle')) setFormIcon('🥞');
      else setFormIcon('🥣');

      onTriggerToast('🪄 AI parsed and successfully populated the recipe form!');
    } catch (e: any) {
      console.error(e);
      setAiError(e.message || 'Failed to parse recipe. Please review your text or check API key.');
    } finally {
      setIsAiParsing(false);
    }
  };




  // Handle portion modal logging
  const handleConfirmPortionLog = () => {
    if (!portionRecipe) return;
    
    // portionMultiplier matches exact portion yield unit, e.g. 1.5 cups
    // relative ratio = portionMultiplier / total recipe servings
    // Wait, if portion unit is "cup" and total recipe is 10 cups, and they logged 1.5 cups:
    // portion ratio is 1.5 / 10 = 0.15 of the total batch!
    const ratio = portionMultiplier / portionRecipe.servings;
    const nameStr = `${portionMultiplier} ${portionRecipe.yieldUnit}(s) of ${portionRecipe.name}`;
    
    onLogRecipePortion(portionRecipe, ratio, nameStr);
    
    confetti({
      particleCount: 120,
      spread: 70,
      colors: ['#8b5cf6', '#10b981', '#06b6d4'],
      origin: { y: 0.6 }
    });

    setPortionRecipe(null);
  };

  const handleDeleteRecipe = (id: string, name: string) => {
    setRecipeToDelete({ id, name });
  };

  const confirmDeleteRecipe = () => {
    if (!recipeToDelete) return;
    const { id, name } = recipeToDelete;
    const updated = recipes.filter(r => r.id !== id);
    onSaveRecipes(updated);
    onTriggerToast(`Recipe "${name}" removed.`);
    setRecipeToDelete(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      
      {/* Recipe Delete Confirmation Custom Modal */}
      <CustomModal
        isOpen={!!recipeToDelete}
        onClose={() => setRecipeToDelete(null)}
        title="⚠️ Delete Recipe"
        size="sm"
        footer={
          <>
            <button 
              className="btn btn-secondary" 
              onClick={() => setRecipeToDelete(null)}
              style={{ fontSize: '0.82rem', padding: '0.45rem 1rem', borderRadius: '10px' }}
            >
              Cancel
            </button>
            <button 
              className="btn btn-danger" 
              onClick={confirmDeleteRecipe}
              style={{ fontSize: '0.82rem', padding: '0.45rem 1rem', borderRadius: '10px' }}
            >
              Confirm Delete
            </button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          Are you sure you want to permanently delete the recipe <strong>"{recipeToDelete?.name}"</strong> from your custom database?
        </p>
      </CustomModal>
      {isDictating && (
        <div className="gemini-aura-container" style={{ position: 'fixed', inset: 0, zIndex: -1 }}>
          <div className="gemini-blob gemini-blob-1" />
          <div className="gemini-blob gemini-blob-2" />
          <div className="gemini-blob gemini-blob-3" />
          <div className="gemini-blob gemini-blob-4" />
        </div>
      )}
      
      {/* 1. Header Navigation Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-glass)',
        paddingBottom: '1.25rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
          <button
          onClick={() => {
            if (isAddingNew) {
              resetForm();
              setIsAddingNew(false);
            } else {
              setIsAddingNew(true);
            }
          }}
          className="smooth-create-recipe-btn"
          style={{
            borderRadius: '12px',
            padding: '0.75rem 2.5rem',
            width: '100%',
            maxWidth: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            background: isAddingNew ? 'rgba(255, 255, 255, 0.05)' : 'var(--accent-purple)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            cursor: 'pointer',
            outline: 'none',
            outlineColor: 'transparent',
            WebkitTapHighlightColor: 'transparent',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: 'none',
            height: 'fit-content',
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          {isAddingNew ? (
            <span>Cancel Creator</span>
          ) : (
            <>
              <Plus size={15} strokeWidth={2.5} />
              <span>Create Recipe</span>
            </>
          )}
        </button>
      </div>

      {isAddingNew ? (
        /* REWORKED PREMIUM UNIFIED RECIPE WIZARD */
        <div className="smooth-slide-fade" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.5rem', 
          width: '100%',
          boxSizing: 'border-box'
        }}>
          

          <form onSubmit={handleSaveRecipe} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
            
            {/* 2a. Voice Dictation Panel */}
            <div style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '0px',
              padding: '0.25rem 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div>
                <h4 style={{
                  fontSize: '0.9rem',
                  fontWeight: 750,
                  color: 'var(--accent-purple)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontFamily: 'var(--font-display)',
                  margin: 0
                }}>
                  <Mic size={16} color="var(--accent-purple)" />
                  <span>🎙️ VOICE DICTATION WIZARD</span>
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.2rem', marginBottom: 0 }}>
                  Tap the microphone and speak your recipe ingredients, amounts, and yield. The AI will continuously transcribe in the box below!
                </p>
              </div>

              {/* Dynamic morphing console */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                padding: '1.25rem',
                borderRadius: '16px',
                border: '1px solid var(--border-glass)',
                background: recipeStatus === 'idle' ? 'rgba(255,255,255,0.005)' : 'transparent',
                position: 'relative',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {/* Guidelines Text (Stable Height Layered Container) */}
                <div style={{ position: 'relative', height: '56px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                  {/* Idle state guidelines */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: recipeStatus === 'idle' ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                    pointerEvents: recipeStatus === 'idle' ? 'auto' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                      TAP TO START DICTATING
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      Speak ingredients and yield clearly and watch AI construct the recipe.
                    </span>
                  </div>
                  
                  {/* Recording state guidelines */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: recipeStatus === 'recording' ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                    pointerEvents: recipeStatus === 'recording' ? 'auto' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      🔴 DICTATING RECIPE...
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      Listening... Speak your recipe details continuously.
                    </span>
                  </div>

                  {/* Processing state guidelines */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: recipeStatus === 'processing' ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                    pointerEvents: recipeStatus === 'processing' ? 'auto' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ color: 'var(--accent-purple)', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      ⚡ AI SCANNER ESTIMATING MACROS...
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      Gemini is compiling ingredient metrics and generating batch formulas...
                    </span>
                  </div>
                </div>

                {/* Dynamic Waveform Visualizer when recording (Smooth Slide Transition) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  height: recipeStatus === 'recording' ? '40px' : '0px',
                  opacity: recipeStatus === 'recording' ? 1 : 0,
                  overflow: 'hidden',
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  zIndex: 1,
                  width: '100%'
                }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => {
                    const animDuration = 0.5 + Math.random() * 0.7;
                    return (
                      <div 
                        key={bar}
                        style={{
                          width: '4px',
                          backgroundImage: 'linear-gradient(to top, var(--accent-purple), var(--accent-blue))',
                          borderRadius: '99px',
                          height: '100%',
                          animation: `wave ${animDuration}s ease-in-out infinite`,
                          boxShadow: '0 0 8px var(--accent-purple-glow)'
                        }}
                      />
                    );
                  })}
                </div>

                {/* Dictation mic button */}
                <button 
                  type="button"
                  onClick={handleToggleDictation}
                  disabled={recipeStatus === 'processing'}
                  title={recipeStatus === 'recording' ? "Stop Dictation" : "Voice Dictate Recipe"}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: recipeStatus === 'recording' ? 'var(--accent-rose)' : 'var(--accent-purple)',
                    border: 'none',
                    cursor: recipeStatus === 'processing' ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-primary)',
                    boxShadow: recipeStatus === 'recording' ? '0 0 30px var(--accent-rose-glow)' : '0 0 20px var(--accent-purple-glow)',
                    transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    position: 'relative',
                    zIndex: 1
                  }}
                >
                  {recipeStatus === 'recording' ? (
                    <MicOff size={32} />
                  ) : (
                    <Mic size={32} />
                  )}
                </button>
              </div>
            </div>

            {/* 2b. AI Text Import Panel */}
            <div style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '0px',
              padding: '0.25rem 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div>
                <h4 style={{
                  fontSize: '0.9rem',
                  fontWeight: 750,
                  color: 'var(--accent-teal)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontFamily: 'var(--font-display)',
                  margin: 0
                }}>
                  <Sparkles size={16} color="var(--accent-teal)" />
                  <span>✍️ AI TEXT IMPORT & ESTIMATOR</span>
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.2rem', marginBottom: 0 }}>
                  Paste standard ingredient lists, copy blogs, or write out ingredients. The AI will estimate macros, parse batch sizing, and construct the ingredient list instantly!
                </p>
              </div>

              <textarea
                value={recipeDescriptionInput}
                onChange={(e) => setRecipeDescriptionInput(e.target.value)}
                placeholder="e.g. 'I made a batch of keto snack mix. I mixed 2 cups almonds, 1 cup raw cashews, 3 tablespoons pumpkin seeds, and 50g unsweetened chocolate. It yields 8 servings.'"
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '0.75rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'var(--font-body)',
                  boxSizing: 'border-box'
                }}
              />

              {aiError && (
                <div style={{
                  fontSize: '0.8rem',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.1)'
                }}>
                  <AlertCircle size={14} />
                  <span>{aiError}</span>
                </div>
              )}

              {/* AI Parse button centered directly under the text box */}
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <button 
                  type="button"
                  disabled={isAiParsing || !recipeDescriptionInput.trim()}
                  onClick={handleAiParseCompleteRecipe}
                  title="Parse Recipe"
                  style={{
                    width: 'auto',
                    height: '44px',
                    borderRadius: '22px',
                    backgroundColor: 'var(--accent-teal)',
                    border: 'none',
                    cursor: (!recipeDescriptionInput.trim() || isAiParsing) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-primary)',
                    boxShadow: '0 0 15px var(--accent-teal-glow)',
                    transition: 'all 0.3s ease',
                    padding: '0 1.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    gap: '0.4rem',
                    whiteSpace: 'nowrap',
                    opacity: (!recipeDescriptionInput.trim() || isAiParsing) ? 0.4 : 1
                  }}
                >
                  {isAiParsing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Estimating Recipe...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>AI Parse Full Recipe</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 1. General Details Card */}
            <div style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '0px',
              padding: '0.25rem 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 750, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem', margin: 0 }}>
                📋 General Details
              </h4>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.25rem',
                width: '100%'
              }}>
                {/* Recipe Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Recipe Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. My Breakfast Granola"
                    required
                    style={{
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '10px',
                      padding: '0.65rem 0.85rem',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      width: '100%',
                      transition: 'var(--transition-smooth)'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-glass)'}
                  />
                </div>

                {/* Total yield size */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Batch Servings</label>
                    <input
                      type="number"
                      min={1}
                      value={formServings}
                      onChange={(e) => setFormServings(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '10px',
                        padding: '0.65rem 0.85rem',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                        width: '100%',
                        transition: 'var(--transition-smooth)'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-glass)'}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Yield Unit</label>
                    <input
                      type="text"
                      value={formYieldUnit}
                      onChange={(e) => setFormYieldUnit(e.target.value)}
                      placeholder="e.g. cup, slice"
                      style={{
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '10px',
                        padding: '0.65rem 0.85rem',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        width: '100%',
                        transition: 'var(--transition-smooth)'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-glass)'}
                    />
                  </div>
                </div>

                {/* Emoji Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Recipe Icon</label>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                      flexShrink: 0
                    }}>
                      {formIcon}
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      gap: '0.25rem',
                      overflowX: 'auto',
                      padding: '0.1rem 0.2rem',
                      flex: 1,
                      scrollbarWidth: 'none'
                    }} className="emoji-carousel">
                      {emojiDeck.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setFormIcon(emoji)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            opacity: formIcon === emoji ? 1 : 0.4,
                            transform: formIcon === emoji ? 'scale(1.15)' : 'scale(1)',
                            transition: 'all 0.2s',
                            padding: '0 0.15rem'
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Ingredients List Card */}
            <div style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '0px',
              padding: '0.25rem 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 750, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  🥗 Ingredients List ({formIngredients.length})
                </h4>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={12} />
                    <span>Add Ingredient</span>
                  </button>
                </div>
              </div>

              {/* Rows layout */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {formIngredients.length === 0 ? (
                    <div style={{
                      padding: '2rem 1rem',
                      textAlign: 'center',
                      border: '1px dashed var(--border-glass)',
                      borderRadius: '12px',
                      color: 'var(--text-muted)',
                      fontSize: '0.82rem'
                    }}>
                      No ingredients added yet. Add rows manually above, or use the AI bulk box below!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {formIngredients.map((ing, idx) => (
                        <div 
                          key={idx}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            background: 'rgba(255, 255, 255, 0.015)',
                            border: '1px solid var(--border-glass)',
                            padding: '0.85rem 1rem',
                            borderRadius: '14px',
                            transition: 'all 0.3s ease',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          {/* Row 1: Name, Quantity, Delete */}
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: '100%' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 2 }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>Ingredient Name</span>
                                {rowEstimatingIndex === idx && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--accent-purple)', textTransform: 'none', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>
                                    <Loader2 size={10} className="animate-spin" />
                                    <span>AI Estimating...</span>
                                  </span>
                                )}
                              </label>
                              <input
                                type="text"
                                value={ing.name}
                                onChange={(e) => handleUpdateIngredientField(idx, 'name', e.target.value)}
                                placeholder="e.g. Rolled Oats"
                                required
                                style={{
                                  background: 'rgba(255, 255, 255, 0.02)',
                                  border: '1px solid var(--border-glass)',
                                  borderRadius: '10px',
                                  padding: '0.55rem 0.75rem',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.85rem',
                                  outline: 'none',
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  transition: 'var(--transition-smooth)'
                                }}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--accent-purple)';
                                  e.currentTarget.style.boxShadow = '0 0 10px var(--accent-purple-glow)';
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--border-glass)';
                                  e.currentTarget.style.boxShadow = 'none';
                                  autoEstimateIngredientRow(idx);
                                }}
                              />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '85px' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</label>
                              <input
                                type="text"
                                value={ing.quantity}
                                onChange={(e) => handleUpdateIngredientField(idx, 'quantity', e.target.value)}
                                placeholder="e.g. 100g"
                                required
                                style={{
                                  background: 'rgba(255, 255, 255, 0.02)',
                                  border: '1px solid var(--border-glass)',
                                  borderRadius: '10px',
                                  padding: '0.55rem 0.75rem',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.85rem',
                                  outline: 'none',
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  textAlign: 'center',
                                  transition: 'var(--transition-smooth)'
                                }}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--accent-purple)';
                                  e.currentTarget.style.boxShadow = '0 0 10px var(--accent-purple-glow)';
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--border-glass)';
                                  e.currentTarget.style.boxShadow = 'none';
                                  autoEstimateIngredientRow(idx);
                                }}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientRow(idx)}
                              title="Remove Ingredient"
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                background: 'rgba(244, 63, 94, 0.06)',
                                border: '1px solid rgba(244, 63, 94, 0.15)',
                                color: 'var(--accent-rose)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: '1.2rem',
                                transition: 'all 0.2s',
                                flexShrink: 0
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = 'rgba(244, 63, 94, 0.15)';
                                e.currentTarget.style.borderColor = 'var(--accent-rose)';
                                e.currentTarget.style.boxShadow = '0 0 12px var(--accent-rose-glow)';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = 'rgba(244, 63, 94, 0.06)';
                                e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.15)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <Trash2 size={16} style={{ minWidth: '16px' }} />
                            </button>
                          </div>

                          {/* Row 2: Macros & Calories Wrap */}
                          <div style={{ 
                            display: 'flex', 
                            gap: '0.75rem', 
                            flexWrap: 'wrap',
                            background: 'rgba(0,0,0,0.15)',
                            padding: '0.6rem 0.85rem',
                            borderRadius: '10px',
                            alignItems: 'center',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}>
                            {/* Kcal */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '1 1 70px', minWidth: '65px' }}>
                              <span style={{ fontSize: '0.85rem' }} title="Calories">⚡</span>
                              <input
                                type="number"
                                value={ing.calories || ''}
                                placeholder="Kcal"
                                onChange={(e) => handleUpdateIngredientField(idx, 'calories', e.target.value)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  borderBottom: '2px solid var(--accent-teal)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.85rem',
                                  outline: 'none',
                                  width: '100%',
                                  textAlign: 'center',
                                  padding: '0.15rem 0'
                                }}
                              />
                            </div>

                            {/* Protein */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '1 1 70px', minWidth: '65px' }}>
                              <span style={{ fontSize: '0.85rem' }} title="Protein">🥩</span>
                              <input
                                type="number"
                                step="0.1"
                                value={ing.protein || ''}
                                placeholder="Prot"
                                onChange={(e) => handleUpdateIngredientField(idx, 'protein', e.target.value)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  borderBottom: '2px solid var(--accent-purple)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.85rem',
                                  outline: 'none',
                                  width: '100%',
                                  textAlign: 'center',
                                  padding: '0.15rem 0'
                                }}
                              />
                            </div>

                            {/* Carbs */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '1 1 70px', minWidth: '65px' }}>
                              <span style={{ fontSize: '0.85rem' }} title="Carbohydrates">🌾</span>
                              <input
                                type="number"
                                step="0.1"
                                value={ing.carbs || ''}
                                placeholder="Carb"
                                onChange={(e) => handleUpdateIngredientField(idx, 'carbs', e.target.value)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  borderBottom: '2px solid var(--accent-blue)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.85rem',
                                  outline: 'none',
                                  width: '100%',
                                  textAlign: 'center',
                                  padding: '0.15rem 0'
                                }}
                              />
                            </div>

                            {/* Fat */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '1 1 70px', minWidth: '65px' }}>
                              <span style={{ fontSize: '0.85rem' }} title="Fat">🥑</span>
                              <input
                                type="number"
                                step="0.1"
                                value={ing.fat || ''}
                                placeholder="Fat"
                                onChange={(e) => handleUpdateIngredientField(idx, 'fat', e.target.value)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  borderBottom: '2px solid var(--accent-amber)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.85rem',
                                  outline: 'none',
                                  width: '100%',
                                  textAlign: 'center',
                                  padding: '0.15rem 0'
                                }}
                              />
                            </div>

                            {/* Optional Micronutrients */}
                            {showMicros && (
                              <>
                                {/* Sugars */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '1 1 70px', minWidth: '65px' }}>
                                  <span style={{ fontSize: '0.85rem' }} title="Sugars">🍭</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={ing.sugar || ''}
                                    placeholder="Sugar"
                                    onChange={(e) => handleUpdateIngredientField(idx, 'sugar', e.target.value)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      borderBottom: '2px solid var(--accent-purple)',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.85rem',
                                      outline: 'none',
                                      width: '100%',
                                      textAlign: 'center',
                                      padding: '0.15rem 0'
                                    }}
                                  />
                                </div>

                                {/* Added Sugar */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '1 1 70px', minWidth: '65px' }}>
                                  <span style={{ fontSize: '0.85rem' }} title="Added Sugar">🍬</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={ing.addedSugar || ''}
                                    placeholder="Added"
                                    onChange={(e) => handleUpdateIngredientField(idx, 'addedSugar', e.target.value)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      borderBottom: '2px solid var(--accent-rose)',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.85rem',
                                      outline: 'none',
                                      width: '100%',
                                      textAlign: 'center',
                                      padding: '0.15rem 0'
                                    }}
                                  />
                                </div>

                                {/* Fiber */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '1 1 70px', minWidth: '65px' }}>
                                  <span style={{ fontSize: '0.85rem' }} title="Fiber">🌾</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={ing.fiber || ''}
                                    placeholder="Fiber"
                                    onChange={(e) => handleUpdateIngredientField(idx, 'fiber', e.target.value)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      borderBottom: '2px solid var(--accent-blue)',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.85rem',
                                      outline: 'none',
                                      width: '100%',
                                      textAlign: 'center',
                                      padding: '0.15rem 0'
                                    }}
                                  />
                                </div>

                                {/* Sodium */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '1 1 70px', minWidth: '65px' }}>
                                  <span style={{ fontSize: '0.85rem' }} title="Sodium">🧂</span>
                                  <input
                                    type="number"
                                    value={ing.sodium || ''}
                                    placeholder="Sod"
                                    onChange={(e) => handleUpdateIngredientField(idx, 'sodium', e.target.value)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      borderBottom: '2px solid var(--accent-amber)',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.85rem',
                                      outline: 'none',
                                      width: '100%',
                                      textAlign: 'center',
                                      padding: '0.15rem 0'
                                    }}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>


              </div>

            {/* 4. Calculations and submit action panel */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              marginTop: '0.5rem',
              background: 'transparent',
              border: 'none',
              borderRadius: '0px',
              padding: '0.25rem 0',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 750, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem', margin: 0 }}>
                📊 Recipe Calculations
              </h4>
              
              {formIngredients.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.5rem' }}>
                  Macro calculations will update here in real-time as soon as ingredients are added!
                </div>
              ) : (() => {
                const totalCals = formIngredients.reduce((s, i) => s + (i.calories || 0), 0);
                const totalProt = formIngredients.reduce((s, i) => s + (i.protein || 0), 0);
                const totalCarb = formIngredients.reduce((s, i) => s + (i.carbs || 0), 0);
                const totalFat = formIngredients.reduce((s, i) => s + (i.fat || 0), 0);
                const totalSugar = formIngredients.reduce((s, i) => s + (i.sugar || 0), 0);
                const totalAddedSugar = formIngredients.reduce((s, i) => s + (i.addedSugar || 0), 0);
                const totalFiber = formIngredients.reduce((s, i) => s + (i.fiber || 0), 0);
                const totalSodium = formIngredients.reduce((s, i) => s + (i.sodium || 0), 0);
                
                const servCals = Math.round(totalCals / formServings);
                const servProt = Math.round((totalProt / formServings) * 10) / 10;
                const servCarb = Math.round((totalCarb / formServings) * 10) / 10;
                const servFat = Math.round((totalFat / formServings) * 10) / 10;
                const servSugar = Math.round((totalSugar / formServings) * 10) / 10;
                const servAddedSugar = Math.round((totalAddedSugar / formServings) * 10) / 10;
                const servFiber = Math.round((totalFiber / formServings) * 10) / 10;
                const servSodium = Math.round(totalSodium / formServings);

                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem'
                  }}>
                    
                    {/* Full batch details */}
                    <div style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border-glass)'
                    }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 750, textTransform: 'uppercase' }}>Full Batch Totals</span>
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 650 }}>{totalCals} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>kcal</span></span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--accent-purple)', fontWeight: 600 }}>P: {Math.round(totalProt)}g</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--accent-blue)', fontWeight: 600 }}>C: {Math.round(totalCarb)}g</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--accent-amber)', fontWeight: 600 }}>F: {Math.round(totalFat)}g</span>
                        {showMicros && (
                          <>
                            <span style={{ fontSize: '0.9rem', color: 'var(--accent-purple)', fontWeight: 600, opacity: 0.85 }}>Sugar: {Math.round(totalSugar)}g</span>
                            <span style={{ fontSize: '0.9rem', color: 'var(--accent-rose)', fontWeight: 600, opacity: 0.85 }}>Added: {Math.round(totalAddedSugar)}g</span>
                            <span style={{ fontSize: '0.9rem', color: 'var(--accent-blue)', fontWeight: 600, opacity: 0.85 }}>Fiber: {Math.round(totalFiber)}g</span>
                            <span style={{ fontSize: '0.9rem', color: 'var(--accent-amber)', fontWeight: 600, opacity: 0.85 }}>Sod: {Math.round(totalSodium)}mg</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Per serving details */}
                    <div style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      background: 'rgba(139, 92, 246, 0.02)',
                      border: '1px solid var(--accent-purple-glow)'
                    }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-purple)', fontWeight: 750, textTransform: 'uppercase' }}>Per Serving ({formServings} {formYieldUnit}(s))</span>
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 750 }}>{servCals} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>kcal</span></span>
                        <span style={{ fontSize: '0.95rem', color: 'var(--accent-purple)', fontWeight: 700 }}>P: {servProt}g</span>
                        <span style={{ fontSize: '0.95rem', color: 'var(--accent-blue)', fontWeight: 700 }}>C: {servCarb}g</span>
                        <span style={{ fontSize: '0.95rem', color: 'var(--accent-amber)', fontWeight: 700 }}>F: {servFat}g</span>
                        {showMicros && (
                          <>
                            <span style={{ fontSize: '0.95rem', color: 'var(--accent-purple)', fontWeight: 700, opacity: 0.9 }}>Sugar: {servSugar}g</span>
                            <span style={{ fontSize: '0.95rem', color: 'var(--accent-rose)', fontWeight: 700, opacity: 0.9 }}>Added: {servAddedSugar}g</span>
                            <span style={{ fontSize: '0.95rem', color: 'var(--accent-blue)', fontWeight: 700, opacity: 0.9 }}>Fiber: {servFiber}g</span>
                            <span style={{ fontSize: '0.95rem', color: 'var(--accent-amber)', fontWeight: 700, opacity: 0.9 }}>Sod: {servSodium}mg</span>
                          </>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsAddingNew(false);
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={!formName.trim() || formIngredients.length === 0}
                  className="btn btn-primary"
                  style={{
                    padding: '0.75rem 2rem',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: (!formName.trim() || formIngredients.length === 0) ? 'not-allowed' : 'pointer',
                    opacity: (!formName.trim() || formIngredients.length === 0) ? 0.4 : 1,
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <Check size={18} />
                  <span>Save to Database</span>
                </button>
              </div>

            </div>

          </form>

        </div>

      ) : (
        
        /* DATABASE VIEW */
        <div className="smooth-slide-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {recipes.length === 0 ? (
            <div className="glass-card" style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              color: 'var(--text-secondary)'
            }}>
              <BookOpen size={48} style={{ opacity: 0.2, marginBottom: '1rem', color: 'var(--accent-purple)' }} />
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--text-primary)' }}>No Saved Recipes</h3>
              <p style={{ fontSize: '0.85rem', maxWidth: '350px', margin: '0.5rem auto 1.5rem auto' }}>
                Create your first batch recipe or restore defaults by clearing data! You can easily log customized cups, grams, or servings afterwards.
              </p>
              <button 
                onClick={() => setIsAddingNew(true)} 
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.5rem', borderRadius: '10px', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Create Recipe Now
              </button>
            </div>
          ) : (
            <>
              {/* Search and Category filters */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                borderRadius: '16px',
                padding: '1.25rem',
                backdropFilter: 'blur(10px)'
              }}>
                {/* Search Input */}
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Search recipes by name or ingredient..."
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '12px',
                      padding: '0.75rem 1rem',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      outline: 'none',
                      fontFamily: 'var(--font-body)'
                    }}
                  />
                </div>

                {/* Category pills */}
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 650, marginRight: '0.25rem' }}>
                    Filter:
                  </span>
                  {[
                    { id: 'all', label: '🌍 All Recipes' },
                    { id: 'high-protein', label: '💪 High Protein (≥15g)' },
                    { id: 'low-carb', label: '🥗 Low Carb (≤15g)' },
                    { id: 'low-calorie', label: '🔥 Low Calorie (<250 kcal)' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id as any)}
                      style={{
                        background: activeFilter === tab.id ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.4rem 0.85rem',
                        borderRadius: '99px',
                        cursor: 'pointer',
                        transition: 'var(--transition-smooth)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* GRID OF CARDS */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.25rem',
                marginTop: '0.5rem'
              }}>
                {filteredRecipes.length === 0 ? (
                  <div className="glass-card" style={{
                    textAlign: 'center',
                    padding: '3rem 1.5rem',
                    color: 'var(--text-secondary)',
                    width: '100%',
                    gridColumn: '1 / -1'
                  }}>
                    <AlertCircle size={32} style={{ opacity: 0.3, marginBottom: '0.75rem', color: 'var(--accent-purple)' }} strokeWidth={1.5} />
                    <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--text-primary)' }}>No Matching Recipes</h4>
                    <p style={{ fontSize: '0.8rem', maxWidth: '300px', margin: '0.25rem auto 0 auto' }}>
                      No recipes found matching "{searchQuery}" under the selected filter. Try adjusting your query or category filter.
                    </p>
                  </div>
                ) : (
                  filteredRecipes.map((recipe: Recipe) => {
                    const isExpanded = expandedRecipeId === recipe.id;
                    
                    // Total recipe batch macros
                    const totalCals = recipe.ingredients.reduce((s: number, i: RecipeIngredient) => s + (i.calories || 0), 0);
                    const totalProt = recipe.ingredients.reduce((s: number, i: RecipeIngredient) => s + (i.protein || 0), 0);
                    const totalCarb = recipe.ingredients.reduce((s: number, i: RecipeIngredient) => s + (i.carbs || 0), 0);
                    const totalFat = recipe.ingredients.reduce((s: number, i: RecipeIngredient) => s + (i.fat || 0), 0);
                    const totalSugar = recipe.ingredients.reduce((s: number, i: RecipeIngredient) => s + (i.sugar || 0), 0);
                    const totalAddedSugar = recipe.ingredients.reduce((s: number, i: RecipeIngredient) => s + (i.addedSugar || 0), 0);
                    const totalFiber = recipe.ingredients.reduce((s: number, i: RecipeIngredient) => s + (i.fiber || 0), 0);
                    const totalSodium = recipe.ingredients.reduce((s: number, i: RecipeIngredient) => s + (i.sodium || 0), 0);

                    // Per serving calculations
                    const servCals = Math.round(totalCals / recipe.servings);
                    const servProt = Math.round((totalProt / recipe.servings) * 10) / 10;
                    const servCarb = Math.round((totalCarb / recipe.servings) * 10) / 10;
                    const servFat = Math.round((totalFat / recipe.servings) * 10) / 10;
                    const servSugar = Math.round((totalSugar / recipe.servings) * 10) / 10;
                    const servAddedSugar = Math.round((totalAddedSugar / recipe.servings) * 10) / 10;
                    const servFiber = Math.round((totalFiber / recipe.servings) * 10) / 10;
                    const servSodium = Math.round(totalSodium / recipe.servings);

                    return (
                      <div 
                        key={recipe.id}
                        className="glass-card recipe-box-card"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                          padding: '1.5rem',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        
                        {/* Top title area */}
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '12px',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--border-glass)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.4rem'
                            }}>
                              {recipe.icon || '🥣'}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <h4 style={{
                                fontSize: '1rem',
                                fontWeight: 700,
                                fontFamily: 'var(--font-display)',
                                color: 'var(--text-primary)'
                              }}>
                                {recipe.name}
                              </h4>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Yield: {recipe.servings} {recipe.yieldUnit}(s)
                              </span>
                            </div>
                          </div>

                          {/* Remove button */}
                          <button
                            onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '0.2rem',
                              height: 'fit-content'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-rose)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* Per serving stats dashboard */}
                        <div style={{
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '12px',
                          padding: '0.75rem 1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem'
                        }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            Per Serving Value
                          </span>
                          
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            textAlign: 'center',
                            marginTop: '0.15rem'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text-primary)' }}>{servCals}</span>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kcal</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-glass)' }}>
                              <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-purple)' }}>{servProt}g</span>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prot</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-glass)' }}>
                              <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-blue)' }}>{servCarb}g</span>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Carb</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-glass)' }}>
                              <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-amber)' }}>{servFat}g</span>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fat</span>
                            </div>
                          </div>

                          {/* Relative Macro Distribution Split Bar */}
                          {(() => {
                            const totalMacros = servProt + servCarb + servFat;
                            const pctProt = totalMacros > 0 ? (servProt / totalMacros) * 100 : 0;
                            const pctCarb = totalMacros > 0 ? (servCarb / totalMacros) * 100 : 0;
                            const pctFat = totalMacros > 0 ? (servFat / totalMacros) * 100 : 0;

                            return totalMacros > 0 ? (
                              <div style={{
                                display: 'flex',
                                height: '6px',
                                borderRadius: '99px',
                                overflow: 'hidden',
                                background: 'rgba(255, 255, 255, 0.05)',
                                marginTop: '0.6rem',
                                width: '100%'
                              }}>
                                {pctProt > 0 && (
                                  <div style={{
                                    width: `${pctProt}%`,
                                    backgroundColor: 'var(--accent-purple)',
                                    boxShadow: '0 0 6px var(--accent-purple-glow)'
                                  }} title={`Protein: ${Math.round(pctProt)}%`} />
                                )}
                                {pctCarb > 0 && (
                                  <div style={{
                                    width: `${pctCarb}%`,
                                    backgroundColor: 'var(--accent-blue)',
                                    boxShadow: '0 0 6px var(--accent-blue-glow)'
                                  }} title={`Carbs: ${Math.round(pctCarb)}%`} />
                                )}
                                {pctFat > 0 && (
                                  <div style={{
                                    width: `${pctFat}%`,
                                    backgroundColor: 'var(--accent-amber)',
                                    boxShadow: '0 0 6px var(--accent-amber-glow)'
                                  }} title={`Fat: ${Math.round(pctFat)}%`} />
                                )}
                              </div>
                            ) : null;
                          })()}

                          {/* Optional Micronutrients row */}
                          {(() => {
                            const hasMicros = servSugar > 0 || servAddedSugar > 0 || servFiber > 0 || servSodium > 0;
                            return hasMicros ? (
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.5rem',
                                justifyContent: 'space-between',
                                borderTop: '1px solid rgba(255, 255, 255, 0.03)',
                                paddingTop: '0.45rem',
                                marginTop: '0.4rem',
                                fontSize: '0.72rem',
                                color: 'var(--text-secondary)'
                              }}>
                                {servSugar > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>🍭 <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{servSugar}g</span> Sug</span>}
                                {servAddedSugar > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>🍬 <span style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>{servAddedSugar}g</span> Add</span>}
                                {servFiber > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>🌾 <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{servFiber}g</span> Fib</span>}
                                {servSodium > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>🧂 <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{servSodium}mg</span> Sod</span>}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        {/* Frictionless Inline Card Portion selector and fast logging */}
                        {(() => {
                          const portion = cardPortions[recipe.id] ?? 1.0;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.2rem' }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid var(--border-glass)',
                                borderRadius: '10px',
                                padding: '0.35rem 0.6rem'
                              }}>
                                <button
                                  type="button"
                                  onClick={() => adjustCardPortion(recipe.id, -0.1)}
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid var(--border-glass)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'var(--transition-smooth)'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                                >
                                  -
                                </button>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '80px', textAlign: 'center' }}>
                                  {portion.toFixed(1)} {recipe.yieldUnit}(s)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => adjustCardPortion(recipe.id, 0.1)}
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid var(--border-glass)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'var(--transition-smooth)'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                                >
                                  +
                                </button>
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => handleLogCardPortion(recipe)}
                                className="btn btn-primary"
                                style={{
                                  borderRadius: '10px',
                                  padding: '0.55rem',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.4rem',
                                  cursor: 'pointer',
                                  width: '100%',
                                  transition: 'var(--transition-smooth)'
                                }}
                              >
                                <Play size={12} fill="#fff" />
                                <span>Log {portion.toFixed(1)} {recipe.yieldUnit}(s)</span>
                              </button>
                            </div>
                          );
                        })()}

                        {/* Ingredients list drawer toggler */}
                        <div style={{ borderTop: '1px dashed var(--border-glass)', paddingTop: '0.65rem', marginTop: '0.2rem' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedRecipeId(isExpanded ? null : recipe.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            <span>{isExpanded ? 'Hide Ingredients' : 'View Ingredients'}</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>

                          {isExpanded && (
                            <div style={{
                              marginTop: '0.5rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.3rem',
                              background: 'rgba(255,255,255,0.005)',
                              borderRadius: '8px',
                              padding: '0.5rem 0.75rem',
                              border: '1px solid var(--border-glass)'
                            }}>
                               {recipe.ingredients.map((ing: RecipeIngredient, idx: number) => {
                                  const hasMicros = ing.sugar || ing.addedSugar || ing.fiber || ing.sodium;
                                  return (
                                    <div key={idx} style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.15rem',
                                      padding: '0.35rem 0',
                                      borderBottom: idx < recipe.ingredients.length - 1 ? '1px dashed rgba(255,255,255,0.03)' : 'none'
                                    }}>
                                      <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '0.78rem',
                                        color: 'var(--text-secondary)'
                                      }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ing.name}</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{ing.quantity}</span>
                                      </div>
                                      <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '0.4rem',
                                        fontSize: '0.68rem',
                                        color: 'var(--text-muted)'
                                      }}>
                                        <span>⚡ {ing.calories} kcal</span>
                                        <span style={{ color: 'var(--accent-purple)' }}>P: {ing.protein}g</span>
                                        <span style={{ color: 'var(--accent-blue)' }}>C: {ing.carbs}g</span>
                                        <span style={{ color: 'var(--accent-amber)' }}>F: {ing.fat}g</span>
                                        {hasMicros ? (
                                          <>
                                            {ing.sugar ? <span style={{ opacity: 0.8 }}>🍭 {ing.sugar}g</span> : null}
                                            {ing.addedSugar ? <span style={{ color: 'var(--accent-rose)', opacity: 0.8 }}>🍬 {ing.addedSugar}g</span> : null}
                                            {ing.fiber ? <span style={{ color: 'var(--accent-blue)', opacity: 0.8 }}>🌾 {ing.fiber}g</span> : null}
                                            {ing.sodium ? <span style={{ color: 'var(--accent-amber)', opacity: 0.8 }}>🧂 {ing.sodium}mg</span> : null}
                                          </>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

        </div>
      )}

      {/* 3. Sliding Custom Portion Logging Slider Popup Overlay */}
      {portionRecipe && (() => {
        // Compute per single unit macros
        const totalCals = portionRecipe.ingredients.reduce((s, i) => s + (i.calories || 0), 0);
        const totalProt = portionRecipe.ingredients.reduce((s, i) => s + (i.protein || 0), 0);
        const totalCarb = portionRecipe.ingredients.reduce((s, i) => s + (i.carbs || 0), 0);
        const totalFat = portionRecipe.ingredients.reduce((s, i) => s + (i.fat || 0), 0);
        
        // Single unit is total batch / total servings count
        const unitRatio = 1 / portionRecipe.servings;
        const singleCals = totalCals * unitRatio;
        const singleProt = totalProt * unitRatio;
        const singleCarb = totalCarb * unitRatio;
        const singleFat = totalFat * unitRatio;

        // Current selection totals
        const selCals = Math.round(singleCals * portionMultiplier);
        const selProt = Math.round(singleProt * portionMultiplier * 10) / 10;
        const selCarb = Math.round(singleCarb * portionMultiplier * 10) / 10;
        const selFat = Math.round(singleFat * portionMultiplier * 10) / 10;

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(6, 6, 9, 0.75)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }} onClick={() => setPortionRecipe(null)}>
            
            <div 
              className="glass-card"
              style={{
                width: '100%',
                maxWidth: '420px',
                padding: '2rem',
                border: '1px solid var(--accent-purple-glow)',
                boxShadow: '0 20px 50px rgba(139, 92, 246, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                animation: 'scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Title info */}
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '2rem' }}>{portionRecipe.icon || '🥣'}</span>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)',
                  marginTop: '0.4rem'
                }}>
                  Custom Portion Logger
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
                  Choose what fraction of **{portionRecipe.name}** you consumed.
                </p>
              </div>

              {/* Portion slider selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{
                  fontSize: '2rem',
                  fontWeight: 850,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent-purple)',
                  textShadow: '0 0 10px var(--accent-purple-glow)'
                }}>
                  {portionMultiplier} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{portionRecipe.yieldUnit}(s)</span>
                </span>

                <input
                  type="range"
                  min={0.1}
                  max={5.0}
                  step={0.1}
                  value={portionMultiplier}
                  onChange={(e) => setPortionMultiplier(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '99px',
                    outline: 'none',
                    accentColor: 'var(--accent-purple)',
                    background: 'rgba(255,255,255,0.06)',
                    cursor: 'pointer'
                  }}
                />

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600
                }}>
                  <span>0.1 {portionRecipe.yieldUnit}</span>
                  <span>1.0 {portionRecipe.yieldUnit}</span>
                  <span>2.5 {portionRecipe.yieldUnit}</span>
                  <span>5.0 {portionRecipe.yieldUnit}</span>
                </div>
              </div>

              {/* Dynamic macros calculated in real time */}
              <div style={{
                background: 'rgba(139, 92, 246, 0.03)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: '14px',
                padding: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                textAlign: 'center'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 850, color: 'var(--text-primary)' }}>{selCals}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Kcal</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-glass)' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-purple)' }}>{selProt}g</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Prot</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-glass)' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-blue)' }}>{selCarb}g</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Carb</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-glass)' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-amber)' }}>{selFat}g</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fat</span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setPortionRecipe(null)}
                  className="btn btn-secondary"
                  style={{ borderRadius: '12px', padding: '0.7rem 0', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPortionLog}
                  className="btn btn-primary"
                  style={{
                    borderRadius: '12px',
                    padding: '0.7rem 0',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Play size={12} fill="#fff" />
                  <span>Log Portion</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Embedded animations styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scaleUp {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes smoothSlideFade {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .smooth-slide-fade {
          animation: smoothSlideFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .smooth-create-recipe-btn {
          -webkit-tap-highlight-color: transparent !important;
          outline: none !important;
        }
        .smooth-create-recipe-btn:hover {
          transform: translateY(-1px);
          box-shadow: none !important;
          filter: brightness(1.1);
        }
        .smooth-create-recipe-btn:active {
          transform: translateY(0.5px);
          box-shadow: none !important;
          outline: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        .smooth-create-recipe-btn:focus,
        .smooth-create-recipe-btn:focus-visible {
          outline: none !important;
          outline-color: transparent !important;
          box-shadow: none !important;
          border: 1px solid var(--border-glass) !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        .recipe-box-card {
          transition: var(--transition-smooth);
        }
        .recipe-box-card:hover {
          border-color: var(--accent-purple) !important;
          box-shadow: 0 12px 35px var(--accent-purple-glow) !important;
          transform: translateY(-2px);
        }
        .emoji-carousel::-webkit-scrollbar {
          display: none;
        }
        .ingredients-grid-headers {
          border-bottom: 1px solid var(--border-glass);
          padding-bottom: 0.35rem !important;
          margin-bottom: 0.25rem;
        }
      `}} />

    </div>
  );
};
export default RecipeBox;
