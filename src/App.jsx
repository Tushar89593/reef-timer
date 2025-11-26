import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, Pause, RotateCcw, CheckCircle2, Settings, X, 
  Plus, Trash2, Save, User as UserIcon, LogIn, LogOut, Mail, ArrowRight,
  Palette, Shuffle, Sprout
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
let firebaseConfig;
let appId = 'default-app-id';

// Check if running in the online preview environment
if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
  appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
} else {
  //  FOR LOCAL USE: REPLACE THIS OBJECT WITH YOUR REAL CONFIG
  firebaseConfig = {
    apiKey: "AIzaSyAEUk6q5PekrfhNx76nqrzVFboqKYofnnw",
    authDomain: "reeftimer.firebaseapp.com",
    projectId: "reeftimer",
    storageBucket: "reeftimer.firebasestorage.app",
    messagingSenderId: "451135568546",
    appId: "1:451135568546:web:040fb6e23bddaf5449f5fb",
    measurementId: "G-9NRGSC1DBV"

  };
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CORAL DEFINITIONS ---
const CORAL_TYPES = [
  { id: 'staghorn', name: 'Staghorn', color: '#ec4899', description: 'Classic branching beauty' },
  { id: 'fan', name: 'Sea Fan', color: '#8b5cf6', description: 'Wide, elegant lattice' },
  { id: 'brain', name: 'Brain Coral', color: '#06b6d4', description: 'Dense, textured dome' }
];

const ReefFocus = () => {
  // --- Timer State ---
  const [duration, setDuration] = useState(25 * 60); 
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  // --- Coral Logic ---
  const [selectedCoralId, setSelectedCoralId] = useState('random'); // 'random' | 'staghorn' | 'fan' | 'brain'
  const [activeSessionCoral, setActiveSessionCoral] = useState('staghorn'); // The one actually showing
  const [showCoralSelector, setShowCoralSelector] = useState(false);

  // --- UI State ---
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // --- Data & Auth State ---
  const [user, setUser] = useState(null);
  const [savedTimers, setSavedTimers] = useState([]);
  const [customInput, setCustomInput] = useState('');

  // --- Login Form State ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // --- AdSense Configuration ---
  const ADSENSE_PUBLISHER_ID = "ca-pub-5370113062591091"; // Replace with your Publisher ID
  const ADSENSE_SLOT_ID = "5370113062591091"; 

  // 1. Initial Auth Check
  useEffect(() => {
    const initAuth = async () => {
      // Prioritize custom token from environment if available
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else if (!auth.currentUser) {
         await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        // Fallback for local dev if user logs out
        // signInAnonymously(auth).catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Sync Saved Timers
  useEffect(() => {
    if (!user) { setSavedTimers([]); return; }
    // Ensure we have a valid appId before querying
    const currentAppId = appId || 'default-app-id';
    const timersRef = collection(db, 'artifacts', currentAppId, 'users', user.uid, 'timers');
    const unsubscribe = onSnapshot(timersRef, (snapshot) => {
      const timers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedTimers(timers.sort((a, b) => a.minutes - b.minutes));
    }, (error) => console.error("Error fetching timers:", error));
    return () => unsubscribe();
  }, [user]);

  // 3. AdSense Injection
  useEffect(() => {
    if (ADSENSE_PUBLISHER_ID === "ca-pub-5370113062591091") return;
    if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
      const script = document.createElement('script');
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${5370113062591091}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
    try {
      setTimeout(() => {
        if (typeof window !== 'undefined') (window.adsbygoogle = window.adsbygoogle || []).push({});
      }, 1000);
    } catch (e) { console.error("AdSense init error:", e); }
  }, []);

  // --- Timer Logic ---
  const progress = useMemo(() => 1 - (timeLeft / duration), [timeLeft, duration]);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      setIsFinished(true);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- START LOGIC (Randomization) ---
  const handleStart = () => {
    if (timeLeft === 0) resetTimer();
    
    // If starting fresh (not pausing/resuming), pick the coral
    if (!isActive && timeLeft === duration) {
      if (selectedCoralId === 'random') {
        // Pick a random one for this session
        const randomIndex = Math.floor(Math.random() * CORAL_TYPES.length);
        setActiveSessionCoral(CORAL_TYPES[randomIndex].id);
      } else {
        setActiveSessionCoral(selectedCoralId);
      }
    }
    
    setIsActive(!isActive);
    setIsFinished(false);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(duration);
    setIsFinished(false);
  };

  const updateDuration = (mins) => {
    const newSeconds = mins * 60;
    setDuration(newSeconds);
    setTimeLeft(newSeconds);
    setIsActive(false);
    setIsFinished(false);
    setShowSettings(false);
  };

  // --- RENDER CORAL VARIANTS ---
  const renderCoral = (type, progress, isFinished) => {
    switch (type) {
      case 'fan':
        return (
          <g transform="translate(100, 180)">
            <path d="M0,0 L0,-40" stroke="#4c1d95" strokeWidth="6" fill="none" strokeLinecap="round" style={{ transform: `scaleY(${Math.min(1, progress * 4)})`, transformOrigin: 'bottom' }} />
            <g style={{ transform: `translate(0px, -40px) scale(${progress > 0.1 ? Math.min(1, (progress - 0.1) * 1.5) : 0})`, transformOrigin: 'bottom center', transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <path d="M0,0 Q-40,-40 -60,-90" stroke={isFinished ? "#a78bfa" : "#7c3aed"} strokeWidth="3" fill="none" />
              <path d="M0,0 Q40,-40 60,-90" stroke={isFinished ? "#a78bfa" : "#7c3aed"} strokeWidth="3" fill="none" />
              <path d="M0,0 Q0,-60 0,-100" stroke={isFinished ? "#a78bfa" : "#7c3aed"} strokeWidth="3" fill="none" />
              <path d="M-30,-45 Q0,-60 30,-45" stroke={isFinished ? "#c4b5fd" : "#8b5cf6"} strokeWidth="1" fill="none" style={{opacity: progress > 0.5 ? 1 : 0, transition: 'opacity 1s'}} />
              <path d="M-45,-70 Q0,-90 45,-70" stroke={isFinished ? "#c4b5fd" : "#8b5cf6"} strokeWidth="1" fill="none" style={{opacity: progress > 0.7 ? 1 : 0, transition: 'opacity 1s'}} />
            </g>
          </g>
        );
      case 'brain':
        return (
          <g transform="translate(100, 185)">
            <g style={{ transform: `scale(${Math.min(1, progress * 3)})`, transformOrigin: 'bottom center', transition: 'transform 1s ease-out' }}>
              <path d="M-50,0 Q0,-60 50,0 Z" fill={isFinished ? "#22d3ee" : "#0891b2"} className="transition-colors duration-1000" />
              <path d="M-30,-10 Q-20,-25 -10,-15 T10,-20 T30,-10" stroke="#155e75" strokeWidth="2" fill="none" style={{opacity: progress > 0.4 ? 0.6 : 0}} />
              <path d="M-40,-5 Q-20,-15 0,-5 T40,-5" stroke="#155e75" strokeWidth="2" fill="none" style={{opacity: progress > 0.6 ? 0.6 : 0}} />
              <path d="M-20,-25 Q0,-45 20,-25" stroke="#155e75" strokeWidth="2" fill="none" style={{opacity: progress > 0.8 ? 0.6 : 0}} />
            </g>
          </g>
        );
      case 'staghorn':
      default:
        return (
          <g transform="translate(100, 180)">
            <g style={{ transform: `scale(${Math.min(1, progress * 5)})`, transformOrigin: 'bottom center', transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <path d="M0,0 C-10,-40 10,-60 0,-100" stroke={isFinished ? "#d946ef" : "#ec4899"} strokeWidth="8" fill="none" strokeLinecap="round"/>
              <g style={{ transform: `translate(0px, -40px) scale(${progress > 0.2 ? Math.min(1, (progress - 0.2) * 2) : 0})`, transition: 'transform 1s ease-out' }}>
                <path d="M0,0 C-20,-20 -30,-40 -25,-60" stroke={isFinished ? "#a855f7" : "#d946ef"} strokeWidth="6" fill="none" strokeLinecap="round" />
                <path d="M-20,-40 C-30,-50 -20,-70 -35,-80" stroke={isFinished ? "#8b5cf6" : "#c026d3"} strokeWidth="4" fill="none" strokeLinecap="round" style={{ opacity: progress > 0.5 ? 1 : 0, transition: 'opacity 1s' }} />
              </g>
              <g style={{ transform: `translate(0px, -60px) scale(${progress > 0.3 ? Math.min(1, (progress - 0.3) * 2) : 0})`, transition: 'transform 1s ease-out' }}>
                <path d="M0,0 C20,-20 30,-50 20,-80" stroke={isFinished ? "#6366f1" : "#a855f7"} strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d="M15,-50 C30,-60 40,-60 45,-85" stroke={isFinished ? "#8b5cf6" : "#e879f9"} strokeWidth="4" fill="none" strokeLinecap="round" style={{ opacity: progress > 0.6 ? 1 : 0, transition: 'opacity 1s' }} />
              </g>
              <circle cx="0" cy="-100" r={progress > 0.9 ? 6 : 0} fill="#fff" className="animate-pulse shadow-[0_0_10px_#fff]" />
              <circle cx="-25" cy="-60" r={progress > 0.85 ? 4 : 0} fill="#fff" className="animate-pulse delay-75 shadow-[0_0_10px_#fff]" />
              <circle cx="20" cy="-80" r={progress > 0.95 ? 5 : 0} fill="#fff" className="animate-pulse delay-150 shadow-[0_0_10px_#fff]" />
            </g>
          </g>
        );
    }
  };

  // --- Handlers for Custom Timer/Auth (Same as before) ---
  const handleSaveCustomTimer = async () => { 
    if (!user || user.isAnonymous) { setShowSettings(false); setShowAuthModal(true); return; }
    if (!customInput || isNaN(parseInt(customInput))) return;
    try { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'timers'), { minutes: parseInt(customInput), createdAt: Date.now() }); setCustomInput(''); } catch (e) { console.error(e); }
  };
  const handleDeleteTimer = async (id) => { if (!user) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timers', id)); } catch (e) { console.error(e); } };
  const handleCustomStart = () => { const mins = parseInt(customInput); if (!isNaN(mins) && mins > 0) updateDuration(mins); };
  const handleGoogleLogin = async () => { setAuthLoading(true); try { await signInWithPopup(auth, new GoogleAuthProvider()); setShowAuthModal(false); } catch (e) { setAuthError(e.message); } finally { setAuthLoading(false); } };
  const handleEmailAuth = async (e) => { e.preventDefault(); setAuthLoading(true); setAuthError(''); try { isSignUp ? await createUserWithEmailAndPassword(auth, email, password) : await signInWithEmailAndPassword(auth, email, password); setShowAuthModal(false); } catch (err) { setAuthError(err.message); } finally { setAuthLoading(false); } };
  const handleSignOut = async () => { await signOut(auth); setShowAuthModal(false); };

  const bubbles = useMemo(() => Array.from({ length: 15 }).map((_, i) => ({
    id: i, left: `${Math.random() * 100}%`, delay: `${Math.random() * 5}s`, duration: `${5 + Math.random() * 10}s`, size: `${2 + Math.random() * 6}px`
  })), []);

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center overflow-hidden relative font-sans selection:bg-pink-500 selection:text-white pb-36">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-br from-purple-800/30 via-pink-600/20 to-transparent blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-indigo-900/30 via-blue-900/20 to-transparent blur-[100px]" />
        {bubbles.map((b) => <div key={b.id} className="absolute bg-white/10 rounded-full animate-float blur-[1px]" style={{left: b.left, bottom: '-20px', width: b.size, height: b.size, animationDelay: b.delay, animationDuration: b.duration}} />)}
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20">
        <div className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Reef<span className="font-light text-white/40">Focus</span></div>
        <button onClick={() => setShowAuthModal(true)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all backdrop-blur-md border border-white/10 hover:border-white/20 ${user && !user.isAnonymous ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'}`}>
          {user && !user.isAnonymous ? <><UserIcon size={16} /> <span className="hidden sm:inline">{user.displayName || "User"}</span></> : <><LogIn size={16} /> <span>Login</span></>}
        </button>
      </div>

      {/* Main Content */}
      <div className="z-10 w-full max-w-5xl px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        
        {/* Left Column: Controls */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-8 order-2 md:order-1">
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1]">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500">Delightful</span> <br />
              <span className="text-white">Focus.</span>
            </h1>
            <p className="text-xl text-white/50 font-light max-w-md">{isFinished ? "Session complete. The reef is thriving." : "Grow your reef while you work. Stay focused, stay calm."}</p>
          </div>

          <div className="flex flex-col items-center md:items-start gap-2 w-full">
            <div className="text-[6rem] md:text-[7rem] font-medium leading-none tracking-tight tabular-nums bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 drop-shadow-2xl">{formatTime(timeLeft)}</div>
            
            <div className="flex flex-col gap-4 w-full md:w-auto">
              {/* Main Controls Row */}
              <div className="flex items-center gap-4 justify-center md:justify-start">
                <button onClick={handleStart} className="h-14 px-8 rounded-2xl font-bold text-lg flex items-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] bg-white text-black hover:bg-slate-200">
                  {isActive ? <><Pause fill="currentColor" size={20} /> Pause</> : <><Play fill="currentColor" size={20} /> Start Focus</>}
                </button>
                <button onClick={() => setShowSettings(true)} className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all"><Settings size={24} /></button>
                <button onClick={resetTimer} className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all"><RotateCcw size={24} /></button>
              </div>

              {/* Reef Selector Trigger */}
              <button 
                onClick={() => setShowCoralSelector(true)}
                className="flex items-center justify-center md:justify-start gap-2 text-sm text-white/40 hover:text-white transition-colors group mt-2"
              >
                <span className="w-2 h-2 rounded-full bg-pink-500/50 group-hover:bg-pink-500 transition-colors" />
                Current Species: <span className="text-white border-b border-white/10 group-hover:border-white">{selectedCoralId === 'random' ? 'Mystery Reef (Random)' : CORAL_TYPES.find(c => c.id === selectedCoralId)?.name}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Visual */}
        <div className="relative order-1 md:order-2 flex justify-center">
            <div className="relative w-[320px] h-[480px] md:w-[380px] md:h-[500px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] shadow-2xl flex flex-col items-center justify-center p-8 overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent rounded-[3rem] pointer-events-none" />
                <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-purple-500/10 to-transparent opacity-50 pointer-events-none" />
                <div className="absolute top-8 px-4 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-medium uppercase tracking-wider text-white/80 backdrop-blur-md">
                    {isFinished ? "Reef Planted" : isActive ? "Growing..." : "Reef Ready"}
                </div>
                <div className="relative w-64 h-64 mt-4 transition-transform duration-700 hover:scale-105">
                  <div className="absolute inset-0 rounded-full bg-pink-500/20 blur-3xl transition-all duration-1000" style={{ opacity: 0.2 + (progress * 0.6), transform: `scale(${0.8 + (progress * 0.4)})` }} />
                  <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible drop-shadow-[0_0_15px_rgba(255,105,180,0.5)]">
                    <path d="M60,180 Q100,170 140,180 Q160,190 150,200 L50,200 Q40,190 60,180" fill="#1e1e24" className="transition-colors duration-1000"/>
                    {/* Dynamic Render based on Active Session Coral */}
                    {renderCoral(activeSessionCoral, progress, isFinished)}
                  </svg>
                </div>
            </div>
        </div>
      </div>

      {/* --- Reef Selector Modal --- */}
      {showCoralSelector && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl">
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold text-white">Choose Your Reef</h2>
               <button onClick={() => setShowCoralSelector(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
             </div>
             
             <div className="grid grid-cols-2 gap-3 mb-6">
                {/* Random Option (Skip) */}
                <button 
                  onClick={() => { setSelectedCoralId('random'); setShowCoralSelector(false); }}
                  className={`col-span-2 p-4 rounded-2xl border flex items-center gap-4 transition-all ${selectedCoralId === 'random' ? 'bg-white/10 border-pink-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white"><Shuffle size={18} /></div>
                  <div className="text-left">
                    <div className="font-bold text-white">Surprise Me</div>
                    <div className="text-xs text-white/50">Grow a random reef each time (Default)</div>
                  </div>
                </button>

                {/* Specific Options */}
                {CORAL_TYPES.map((coral) => (
                  <button 
                    key={coral.id}
                    onClick={() => { setSelectedCoralId(coral.id); setShowCoralSelector(false); }}
                    className={`p-4 rounded-2xl border text-left transition-all ${selectedCoralId === coral.id ? 'bg-white/10 border-white/40' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                  >
                     <div className="w-8 h-8 rounded-full mb-3" style={{ background: coral.color }}></div>
                     <div className="font-bold text-white text-sm">{coral.name}</div>
                     <div className="text-xs text-white/40">{coral.description}</div>
                  </button>
                ))}
             </div>
             
             <div className="text-center text-xs text-white/30">
               If you "Skip" selection, we will default to "Surprise Me".
             </div>
           </div>
        </div>
      )}

      {/* --- Settings Modal (Existing) --- */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto ring-1 ring-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Focus Duration</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[5, 15, 25, 30, 45, 60].map((mins) => (
                <button key={mins} onClick={() => updateDuration(mins)} className={`py-3 rounded-2xl text-base font-medium transition-all ${(duration / 60) === mins ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}>{mins}m</button>
              ))}
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between"><label className="text-xs uppercase text-white/40 font-bold tracking-widest">Custom Timer</label></div>
              <div className="flex gap-2">
                <input type="number" value={customInput} onChange={(e) => setCustomInput(e.target.value)} placeholder="Minutes" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 transition-all placeholder:text-white/20"/>
                <button onClick={handleCustomStart} className="bg-white/10 hover:bg-white/20 px-4 rounded-xl text-white transition-colors"><Play size={20} /></button>
                <button onClick={handleSaveCustomTimer} disabled={savedTimers.length >= 5} className={`px-4 rounded-xl flex items-center justify-center transition-colors ${savedTimers.length >= 5 ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-500 text-white'}`}><Save size={20} /></button>
              </div>
              {user && user.isAnonymous && <p className="text-xs text-pink-400 mt-1">Sign in to save presets.</p>}
            </div>
            {savedTimers.length > 0 && (
              <div className="mt-8 pt-8 border-t border-white/10">
                <label className="text-xs uppercase text-white/40 font-bold tracking-widest mb-4 block">Saved Presets</label>
                <div className="space-y-2">
                  {savedTimers.map((timer) => (
                    <div key={timer.id} className="group flex items-center gap-2">
                      <button onClick={() => updateDuration(timer.minutes)} className={`flex-1 text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition-all flex justify-between items-center group-hover:pl-5 ${(duration / 60) === timer.minutes ? 'ring-1 ring-pink-500/50 bg-pink-500/10' : ''}`}><span>{timer.minutes} Minutes</span><Play size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" /></button>
                      <button onClick={() => handleDeleteTimer(timer.id)} className="p-3 text-white/20 hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors"><Trash2 size={18} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Auth Modal (Existing) --- */}
      {showAuthModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white tracking-tight">{user && !user.isAnonymous ? 'Your Account' : (isSignUp ? 'Join ReefFocus' : 'Welcome Back')}</h2>
              <button onClick={() => setShowAuthModal(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
            </div>
            {user && !user.isAnonymous ? (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-purple-500/20"><span className="text-2xl font-bold">{user.email ? user.email[0].toUpperCase() : 'U'}</span></div>
                <div><p className="text-white font-medium text-lg">{user.displayName || "Explorer"}</p><p className="text-white/40 text-sm">{user.email}</p></div>
                <button onClick={handleSignOut} className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium flex items-center justify-center gap-2 transition-all border border-white/5"><LogOut size={18} /> Sign Out</button>
              </div>
            ) : (
              <div className="space-y-4">
                <button onClick={handleGoogleLogin} disabled={authLoading} className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-gray-100 text-black font-semibold flex items-center justify-center gap-3 transition-all disabled:opacity-50">Continue with Google</button>
                <div className="flex items-center gap-3 text-white/20 text-xs font-bold uppercase tracking-widest my-4"><div className="h-px bg-white/10 flex-1"></div>OR<div className="h-px bg-white/10 flex-1"></div></div>
                <form onSubmit={handleEmailAuth} className="space-y-3">
                  {authError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs">{authError}</div>}
                  <div className="space-y-3">
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-white/30 placeholder:text-white/30 transition-colors"/>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-white/30 placeholder:text-white/30 transition-colors"/>
                  </div>
                  <button type="submit" disabled={authLoading} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 mt-2">{authLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}</button>
                </form>
                <div className="text-center pt-2"><button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }} className="text-sm text-white/40 hover:text-white transition-colors">{isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- AdSense Banner (Sticky) --- */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-t border-white/5 p-3 flex justify-center shadow-2xl">
        <div className="w-full max-w-[728px] h-[90px] bg-white/5 border border-white/5 rounded-lg flex items-center justify-center relative overflow-hidden group">
          {ADSENSE_PUBLISHER_ID === "ca-pub-5370113062591091" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 text-xs p-4 text-center select-none"><span className="font-bold mb-1">Ad Space</span><span>Waiting for configuration</span></div>
          )}
          <ins className="adsbygoogle" style={{ display: 'block', width: '100%', height: '100%' }} data-ad-client={5370113062591091} data-ad-slot={ADSENSE_SLOT_ID} data-ad-format="auto" data-full-width-responsive="true"></ins>
        </div>
      </div>
      <style>{` @keyframes float { 0% { transform: translateY(100vh) scale(0); opacity: 0; } 20% { opacity: 0.5; } 80% { opacity: 0.5; } 100% { transform: translateY(-20px) scale(1); opacity: 0; } } .animate-float { animation-name: float; animation-timing-function: linear; animation-iteration-count: infinite; } `}</style>
    </div>
  );
};

export default ReefFocus;