import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { signInWithGoogle, db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { DriverProfile, Language, City } from './types';
import { Stage1, Stage2, Stage3, Stage4, Stage5, Stage6 } from './components/OnboardingStages';
import { AdminDashboard } from './components/AdminDashboard';
import { Button, Card, cn } from './components/Common';
import { Truck, LogOut, ShieldCheck, User as UserIcon, AlertCircle } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [language, setLanguage] = useState<Language>('English');
  const [isAdminView, setIsAdminView] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (user) {
      // "Fresh Start" logic: Clear profile on every reload for testing purposes
      const freshStart = async () => {
        setIsAuthReady(false); // Hide UI while resetting
        try {
          // Delete documents
          const docsSnap = await getDocs(collection(db, 'drivers', user.uid, 'documents'));
          for (const d of docsSnap.docs) {
            await deleteDoc(doc(db, 'drivers', user.uid, 'documents', d.id));
          }
          // Delete profile
          await deleteDoc(doc(db, 'drivers', user.uid));
          console.log("Fresh start: Profile cleared on reload for testing.");
        } catch (e) {
          console.error("Fresh start failed:", e);
        } finally {
          // Now set up the listener
          const unsub = onSnapshot(doc(db, 'drivers', user.uid), (snap) => {
            if (snap.exists()) {
              setDriver(snap.data() as DriverProfile);
            } else {
              setDriver(null);
            }
            setIsAuthReady(true);
          });
          return unsub;
        }
      };
      
      const resetPromise = freshStart();
      return () => {
        resetPromise.then(unsub => unsub && typeof unsub === 'function' && unsub());
      };
    } else {
      setDriver(null);
      setIsAuthReady(true);
    }
  }, [user]);

  const handleStage1Complete = async (lang: Language, city: City) => {
    if (!user) return;
    setLanguage(lang);
    const newDriver: DriverProfile = {
      uid: user.uid,
      city,
      status: 'registration_started',
      currentStage: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'drivers', user.uid), newDriver);
  };

  const handleUpdateDriver = async (updates: Partial<DriverProfile>) => {
    if (!user || !driver) return;
    const updatedDriver = { ...driver, ...updates, updatedAt: new Date().toISOString() };
    await updateDoc(doc(db, 'drivers', user.uid), updatedDriver);
  };

  if (loading || !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdminView) {
    return <AdminDashboard onBack={() => setIsAdminView(false)} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-brand-light rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Truck className="w-8 h-8 text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">TruckTaxi Driver Onboarding</h1>
          <p className="text-zinc-600 text-sm mb-8">
            Join TruckTaxi and earn up to ₹10 LPA running your own vehicle on your own schedule.
          </p>
          <Button onClick={signInWithGoogle} className="w-full h-12 text-base">
            <UserIcon className="w-4 h-4 mr-2" />
            Sign in with Google to Start
          </Button>
          <button 
            onClick={() => setIsAdminView(true)}
            className="mt-6 text-xs text-zinc-400 hover:text-zinc-600 flex items-center justify-center mx-auto"
          >
            <ShieldCheck className="w-3 h-3 mr-1" /> Admin Access
          </button>
        </Card>
      </div>
    );
  }

  const renderStage = () => {
    if (!driver) return <Stage1 onComplete={handleStage1Complete} />;
    
    switch (driver.currentStage) {
      case 1: return <Stage1 onComplete={handleStage1Complete} initialLang={language} initialCity={driver.city} />;
      case 2: return <Stage2 driver={driver} onUpdate={handleUpdateDriver} language={language} />;
      case 3: return <Stage3 driver={driver} onUpdate={handleUpdateDriver} language={language} />;
      case 4: return <Stage4 driver={driver} onUpdate={handleUpdateDriver} language={language} />;
      case 5: return <Stage5 driver={driver} onUpdate={handleUpdateDriver} language={language} />;
      case 6: return <Stage6 driver={driver} onUpdate={handleUpdateDriver} language={language} />;
      default: return <Stage1 onComplete={handleStage1Complete} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 px-6 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand" />
            <span className="font-bold text-zinc-900">TruckTaxi</span>
          </div>
          <div className="flex items-center gap-4">
            {user?.email === 'mike.nijoe@gmail.com' && (
              <button 
                onClick={() => setIsAdminView(true)}
                className="text-[10px] font-bold text-zinc-500 hover:text-brand uppercase border border-zinc-200 px-2 py-1 rounded-full flex items-center gap-1"
              >
                <ShieldCheck className="w-3 h-3" />
                Admin
              </button>
            )}
            {driver && (
              <button 
                disabled={isResetting}
                onClick={async () => {
                  if (window.confirm('Are you sure you want to reset your profile and start over?')) {
                    setIsResetting(true);
                    try {
                      // Delete all documents first
                      const docsSnap = await getDocs(collection(db, 'drivers', user.uid, 'documents'));
                      for (const d of docsSnap.docs) {
                        await deleteDoc(doc(db, 'drivers', user.uid, 'documents', d.id));
                      }
                      
                      // Delete the main driver profile to trigger a full reset to Stage 1
                      await deleteDoc(doc(db, 'drivers', user.uid));
                      
                      // Force a full page reload to ensure all state is cleared and we start from Stage 1
                      window.location.reload();
                    } catch (error) {
                      console.error("Reset failed:", error);
                      alert("Failed to reset profile. Please try again.");
                      setIsResetting(false);
                    }
                  }
                }}
                className={cn(
                  "text-[10px] font-bold uppercase border px-2 py-1 rounded-full transition-all",
                  isResetting 
                    ? "text-zinc-400 border-zinc-200 cursor-not-allowed" 
                    : "text-red-500 hover:text-red-700 border-red-200 hover:bg-red-50"
                )}
              >
                {isResetting ? 'Resetting...' : 'Reset Profile'}
              </button>
            )}
            {driver && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-brand-light rounded-full">
                <div className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-brand uppercase">Stage {driver.currentStage}</span>
              </div>
            )}
            <button onClick={() => auth.signOut()} className="text-zinc-400 hover:text-zinc-600">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="py-8">
        {renderStage()}
      </main>

      {driver && driver.status === 'action_required' && (
        <div className="fixed bottom-6 left-6 right-6 max-w-md mx-auto">
          <Card className="bg-amber-50 border-amber-200 p-4 flex items-start shadow-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 mr-3 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900 mb-0.5">Action Required</p>
              <p className="text-xs text-amber-800">Please check your documents. Some need re-uploading.</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
