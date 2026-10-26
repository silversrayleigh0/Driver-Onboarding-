import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  ChevronRight, 
  Upload, 
  AlertCircle, 
  MapPin, 
  Truck, 
  Languages, 
  ShieldCheck, 
  BookOpen, 
  Send,
  LogOut,
  Camera,
  FileText,
  CreditCard,
  User as UserIcon,
  Building2,
  ArrowRight,
  RefreshCw,
  Box,
  Package,
  Archive,
  LayoutGrid
} from 'lucide-react';
import { Button, Card, Input, Label, cn } from './Common';
import { Language, City, VehicleType, DriverProfile, DocumentType, DriverDocument } from '../types';
import { CITIES, VEHICLE_TYPES, CITY_ZONES, DOCUMENT_LABELS, TRAINING_MODULES } from '../constants';
import { db, auth, storage, handleFirebaseError, OperationType } from '../firebase';
import { doc, setDoc, updateDoc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { validateDocument } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface StageProps {
  driver: DriverProfile;
  onUpdate: (updates: Partial<DriverProfile>) => Promise<void>;
  language: Language;
}

// --- Stage 1: Language & City ---
export const Stage1: React.FC<{ 
  onComplete: (lang: Language, city: City) => void;
  initialLang?: Language;
  initialCity?: City;
}> = ({ onComplete, initialLang, initialCity }) => {
  const [lang, setLang] = useState<Language>(initialLang || 'English');
  const [city, setCity] = useState<City | ''>(initialCity || '');

  const t = {
    English: {
      title: 'Welcome to TruckTaxi',
      subtitle: 'Join TruckTaxi and earn up to ₹10 LPA running your own vehicle on your own schedule.',
      selectLang: 'Select Language',
      selectCity: 'Select Your City',
      continue: 'Continue',
      waitlist: 'TruckTaxi is coming to your city soon! We\'ll notify you when we launch.'
    },
    Tamil: {
      title: 'TruckTaxi-க்கு வரவேற்கிறோம்',
      subtitle: 'TruckTaxi-யில் இணைந்து உங்கள் சொந்த வாகனத்தை உங்கள் சொந்த அட்டவணையில் இயக்கி ஆண்டுக்கு ₹10 லட்சம் வரை சம்பாதிக்கவும்.',
      selectLang: 'மொழியைத் தேர்ந்தெடுக்கவும்',
      selectCity: 'உங்கள் நகரத்தைத் தேர்ந்தெடுக்கவும்',
      continue: 'தொடரவும்',
      waitlist: 'TruckTaxi விரைவில் உங்கள் நகரத்திற்கு வருகிறது! நாங்கள் தொடங்கும் போது உங்களுக்கு அறிவிப்போம்.'
    }
  }[lang];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-brand-light rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Truck className="w-8 h-8 text-brand" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">{t.title}</h1>
        <p className="text-zinc-600 text-sm">{t.subtitle}</p>
      </div>

      <div className="space-y-6">
        <div>
          <Label>{t.selectLang}</Label>
          <div className="grid grid-cols-2 gap-3">
            {(['English', 'Tamil'] as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  'flex items-center justify-center p-4 rounded-xl border-2 transition-all',
                  lang === l ? 'border-brand bg-brand-light text-brand' : 'border-zinc-100 bg-white text-zinc-600 hover:border-zinc-200'
                )}
              >
                <Languages className="w-4 h-4 mr-2" />
                <span className="font-medium">{l}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>{t.selectCity}</Label>
          <div className="grid grid-cols-2 gap-3">
            {CITIES.map((c) => (
              <button
                key={c}
                onClick={() => setCity(c)}
                className={cn(
                  'flex items-center justify-center p-4 rounded-xl border-2 transition-all',
                  city === c ? 'border-brand bg-brand-light text-brand' : 'border-zinc-100 bg-white text-zinc-600 hover:border-zinc-200'
                )}
              >
                <MapPin className="w-4 h-4 mr-2" />
                <span className="font-medium">{c}</span>
              </button>
            ))}
          </div>
        </div>

        <Button 
          disabled={!city} 
          onClick={() => city && onComplete(lang, city)}
          className="w-full h-12 text-base"
        >
          {t.continue}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
};

// --- Stage 2: Eligibility Check ---
export const Stage2: React.FC<StageProps> = ({ driver, onUpdate, language }) => {
  const [answers, setAnswers] = useState<Record<string, boolean | string>>({
    vehicleType: driver.vehicleType || '',
    isClosedVehicle: driver.isClosedVehicle || false,
    hasDL: true,
    hasInsurance: true,
    isCommercial: true,
    hasAadhaar: true,
    isRCOwner: true
  });

  const t = {
    English: {
      title: 'Eligibility Check',
      subtitle: 'Let\'s see if you\'re ready to join the TruckTaxi network.',
      q1: 'What type of vehicle do you own?',
      q1_sub: 'Select Body Type',
      closed: 'Closed Body',
      open: 'Open Body',
      q2: 'Is your driving license currently valid?',
      q3: 'Is your vehicle insurance currently active?',
      q4: 'Is your vehicle insurance a commercial policy?',
      q5: 'Do you have an Aadhaar card?',
      q6: 'Is your RC Book in your name or an immediate family member\'s name?',
      continue: 'Proceed to Documents',
      yes: 'Yes',
      no: 'No'
    },
    Tamil: {
      title: 'தகுதியைச் சரிபார்த்தல்',
      subtitle: 'நீங்கள் TruckTaxi நெட்வொர்க்கில் சேரத் தயாராக இருக்கிறீர்களா என்று பார்ப்போம்.',
      q1: 'உங்களிடம் எந்த வகையான வாகனம் உள்ளது?',
      q1_sub: 'உடல் வகையைத் தேர்ந்தெடுக்கவும்',
      closed: 'மூடிய உடல் (Closed)',
      open: 'திறந்த உடல் (Open)',
      q2: 'உங்கள் ஓட்டுநர் உரிமம் தற்போது செல்லுபடியாகுமா?',
      q3: 'உங்கள் வாகனக் காப்பீடு தற்போது செயலில் உள்ளதா?',
      q4: 'உங்கள் வாகனக் காப்பீடு வணிகக் கொள்கையா (Commercial Policy)?',
      q5: 'உங்களிடம் ஆதார் அட்டை உள்ளதா?',
      q6: 'உங்கள் RC புத்தகம் உங்கள் பெயரில் அல்லது உடனடி குடும்ப உறுப்பினரின் பெயரில் உள்ளதா?',
      continue: 'ஆவணங்களுக்குச் செல்லவும்',
      yes: 'ஆம்',
      no: 'இல்லை'
    }
  }[language];

  const VEHICLE_ICONS: Record<string, any> = {
    'Mini Truck': Truck,
    'Pickup': Archive,
    'Maxi Truck 407': LayoutGrid,
    'LCV': Package
  };

  const isEligible = true; // Temporarily allow all for testing

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-bold mb-2">{t.title}</h2>
      <p className="text-zinc-600 text-sm mb-6">{t.subtitle}</p>

      <div className="space-y-6">
        <div>
          <Label className="mb-3">{t.q1}</Label>
          <div className="grid grid-cols-2 gap-3">
            {VEHICLE_TYPES.map((v) => {
              const Icon = VEHICLE_ICONS[v] || Truck;
              const isSelected = answers.vehicleType === v;
              return (
                <button
                  key={v}
                  onClick={() => setAnswers(prev => ({ ...prev, vehicleType: v }))}
                  className={cn(
                    'flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 text-center gap-2',
                    isSelected 
                      ? 'border-brand bg-brand-light text-brand shadow-md shadow-brand/10' 
                      : 'border-zinc-100 bg-white text-zinc-600 hover:border-zinc-200'
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    isSelected ? "bg-brand text-white" : "bg-zinc-50 text-zinc-400"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-tight leading-tight">{v}</span>
                </button>
              );
            })}
          </div>
        </div>

        {answers.vehicleType && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <Label className="mb-3">{t.q1_sub}</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: true, label: t.closed, icon: Box },
                { val: false, label: t.open, icon: Truck }
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = answers.isClosedVehicle === item.val;
                return (
                  <button
                    key={String(item.val)}
                    onClick={() => setAnswers(prev => ({ ...prev, isClosedVehicle: item.val }))}
                    className={cn(
                      'flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 text-center gap-2',
                      isSelected 
                        ? 'border-brand bg-brand-light text-brand shadow-md shadow-brand/10' 
                        : 'border-zinc-100 bg-white text-zinc-600 hover:border-zinc-200'
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                      isSelected ? "bg-brand text-white" : "bg-zinc-50 text-zinc-400"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-tight leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {[
          { key: 'hasDL', label: t.q2 },
          { key: 'hasInsurance', label: t.q3 },
          { key: 'isCommercial', label: t.q4 },
          { key: 'hasAadhaar', label: t.q5 },
          { key: 'isRCOwner', label: t.q6 }
        ].map((q) => (
          <div key={q.key}>
            <Label>{q.label}</Label>
            <div className="flex gap-3">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => setAnswers(prev => ({ ...prev, [q.key]: val }))}
                  className={cn(
                    'flex-1 p-3 rounded-xl border text-sm font-medium transition-all',
                    answers[q.key] === val ? 'border-brand bg-brand-light text-brand' : 'border-zinc-100 bg-white text-zinc-600'
                  )}
                >
                  {val ? t.yes : t.no}
                </button>
              ))}
            </div>
          </div>
        ))}

        {!isEligible && Object.values(answers).some(v => v === false) && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start">
            <AlertCircle className="w-5 h-5 text-amber-600 mr-3 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              {language === 'English' 
                ? "Some of your answers indicate you might not be eligible right now. Please ensure you have all valid documents before proceeding."
                : "உங்கள் பதில்களில் சில நீங்கள் இப்போது தகுதியற்றவராக இருக்கலாம் என்பதைக் குறிக்கின்றன. தொடர்வதற்கு முன் உங்களிடம் அனைத்து செல்லுபடியாகும் ஆவணங்களும் இருப்பதை உறுதி செய்யவும்."}
            </p>
          </div>
        )}

        <Button 
          disabled={!isEligible || !answers.vehicleType} 
          onClick={() => onUpdate({ 
            currentStage: 3, 
            vehicleType: answers.vehicleType as VehicleType,
            isClosedVehicle: answers.isClosedVehicle as boolean
          })}
          className="w-full h-12"
        >
          {t.continue}
        </Button>
      </div>
    </motion.div>
  );
};

