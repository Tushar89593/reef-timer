import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, Pause, RotateCcw, CheckCircle2, Settings, X, 
  Plus, Trash2, Save, User as UserIcon, LogIn, LogOut, Mail, ArrowRight 
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

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAEUk6q5PekrfhNx76nqrzVFboqKYofnnw",
  authDomain: "reeftimer.firebaseapp.com",
  projectId: "reeftimer",
  storageBucket: "reeftimer.firebasestorage.app",
  messagingSenderId: "451135568546",
  appId: "1:451135568546:web:040fb6e23bddaf5449f5fb",
  measurementId: "G-9NRGSC1DBV"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const ReefFocus = () => {
  // --- Timer State ---
  const [duration, setDuration] = useState(25 * 60); // Default 25 mins
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
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
  // TODO: REPLACE THESE WITH YOUR ACTUAL GOOGLE ADSENSE IDs
  const ADSENSE_PUBLISHER_ID = "ca-pub-0000000000000000"; // Replace with your Publisher ID
  const ADSENSE_SLOT_ID = "0000000000"; // Replace with your Ad Slot ID

  // 1. Initial Auth Check & Setup
  useEffect(() => {
    const initAuth = async () => {
      if (!auth.currentUser) {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        signInAnonymously(auth).catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Sync Saved Timers from Firestore
  useEffect(() => {
    if (!user) {
      setSavedTimers([]);
      return;
    }
    
    const timersRef = collection(db, 'artifacts', appId, 'users', user.uid, 'timers');
    
    const unsubscribe = onSnapshot(timersRef, (snapshot) => {
      const timers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSavedTimers(timers.sort((a, b) => a.minutes - b.minutes));
    }, (error) => {
      console.error("Error fetching timers:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. AdSense Script Injection & Initialization
  useEffect(() => {
    // Only run if IDs are set (simple check to avoid errors if user hasn't configured it)
    if (ADSENSE_PUBLISHER_ID === "ca-pub-0000000000000000") return;

    // Inject the script if not already present
    if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
      const script = document.createElement('script');
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }

    // Push the ad unit
    try {
      // Use a timeout to ensure DOM element is ready
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      }, 1000);
    } catch (e) {
      console.error("AdSense init error:", e);
    }
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

  const handleStart = () => {
    if (timeLeft === 0) resetTimer();
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

  // --- Custom Timer Handlers ---
  const handleSaveCustomTimer = async () => {
    if (!user || user.isAnonymous) {
      setShowSettings(false);
      setShowAuthModal(true);
      return;
    }
    
    if (!customInput) return;
    const mins = parseInt(customInput);
    if (isNaN(mins) || mins <= 0) return;
    if (savedTimers.length >= 5) return;

    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'timers'), {
        minutes: mins,
        createdAt: Date.now()
      });
      setCustomInput('');
    } catch (e) {
      console.error("Error saving timer", e);
    }
  };

  const handleDeleteTimer = async (timerId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timers', timerId));
    } catch (e) {
      console.error("Error deleting timer", e);
    }
  };

  const handleCustomStart = () => {
    const mins = parseInt(customInput);
    if (!isNaN(mins) && mins > 0) updateDuration(mins);
  };

  // --- Auth Handlers ---
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowAuthModal(false);
    } catch (err) {
      setAuthError("Could not sign in with Google. " + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowAuthModal(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setShowAuthModal(false);
    } catch (err) {
      console.error("Error signing out", err);
    }
  };

  // --- Visuals ---
  const bubbles = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 5}s`,
      duration: `${5 + Math.random() * 10}s`,
      size: `${2 + Math.random() * 6}px`
    }));
  }, []);

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center overflow-hidden relative font-sans selection:bg-pink-500 selection:text-white pb-36">
      
      {/* --- Ambient Background --- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-br from-purple-800/30 via-pink-600/20 to-transparent blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-indigo-900/30 via-blue-900/20 to-transparent blur-[100px]" />
        {bubbles.map((b) => (
          <div
            key={b.id}
            className="absolute bg-white/10 rounded-full animate-float blur-[1px]"
            style={{
              left: b.left,
              bottom: '-20px',
              width: b.size,
              height: b.size,
              animationDelay: b.delay,
              animationDuration: b.duration
            }}
          />
        ))}
      </div>

      {/* --- Top Bar (User Profile) --- */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20">
        <div className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
          Reef<span className="font-light text-white/40">Focus</span>
        </div>
        
        <button 
          onClick={() => setShowAuthModal(true)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all backdrop-blur-md border border-white/10 hover:border-white/20
            ${user && !user.isAnonymous 
              ? 'bg-white/10 text-white hover:bg-white/15' 
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/5'}
          `}
        >
          {user && !user.isAnonymous ? (
            <>
              <UserIcon size={16} />
              <span className="max-w-[100px] truncate hidden sm:inline">
                {user.displayName || user.email || "User"}
              </span>
            </>
          ) : (
            <>
              <LogIn size={16} />
              <span>Login</span>
            </>
          )}
        </button>
      </div>

      {/* --- Main Content Grid --- */}
      <div className="z-10 w-full max-w-5xl px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        
        {/* Left Col: Text & Controls */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-8 order-2 md:order-1">
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1]">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500">
                Delightful
              </span> <br />
              <span className="text-white">Focus.</span>
            </h1>
            <p className="text-xl text-white/50 font-light max-w-md">
              {isFinished 
                ? "Session complete. The reef is thriving." 
                : "Grow your reef while you work. Stay focused, stay calm."}
            </p>
          </div>

          <div className="flex flex-col items-center md:items-start gap-2 w-full">
             <div className="text-[6rem] md:text-[7rem] font-medium leading-none tracking-tight tabular-nums bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 drop-shadow-2xl">
              {formatTime(timeLeft)}
            </div>
            
            <div className="flex items-center gap-4 mt-4 w-full justify-center md:justify-start">
              <button 
                onClick={handleStart}
                className={`
                  h-14 px-8 rounded-2xl font-bold text-lg flex items-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)]
                  ${isActive 
                    ? 'bg-white text-black hover:bg-slate-200' 
                    : 'bg-white text-black hover:bg-slate-200'}
                `}
              >
                {isActive ? (
                  <> <Pause fill="currentColor" size={20} /> Pause Focus </>
                ) : (
                  <> <Play fill="currentColor" size={20} /> Start Focus </>
                )}
              </button>
              <button onClick={() => setShowSettings(true)} className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all">
                <Settings size={24} />
              </button>
              <button onClick={resetTimer} className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all">
                <RotateCcw size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: The Visual */}
        <div className="relative order-1 md:order-2 flex justify-center">
            <div className="relative w-[320px] h-[480px] md:w-[380px] md:h-[500px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] shadow-2xl flex flex-col items-center justify-center p-8 overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent rounded-[3rem] pointer-events-none" />
                <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-purple-500/10 to-transparent opacity-50 pointer-events-none" />
                <div className="absolute top-8 px-4 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-medium uppercase tracking-wider text-white/80 backdrop-blur-md">
                    {isFinished ? "Reef Planted" : isActive ? "Growing..." : "Reef Ready"}
                </div>
                <div className="relative w-64 h-64 mt-4 transition-transform duration-700 hover:scale-105">
                  <div 
                    className="absolute inset-0 rounded-full bg-pink-500/20 blur-3xl transition-all duration-1000"
                    style={{ opacity: 0.2 + (progress * 0.6), transform: `scale(${0.8 + (progress * 0.4)})` }}
                  />
                  <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible drop-shadow-[0_0_15px_rgba(255,105,180,0.5)]">
                    <path d="M60,180 Q100,170 140,180 Q160,190 150,200 L50,200 Q40,190 60,180" fill="#1e1e24" className="transition-colors duration-1000"/>
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
                  </svg>
                </div>
            </div>
        </div>
      </div>

      {/* --- AdSense Banner (Sticky Bottom) --- */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-t border-white/5 p-3 flex justify-center shadow-2xl">
        {/* Ad Container */}
        <div className="w-full max-w-[728px] h-[90px] bg-white/5 border border-white/5 rounded-lg flex items-center justify-center relative overflow-hidden group">
          {/* Instructions Overlay (Visible until properly configured) */}
          {ADSENSE_PUBLISHER_ID === "ca-pub-5370113062591091" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 text-xs p-4 text-center select-none">
              <span className="font-bold mb-1">Ad Space</span>
              <span>Waiting for configuration</span>
            </div>
          )}

          {/* Actual Ad Unit */}
          <ins className="adsbygoogle"
              style={{ display: 'block', width: '100%', height: '100%' }}
              data-ad-client={ADSENSE_PUBLISHER_ID}
              data-ad-slot={ADSENSE_SLOT_ID}
              data-ad-format="auto"
              data-full-width-responsive="true"></ins>
        </div>
      </div>

      {/* --- Settings Modal --- */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto ring-1 ring-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Focus Duration</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"><X size={20} /></button>
            </div>
            
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[5, 15, 25, 30, 45, 60].map((mins) => (
                <button 
                  key={mins} 
                  onClick={() => updateDuration(mins)} 
                  className={`
                    py-3 rounded-2xl text-base font-medium transition-all
                    ${(duration / 60) === mins 
                      ? 'bg-white text-black shadow-lg' 
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}
                  `}
                >
                  {mins}m
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <label className="text-xs uppercase text-white/40 font-bold tracking-widest">Custom Timer</label>
              </div>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={customInput} 
                  onChange={(e) => setCustomInput(e.target.value)} 
                  placeholder="Minutes" 
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 transition-all placeholder:text-white/20"
                />
                <button onClick={handleCustomStart} className="bg-white/10 hover:bg-white/20 px-4 rounded-xl text-white transition-colors"><Play size={20} /></button>
                <button 
                  onClick={handleSaveCustomTimer} 
                  disabled={savedTimers.length >= 5}
                  className={`px-4 rounded-xl flex items-center justify-center transition-colors ${savedTimers.length >= 5 ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-500 text-white'}`}
                >
                  <Save size={20} />
                </button>
              </div>
              {user && user.isAnonymous && (
                 <p className="text-xs text-pink-400 mt-1">Sign in to save presets.</p>
              )}
            </div>

            {savedTimers.length > 0 && (
              <div className="mt-8 pt-8 border-t border-white/10">
                <label className="text-xs uppercase text-white/40 font-bold tracking-widest mb-4 block">Saved Presets</label>
                <div className="space-y-2">
                  {savedTimers.map((timer) => (
                    <div key={timer.id} className="group flex items-center gap-2">
                      <button 
                        onClick={() => updateDuration(timer.minutes)} 
                        className={`flex-1 text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition-all flex justify-between items-center group-hover:pl-5 ${(duration / 60) === timer.minutes ? 'ring-1 ring-pink-500/50 bg-pink-500/10' : ''}`}
                      >
                        <span>{timer.minutes} Minutes</span>
                        <Play size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTimer(timer.id)} 
                        className="p-3 text-white/20 hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Auth Modal --- */}
      {showAuthModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white tracking-tight">{user && !user.isAnonymous ? 'Your Account' : (isSignUp ? 'Join ReefFocus' : 'Welcome Back')}</h2>
              <button onClick={() => setShowAuthModal(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
            </div>

            {user && !user.isAnonymous ? (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-purple-500/20">
                  <span className="text-2xl font-bold">{user.email ? user.email[0].toUpperCase() : 'U'}</span>
                </div>
                <div>
                    <p className="text-white font-medium text-lg">{user.displayName || "Explorer"}</p>
                    <p className="text-white/40 text-sm">{user.email}</p>
                </div>
                <button onClick={handleSignOut} className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium flex items-center justify-center gap-2 transition-all border border-white/5">
                  <LogOut size={18} /> Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button 
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-gray-100 text-black font-semibold flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                >
                  {authLoading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"/> : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 text-white/20 text-xs font-bold uppercase tracking-widest my-4">
                  <div className="h-px bg-white/10 flex-1"></div>
                  OR
                  <div className="h-px bg-white/10 flex-1"></div>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3">
                  {authError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs">{authError}</div>}
                  <div className="space-y-3">
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-white/30 placeholder:text-white/30 transition-colors"/>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-white/30 placeholder:text-white/30 transition-colors"/>
                  </div>
                  <button type="submit" disabled={authLoading} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 mt-2">
                    {authLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                  </button>
                </form>

                <div className="text-center pt-2">
                  <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }} className="text-sm text-white/40 hover:text-white transition-colors">
                    {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSS for custom bubble animation */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.5; }
          100% { transform: translateY(-20px) scale(1); opacity: 0; }
        }
        .animate-float {
          animation-name: float;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
};

export default ReefFocus;