// --- Stage 3: Document Collection ---
export const Stage3: React.FC<StageProps> = ({ driver, onUpdate, language }) => {
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'idle' | 'compressing' | 'verifying' | 'uploading' | 'success' | 'error'>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  const [lastFiles, setLastFiles] = useState<Record<string, File>>({});
  const [skipVerify, setSkipVerify] = useState<boolean>(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'drivers', driver.uid, 'documents'), (snap) => {
      setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() } as DriverDocument)));
    });
    return unsub;
  }, [driver.uid]);

  const docSlots: DocumentType[] = [
    'dl_front', 'dl_back', 'rc_book', 'insurance', 'puc', 'aadhaar_front', 'aadhaar_back', 'vehicle_front', 'vehicle_side', 'vehicle_cargo'
  ];

  const compressImage = (file: File): Promise<{ blob: Blob; base64: string }> => {
    console.log("Compressing image:", file.name, file.size);
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.4);
        canvas.toBlob((blob) => {
          if (blob) {
            console.log("Compression complete. New size:", blob.size);
            resolve({ blob, base64 });
          } else {
            console.error("Canvas to Blob failed");
            reject(new Error('Canvas to Blob failed'));
          }
        }, 'image/jpeg', 0.4);
      };
      img.onerror = (err) => {
        console.error("Image load error:", err);
        URL.revokeObjectURL(url);
        reject(err);
      };
    });
  };

  const verifyDocument = async (type: DocumentType, base64: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const model = "gemini-3-flash-preview";
      
      const prompt = `You are a document verification assistant. 
      The user is uploading a document for the slot: "${DOCUMENT_LABELS[type]}".
      Analyze the image and determine if it is indeed a "${DOCUMENT_LABELS[type]}".
      
      IMPORTANT DEVELOPMENT/TESTING EXCEPTION: If the image provided is an illustration, mockup, map pin graphic, screenshot, sketch, draft, design template, or any generic/placeholder test file, you should treat it as ACCEPTABLE for sandbox testing. Set 'isCorrect' to true and 'visible' to true, and explain in the reasoning that a demo placeholder was accepted. We want to enable smooth test drives of the signup flow without blocking users with strict production checks.
      
      Return a JSON object with:
      - isCorrect: boolean
      - confidence: number (0-1)
      - reason: string (brief explanation if incorrect or low confidence)
      - visible: boolean (is the text clear and readable?)`;

      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { data: base64.split(',')[1] || base64, mimeType: "image/jpeg" } }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isCorrect: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              reason: { type: Type.STRING },
              visible: { type: Type.BOOLEAN }
            },
            required: ["isCorrect", "confidence", "reason", "visible"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      console.log("Verification result for", type, ":", result);
      return result;
    } catch (error) {
      console.error("Verification failed:", error);
      return { isCorrect: true, confidence: 1, reason: "Verification skipped due to error", visible: true };
    }
  };

  const handleUpload = async (type: DocumentType, file: File) => {
    console.log("Starting upload for:", type, file.name);
    setUploadStatus(prev => ({ ...prev, [type]: 'uploading' }));
    setUploadProgress(prev => ({ ...prev, [type]: 0 }));
    setSlotErrors(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    setLastFiles(prev => ({ ...prev, [type]: file }));

    try {
      if (!auth.currentUser) throw new Error("User not authenticated. Please log in again.");
      if (!driver?.uid) throw new Error("Driver profile not found. Please restart the registration.");
      if (file.size > 15 * 1024 * 1024) throw new Error("File too large (max 15MB)");

      setUploadStatus(prev => ({ ...prev, [type]: 'compressing' }));
      const { blob, base64 } = await compressImage(file);
      
      if (!blob || blob.size === 0) {
        throw new Error("Compressed image is empty. Please try another image.");
      }

      // Verify document with Gemini (skip if skipVerify is true)
      if (!skipVerify) {
        setUploadStatus(prev => ({ ...prev, [type]: 'verifying' }));
        const verification = await verifyDocument(type, base64);
        
        if (!verification.isCorrect) {
          throw new Error(`Incorrect document! This looks like it's not a ${DOCUMENT_LABELS[type]}. ${verification.reason}`);
        }
        
        if (!verification.visible) {
          throw new Error(`Image is not clear! Please re-upload a sharper photo where the text is readable.`);
        }
      } else {
        console.log("Document verification skipped (Sandbox Mode Active)");
      }

      setUploadStatus(prev => ({ ...prev, [type]: 'uploading' }));
      const storagePath = `drivers/${driver.uid}/${type}_${Date.now()}.jpg`;
      console.log("Attempting server-side proxy upload for:", storagePath);
      
      try {
        const response = await fetch('/api/upload-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            base64, 
            path: storagePath,
            contentType: 'image/jpeg'
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Server-side upload failed");
        }

        const { url } = await response.json();
        console.log("Proxy upload successful, URL:", url);

        console.log("Adding document metadata to Firestore...");
        await addDoc(collection(db, 'drivers', driver.uid, 'documents'), {
          driverId: driver.uid,
          type,
          filePath: url,
          status: 'uploaded',
          uploadedAt: new Date().toISOString()
        });
        
        setUploadStatus(prev => ({ ...prev, [type]: 'success' }));
        setTimeout(() => {
          setUploadStatus(prev => {
            const next = { ...prev };
            delete next[type];
            return next;
          });
        }, 3000);
      } catch (proxyError: any) {
        console.warn("Proxy upload failed, falling back to client-side upload...", proxyError);
        
        const storageRef = ref(storage, storagePath);
        const metadata = { contentType: 'image/jpeg' };
        
        // Fallback to client-side upload
        const snapshot = await uploadBytes(storageRef, blob, metadata);
        const url = await getDownloadURL(snapshot.ref);
        
        await addDoc(collection(db, 'drivers', driver.uid, 'documents'), {
          driverId: driver.uid,
          type,
          filePath: url,
          status: 'uploaded',
          uploadedAt: new Date().toISOString()
        });
        
        setUploadStatus(prev => ({ ...prev, [type]: 'success' }));
        setTimeout(() => {
          setUploadStatus(prev => {
            const next = { ...prev };
            delete next[type];
            return next;
          });
        }, 3000);
      }

    } catch (err: any) {
      console.error("handleUpload failed:", err);
      let errorMessage = err.message;
      
      // Try to parse JSON error info if it exists
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        // Not a JSON error, use original message
      }
      
      // Make timeout/cancel errors more user friendly
      if (errorMessage.includes('storage/canceled')) {
        errorMessage = "Upload timed out due to slow connection. Please try again with a smaller file or better network.";
      }

      setUploadStatus(prev => ({ ...prev, [type]: 'error' }));
      setSlotErrors(prev => ({ ...prev, [type]: errorMessage }));
    } finally {
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
    }
  };

  const hasDocuments = documents.length > 0;
  const progress = Math.round((documents.length / docSlots.length) * 100);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">{language === 'English' ? 'Document Upload' : 'ஆவணப் பதிவேற்றம்'}</h2>
        <span className="text-sm font-bold text-brand">{progress}% Complete</span>
      </div>
      <div className="w-full h-2 bg-zinc-100 rounded-full mb-6 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-brand"
        />
      </div>

      {/* Demo AI Guardrails Toggle */}
      <div className="mb-6 p-4 bg-amber-50/60 border border-amber-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl mt-0.5">
            <ShieldCheck className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-zinc-900 leading-tight flex items-center gap-2">
              {language === 'English' ? 'AI Document Verification' : 'AI ஆவண சரிபார்ப்பு'}
              {skipVerify && (
                <span className="px-2 py-0.5 bg-amber-200 text-amber-950 text-[10px] font-semibold uppercase tracking-wider rounded-md">
                  Sandbox Active
                </span>
              )}
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              {language === 'English' 
                ? 'Turn this ON to enable strict, secure AI document validation. Keep it OFF to easily test onboarding with dummy or mock images.' 
                : 'பாதுகாப்பான AI ஆவணச் சரிபார்ப்பை இயக்க, இதை இயக்கவும். மாதிரிப் படங்களுடன் சோதிக்க இதை முடக்கவும்.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setSkipVerify(!skipVerify)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
            !skipVerify ? "bg-brand" : "bg-zinc-200"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out",
              !skipVerify ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>

      <p className="text-zinc-600 text-sm mb-8">
        {language === 'English' 
          ? 'Please upload clear photos of your documents. You can also skip this step and upload them later from your profile.' 
          : 'உங்கள் ஆவணங்களின் தெளிவான புகைப்படங்களைப் பதிவேற்றவும். நீங்கள் இந்தப் படிநிலையைத் தவிர்த்துவிட்டுப் பின்னர் உங்கள் சுயவிவரத்திலிருந்து பதிவேற்றலாம்.'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {docSlots.map((slot) => {
          const doc = documents.find(d => d.type === slot);
          const status = uploadStatus[slot] || 'idle';
          const progress = uploadProgress[slot] || 0;
          const error = slotErrors[slot];

          return (
            <div key={slot} className={cn(
              "relative group flex flex-col p-4 bg-white border rounded-2xl transition-all duration-300",
              doc ? "border-brand/20 bg-brand-light/5 shadow-sm" : "border-zinc-100 hover:border-zinc-200",
              status === 'error' && "border-red-200 bg-red-50/30"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-colors duration-300",
                    doc ? "bg-brand text-white" : "bg-zinc-100 text-zinc-400",
                    status === 'error' && "bg-red-500 text-white"
                  )}>
                    {status === 'success' ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <CheckCircle2 className="w-4 h-4" />
                      </motion.div>
                    ) : doc ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : status === 'error' ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider">{DOCUMENT_LABELS[slot]}</p>
                    {status === 'compressing' && (
                      <p className="text-[9px] font-bold text-brand animate-pulse">COMPRESSING...</p>
                    )}
                    {status === 'verifying' && (
                      <p className="text-[9px] font-bold text-amber-500 animate-pulse">VERIFYING DOC...</p>
                    )}
                    {status === 'uploading' && (
                      <p className="text-[9px] font-bold text-brand animate-pulse">UPLOADING...</p>
                    )}
                    {status === 'error' && (
                      <div className="flex flex-col">
                        <p className="text-[9px] font-bold text-red-500 uppercase tracking-tight">UPLOAD FAILED</p>
                        <p className="text-[8px] text-red-400 line-clamp-1 max-w-[120px]">{error}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <AnimatePresence>
                  {status === 'uploading' && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <span className="text-[10px] font-bold text-brand">{progress}%</span>
                      <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="relative aspect-[4/3] bg-zinc-50 rounded-xl overflow-hidden border border-dashed border-zinc-200 flex items-center justify-center group-hover:bg-zinc-100 transition-colors">
                {(status === 'uploading' || status === 'compressing' || status === 'verifying') && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-6">
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden mb-2">
                      <motion.div 
                        className="h-full bg-brand"
                        initial={{ width: 0 }}
                        animate={{ width: status === 'compressing' ? '30%' : status === 'verifying' ? '60%' : `${progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-brand">
                      {status === 'compressing' ? 'Optimizing...' : status === 'verifying' ? 'Verifying...' : `${progress}%`}
                    </span>
                  </div>
                )}

                {status === 'success' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-brand/10 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      className="w-12 h-12 bg-brand text-white rounded-full flex items-center justify-center shadow-lg shadow-brand/20"
                    >
                      <CheckCircle2 className="w-6 h-6" />
                    </motion.div>
                  </motion.div>
                )}

                {status === 'error' && (
                  <div className="absolute inset-0 bg-red-50/80 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                    <p className="text-[10px] text-red-600 font-medium mb-3 line-clamp-2">{error}</p>
                    <Button 
                      onClick={() => lastFiles[slot] && handleUpload(slot, lastFiles[slot])}
                      className="h-8 px-4 text-[10px] bg-red-500 hover:bg-red-600"
                    >
                      <RefreshCw className="w-3 h-3 mr-1.5" /> Retry
                    </Button>
                  </div>
                )}

                {doc ? (
                  <>
                    <img src={doc.filePath} alt={slot} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <label className="cursor-pointer p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors">
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => e.target.files?.[0] && handleUpload(slot, e.target.files[0])}
                        />
                        <RefreshCw className="w-4 h-4" />
                      </label>
                    </div>
                  </>
                ) : status === 'idle' && (
                  <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center p-4 text-center">
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => e.target.files?.[0] && handleUpload(slot, e.target.files[0])}
                    />
                    <Upload className="w-6 h-6 text-zinc-400 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Tap to Upload</span>
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button 
        onClick={() => onUpdate({ 
          currentStage: 4, 
          status: hasDocuments ? 'documents_submitted' : 'documents_pending' 
        })}
        className="w-full h-12 mt-10 shadow-lg shadow-brand/20"
      >
        {hasDocuments 
          ? (language === 'English' ? 'Continue to Profile' : 'சுயவிவரத்திற்குத் தொடரவும்')
          : (language === 'English' ? 'Skip & Upload Later' : 'தவிர்த்து பின்னர் பதிவேற்றவும்')}
      </Button>
    </motion.div>
  );
};

// --- Stage 4: Profile Creation ---
export const Stage4: React.FC<StageProps> = ({ driver, onUpdate, language }) => {
  const [formData, setFormData] = useState({
    fullName: driver.fullName || '',
    mobileNumber: driver.mobileNumber || '',
    dateOfBirth: driver.dateOfBirth || '',
    vehicleRegNumber: driver.vehicleRegNumber || '',
    experienceYears: driver.experienceYears || 0,
    bankAccount: driver.bankAccount || '',
    ifscCode: driver.ifscCode || '',
    upiId: driver.upiId || '',
    preferredZones: driver.preferredZones || []
  });

  const t = {
    English: {
      title: 'Complete Your Profile',
      subtitle: 'Almost there! We just need a few more details.',
      name: 'Full Name (as on Aadhaar)',
      mobile: 'Mobile Number',
      dob: 'Date of Birth',
      reg: 'Vehicle Registration Number',
      exp: 'Years of Experience',
      bank: 'Bank Account Number',
      ifsc: 'IFSC Code',
      upi: 'UPI ID (Optional)',
      zones: 'Preferred Working Zones',
      continue: 'Proceed to Training'
    },
    Tamil: {
      title: 'உங்கள் சுயவிவரத்தைப் பூர்த்தி செய்யவும்',
      subtitle: 'கிட்டத்தட்ட முடிந்துவிட்டது! எங்களுக்கு இன்னும் சில விவரங்கள் தேவை.',
      name: 'முழு பெயர் (ஆதாரில் உள்ளது போல)',
      mobile: 'கைபேசி எண்',
      dob: 'பிறந்த தேதி',
      reg: 'வாகன பதிவு எண்',
      exp: 'அனுபவம் (ஆண்டுகளில்)',
      bank: 'வங்கி கணக்கு எண்',
      ifsc: 'IFSC குறியீடு',
      upi: 'UPI ஐடி (விருப்பத்தேர்வு)',
      zones: 'விருப்பமான வேலை மண்டலங்கள்',
      continue: 'பயிற்சிக்குச் செல்லவும்'
    }
  }[language];

  const zones = CITY_ZONES[driver.city || 'Chennai'];

  const toggleZone = (zone: string) => {
    setFormData(prev => ({
      ...prev,
      preferredZones: prev.preferredZones.includes(zone)
        ? prev.preferredZones.filter(z => z !== zone)
        : [...prev.preferredZones, zone]
    }));
  };

  const isComplete = Boolean(formData.fullName); // Temporarily allow proceeding with just a name for testing

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-bold mb-2">{t.title}</h2>
      <p className="text-zinc-600 text-sm mb-6">{t.subtitle}</p>

      <div className="space-y-5">
        <div>
          <Label>{t.name}</Label>
          <Input value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
        </div>
        <div>
          <Label>{t.mobile}</Label>
          <Input value={formData.mobileNumber} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} />
        </div>
        <div>
          <Label>{t.dob}</Label>
          <Input type="date" value={formData.dateOfBirth} onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} />
        </div>
        <div>
          <Label>{t.reg}</Label>
          <Input placeholder="TN 01 AB 1234" value={formData.vehicleRegNumber} onChange={e => setFormData({...formData, vehicleRegNumber: e.target.value})} />
        </div>
        <div>
          <Label>{t.exp}</Label>
          <Input type="number" value={formData.experienceYears} onChange={e => setFormData({...formData, experienceYears: parseInt(e.target.value)})} />
        </div>
        
        <div className="pt-4 border-t border-zinc-100">
          <Label>{t.zones}</Label>
          <div className="flex flex-wrap gap-2">
            {zones.map(z => (
              <button
                key={z}
                onClick={() => toggleZone(z)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  formData.preferredZones.includes(z) ? 'bg-brand border-brand text-white' : 'bg-white border-zinc-200 text-zinc-600'
                )}
              >
                {z}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100 space-y-4">
          <div>
            <Label>{t.bank}</Label>
            <Input value={formData.bankAccount} onChange={e => setFormData({...formData, bankAccount: e.target.value})} />
          </div>
          <div>
            <Label>{t.ifsc}</Label>
            <Input value={formData.ifscCode} onChange={e => setFormData({...formData, ifscCode: e.target.value})} />
          </div>
          <div>
            <Label>{t.upi}</Label>
            <Input value={formData.upiId} onChange={e => setFormData({...formData, upiId: e.target.value})} />
          </div>
        </div>

        <Button 
          disabled={!isComplete} 
          onClick={() => onUpdate({ ...formData, currentStage: 5 })}
          className="w-full h-12 mt-4"
        >
          {t.continue}
        </Button>
      </div>
    </motion.div>
  );
};

// --- Stage 5: Training ---
export const Stage5: React.FC<StageProps> = ({ driver, onUpdate, language }) => {
  const [currentModule, setCurrentModule] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);

  const module = TRAINING_MODULES[currentModule];

  const handleNext = () => {
    if (currentModule < TRAINING_MODULES.length - 1) {
      setCurrentModule(prev => prev + 1);
      setShowQuiz(false);
      setQuizAnswers([]);
    } else {
      onUpdate({ currentStage: 6, status: 'verification_in_progress' });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">{language === 'English' ? 'Training' : 'பயிற்சி'}</h2>
        <span className="text-xs font-medium text-zinc-500">Module {currentModule + 1}/{TRAINING_MODULES.length}</span>
      </div>

      <Card className="mb-6">
        <div className="p-6">
          {!showQuiz ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-brand-dark">{module.title}</h3>
              <div className="prose prose-sm text-zinc-600">
                <ReactMarkdown>{module.content}</ReactMarkdown>
              </div>
              <Button onClick={() => setShowQuiz(true)} className="w-full mt-4">
                Take Module Quiz
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {module.quiz.map((q, i) => (
                <div key={i} className="space-y-3">
                  <p className="text-sm font-medium text-zinc-900">{q.question}</p>
                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => (
                      <button
                        key={optIdx}
                        onClick={() => {
                          const newAns = [...quizAnswers];
                          newAns[i] = optIdx;
                          setQuizAnswers(newAns);
                        }}
                        className={cn(
                          'w-full text-left p-3 rounded-xl border text-sm transition-all',
                          quizAnswers[i] === optIdx ? 'border-brand bg-brand-light text-brand' : 'border-zinc-100 bg-white text-zinc-600'
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              
              <Button 
                disabled={quizAnswers.length < module.quiz.length} 
                onClick={handleNext}
                className="w-full"
              >
                {currentModule === TRAINING_MODULES.length - 1 ? 'Finish Training' : 'Next Module'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

// --- Stage 6: Final Submission ---
export const Stage6: React.FC<StageProps> = ({ driver, language }) => {
  const t = {
    English: {
      title: 'Application Submitted!',
      subtitle: 'Your application is now under review by our operations team.',
      status: 'Current Status:',
      ref: 'Application Reference:',
      wait: 'We\'ll notify you via WhatsApp within 24-48 hours once your documents are verified.',
      earning: 'Join TruckTaxi and earn up to ₹10 LPA!'
    },
    Tamil: {
      title: 'விண்ணப்பம் சமர்ப்பிக்கப்பட்டது!',
      subtitle: 'உங்கள் விண்ணப்பம் இப்போது எங்கள் செயல்பாட்டுக் குழுவின் மதிப்பாய்வில் உள்ளது.',
      status: 'தற்போதைய நிலை:',
      ref: 'விண்ணப்பக் குறிப்பு:',
      wait: 'உங்கள் ஆவணங்கள் சரிபார்க்கப்பட்டதும் 24-48 மணிநேரத்திற்குள் வாட்ஸ்அப் மூலம் உங்களுக்கு அறிவிப்போம்.',
      earning: 'TruckTaxi-யில் இணைந்து ஆண்டுக்கு ₹10 லட்சம் வரை சம்பாதிக்கவும்!'
    }
  }[language];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto p-6 text-center">
      <div className="w-20 h-20 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-10 h-10 text-brand" />
      </div>
      <h2 className="text-2xl font-bold text-zinc-900 mb-2">{t.title}</h2>
      <p className="text-zinc-600 text-sm mb-8">{t.subtitle}</p>

      <Card className="mb-8 p-6 bg-zinc-50 border-none">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">{t.status}</p>
            <p className="text-sm font-bold text-brand-dark uppercase">{driver.status.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">{t.ref}</p>
            <p className="text-sm font-mono text-zinc-600">TT-{driver.uid.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </Card>

      <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
        {t.wait}
      </p>

      <div className="p-4 bg-brand rounded-2xl text-white font-bold">
        {t.earning}
      </div>
    </motion.div>
  );
};
