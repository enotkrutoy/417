
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { JURISDICTIONS, PRESETS } from './constants';
import { Jurisdiction, DLFormData, DLDataPreset } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import { validateAAMVAStructure } from './utils/validator';
import BarcodeSVG from './components/BarcodeSVG';
import { 
  ArrowLeft, Camera, Search, User, 
  ShieldCheck, Check, Info, Heart, AlertCircle, Zap, 
  Activity, Terminal, Printer, Edit3, Loader2,
  FileCode, Database, RefreshCcw, Copy, Layout,
  Hash, Calendar, MapPin, Ruler, Eye, Briefcase,
  AlertTriangle, Fingerprint, Shield, Box, Layers,
  FileText, CreditCard, Sparkles, BrainCircuit, Image as ImageIcon
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'SELECT' | 'FORM' | 'RESULT'>('SELECT');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationStatus, setCompilationStatus] = useState("");
  const [compilationTime, setCompilationTime] = useState("");
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [scanStatusMsg, setScanStatusMsg] = useState("");
  const [scanAttempt, setScanAttempt] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState<'BASIC' | 'ADVANCED'>('BASIC');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<DLFormData>({
    IIN: '', Version: '10', JurisdictionVersion: '00', subfileType: 'DL',
    DCA: 'C', DCB: 'NONE', DCD: 'NONE', DBA: '', DCS: '', DAC: '', DAD: '',
    DBD: '', DBB: '', DBC: '1', DAY: 'BRO', DAU: '5-09',
    DAG: '', DAI: '', DAJ: '', DAK: '', DAQ: '', DCF: '', DCG: 'USA', 
    DAH: '', DAZ: 'BRO', DCI: '', DCJ: '', DCK: '', DBN: '', DBG: '',
    DBS: '', DCU: '', DCE: '', DCL: '', DCM: '', DCN: '', DCO: '',
    DCP: '', DCQ: '', DCR: '', DDA: 'F', DDB: '', DDC: '', DDD: '0',
    DAW: '', DAX: '', DDH: '', DDI: '', DDJ: '', DDK: '0', DDL: '0',
    DDE: 'N', DDF: 'N', DDG: 'N'
  });

  const generatedString = useMemo(() => generateAAMVAString(formData), [formData]);
  const validation = useMemo(() => validateAAMVAStructure(generatedString, formData), [generatedString, formData]);

  useEffect(() => {
    if (step === 'RESULT') {
      const safeId = (formData.DAQ || 'AAMVA').replace(/[^a-zA-Z0-9]/g, '');
      const safeTime = compilationTime ? compilationTime.replace(/[:\/, ]/g, '_').replace(/_{2,}/g, '_') : 'NEW';
      document.title = `AAMVA_${safeId}_${safeTime}`;
    } else {
      document.title = "AAMVA Barcode Pro";
    }
  }, [step, formData.DAQ, compilationTime]);

  const handleApplyPreset = (preset: DLDataPreset) => {
    setFormData(prev => ({ ...prev, ...preset.data }));
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    const steps = ["Initial Setup...", "Mapping Tags...", "Generating Matrix..."];
    for (const s of steps) {
      setCompilationStatus(s);
      await new Promise(r => setTimeout(r, 200));
    }
    
    const now = new Date();
    setCompilationTime(now.toLocaleString('en-US', { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
    }));
    
    setIsCompiling(false);
    setStep('RESULT');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedString);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handlePrint = () => window.print();

  const handleSelectJurisdiction = (jur: Jurisdiction) => {
    setSelectedJurisdiction(jur);
    setFormData(prev => ({ 
      ...prev, DAJ: jur.code, IIN: jur.iin, Version: jur.version || '10', DCG: jur.country || 'USA'
    }));
    setStep('FORM');
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setScanError(null);
    setScanAttempt(1);
    try {
      const base64 = await preprocessImage(file);
      setScannedImage(`data:image/jpeg;base64,${base64}`);
      const updates = await scanDLWithGemini(base64, (msg) => setScanStatusMsg(msg));
      let detectedJur = updates.DAJ ? detectJurisdictionFromCode(updates.DAJ) : null;
      if (detectedJur) {
        setSelectedJurisdiction(detectedJur);
        setFormData(prev => ({ ...prev, ...updates, IIN: detectedJur.iin, DAJ: detectedJur.code, DCG: detectedJur.country || 'USA' }));
      } else {
        setFormData(prev => ({ ...prev, ...updates }));
      }
      setStep('FORM');
    } catch (err: any) {
      setScanError(err.message || "DSPy Neural Link Failed");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const InputField = ({ label, tag, placeholder = "", type = "text", maxLength = 100 }: { label: string, tag: string, placeholder?: string, type?: string, maxLength?: number }) => {
    const fieldValidation = validation.fields.find(f => f.elementId === tag);
    const hasError = fieldValidation?.status && fieldValidation.status !== 'MATCH';
    return (
      <div className="space-y-1.5 group">
        <div className="flex justify-between items-center px-1">
          <label className={`text-[10px] font-black uppercase tracking-widest transition-colors italic ${hasError ? 'text-rose-400' : 'text-slate-500 group-focus-within:text-sky-400'}`}>{label}</label>
          <span className={`text-[8px] font-mono opacity-0 group-focus-within:opacity-100 transition-opacity ${hasError ? 'text-rose-500' : 'text-slate-600'}`}>{tag}</span>
        </div>
        <div className="relative">
          <input type={type} value={formData[tag] || ""} placeholder={placeholder} maxLength={maxLength} onChange={e => setFormData({...formData, [tag]: e.target.value.toUpperCase()})} className={`w-full bg-slate-950/40 border rounded-2xl p-4 text-sm font-bold outline-none transition-all placeholder:text-slate-700 ${hasError ? 'border-rose-500/50 bg-rose-500/5 focus:bg-rose-500/10' : 'border-white/5 focus:border-sky-500/50 focus:bg-slate-950/80'}`} />
          {hasError && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500 animate-pulse"><AlertCircle size={16} /></div>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      {isCompiling && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-sky-500/10 border-t-sky-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center"><BrainCircuit size={32} className="text-sky-500 animate-pulse fill-sky-500/20" /></div>
           </div>
           <h4 className="text-2xl font-black italic tracking-tighter text-white max-w-xs text-center">{compilationStatus}</h4>
        </div>
      )}

      <header className="bg-slate-900/40 border-b border-white/5 backdrop-blur-2xl px-6 py-4 flex justify-between items-center sticky top-0 z-50 no-print">
        <div className="flex items-center gap-4">
          {step !== 'SELECT' && <button onClick={() => setStep('SELECT')} className="p-2 hover:bg-white/10 rounded-xl transition-all text-sky-400"><ArrowLeft size={20}/></button>}
          <div className="flex items-center gap-3">
            <div className="bg-sky-600 p-1.5 rounded-lg shadow-[0_0_15px_rgba(14,165,233,0.3)]"><Zap size={18} className="text-white fill-white" /></div>
            <h1 className="text-base font-black tracking-tight uppercase">MATRIX <span className="text-sky-500 italic">PRO 2025</span></h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 relative z-10 print:p-0 print:max-w-none">
        {step === 'SELECT' && (
          <div className="max-w-4xl mx-auto space-y-12 py-10 no-print">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest"><ShieldCheck size={14}/> AAMVA 2020 Compliance Engine</div>
              <h2 className="text-6xl sm:text-8xl font-black tracking-tighter italic">DSPy Pipeline</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="group relative bg-slate-900/50 border border-white/5 rounded-[3rem] p-10 transition-all cursor-pointer hover:border-sky-500/40" onClick={() => !isScanning && fileInputRef.current?.click()}>
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 bg-sky-500/10 border border-sky-500/20`}>{isScanning ? <Loader2 size={32} className="text-sky-500 animate-spin" /> : <Camera className="text-sky-500" size={32} />}</div>
                <h3 className="text-3xl font-black italic">{isScanning ? 'Scanning...' : 'Neural Scan'}</h3>
                <p className="text-slate-400 text-sm italic mt-2">{scanStatusMsg || 'Extract data automatically.'}</p>
                <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*" />
              </div>
              <div className="bg-slate-900/30 border border-white/5 rounded-[3rem] p-10 flex flex-col">
                <h3 className="text-3xl font-black mb-8 italic">Jurisdiction</h3>
                <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
                  {JURISDICTIONS.map(j => (
                    <button key={j.name} onClick={() => handleSelectJurisdiction(j)} className="bg-slate-800/40 hover:bg-sky-600 border border-white/5 p-3 rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-colors">
                      <span className="text-sky-400 italic">{j.code}</span>
                      <span className="text-[7px] text-slate-500 uppercase truncate w-full text-center">{j.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 no-print">
            <div className="lg:col-span-8 bg-slate-900/60 rounded-[3.5rem] p-8 sm:p-12 border border-white/5 shadow-2xl space-y-10 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-white/5 pb-10">
                <div className="flex items-center gap-6">
                   <div className="bg-sky-500/10 p-5 rounded-[1.5rem] border border-sky-500/20"><User className="text-sky-500" size={40} /></div>
                   <div>
                    <h3 className="text-4xl font-black italic">{selectedJurisdiction?.name}</h3>
                    <div className="flex items-center gap-3 mt-2"><span className="bg-sky-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black italic uppercase">V.{formData.Version} REV</span></div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InputField label="Family Name" tag="DCS" />
                <InputField label="First Name" tag="DAC" />
                <InputField label="ID Number" tag="DAQ" />
                <InputField label="Birth Date" tag="DBB" placeholder="YYYYMMDD" maxLength={8} />
                <InputField label="Expiration Date" tag="DBA" placeholder="YYYYMMDD" maxLength={8} />
                <InputField label="City" tag="DAI" />
                <InputField label="State" tag="DAJ" maxLength={2} />
                <InputField label="Zip Code" tag="DAK" maxLength={11} />
              </div>
              <button onClick={handleCompile} className="w-full bg-sky-600 hover:bg-sky-500 py-6 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 group italic transition-all"><FileCode size={24} /> COMPILE MATRIX</button>
            </div>
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-8 shadow-xl">
                 <div className="flex items-center justify-between"><h4 className="text-[10px] font-black text-sky-500 uppercase italic">Kernel Validation</h4><span className={`text-2xl font-black italic ${validation.overallScore > 90 ? 'text-emerald-500' : 'text-amber-500'}`}>{validation.overallScore}%</span></div>
                 <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${validation.overallScore > 90 ? 'bg-emerald-500' : 'bg-sky-600'}`} style={{ width: `${validation.overallScore}%` }} /></div>
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="flex justify-between items-end border-b border-white/5 pb-8 no-print">
              <div className="space-y-2">
                <h2 className="text-4xl font-black tracking-tighter italic">Compiled Bitstream</h2>
                <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 italic uppercase">Node Verified</span>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep('FORM')} className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest transition-all italic"><Edit3 size={18} /> Edit</button>
                <button onClick={handlePrint} className="flex items-center gap-2 px-8 py-4 bg-sky-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all italic shadow-lg shadow-sky-600/20"><Printer size={18} /> Print PDF</button>
              </div>
            </div>

            <div className="flex flex-col print:gap-0">
               {/* PAGE 1: Source Document Reference */}
               {scannedImage && (
                 <div className="bg-white rounded-[4rem] p-12 text-slate-950 flex flex-col items-center justify-center min-h-[70vh] shadow-2xl border-4 border-slate-200 relative overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:min-h-0 print:h-[100vh] print:page-break-after-always">
                    <div className="w-full flex flex-col items-center gap-6 max-h-full">
                        <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-2 border-slate-100 rounded-full">
                           <ImageIcon size={18} className="text-sky-600" />
                           <span className="text-xs font-black text-slate-800 uppercase tracking-widest italic">SOURCE DOCUMENT REFERENCE</span>
                        </div>
                        <div className="max-w-2xl w-full bg-slate-50 p-4 rounded-[3rem] border-2 border-slate-100 overflow-hidden flex items-center justify-center">
                          <img src={scannedImage} alt="Reference" className="w-auto max-h-[70vh] object-contain rounded-[2rem]" />
                        </div>
                        <div className="text-center mt-2">
                          <p className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400">REFERENCE: {formData.DAQ || "AAMVA_MASTER"}</p>
                          <p className="text-[9px] font-mono font-bold text-slate-300">{compilationTime}</p>
                        </div>
                    </div>
                 </div>
               )}

               {/* PAGE 2: Barcode & Metadata */}
               <div className="bg-white rounded-[4rem] p-12 text-slate-950 flex flex-col items-center justify-center min-h-[70vh] shadow-2xl border-4 border-slate-200 relative overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:min-h-0 print:h-[100vh] print:page-break-before-always">
                  <div className="text-center space-y-3 w-full">
                    <h3 className="text-5xl font-black tracking-tighter uppercase italic text-slate-900 flex flex-col items-center gap-2">
                      <span>{formData.DAQ || "AAMVA_MASTER"}</span>
                      <span className="text-xs font-mono font-bold text-slate-400 tracking-[0.2em] italic">GENERATED: {compilationTime}</span>
                    </h3>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono italic">AAMVA_2020_REV_1</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest font-mono italic">{selectedJurisdiction?.code} NODE</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-8 w-full mt-10"><BarcodeSVG data={generatedString} /></div>
               </div>
            </div>

            <div className="bg-slate-900/50 border border-white/5 p-10 rounded-[3.5rem] no-print">
               <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3"><Terminal size={16} className="text-sky-400" /><h4 className="text-[11px] font-black text-slate-500 uppercase italic tracking-widest">Raw Bitstream</h4></div>
                  <button onClick={handleCopy} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${copyFeedback ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{copyFeedback ? <Check size={14} /> : <Copy size={14} />} {copyFeedback ? 'COPIED' : 'COPY RAW'}</button>
               </div>
               <div className="bg-slate-950 p-6 rounded-[2rem] font-mono text-[10px] break-all leading-relaxed text-sky-400/80 max-h-[200px] overflow-y-auto custom-scrollbar select-all">{generatedString}</div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        
        @media print {
          @page {
            size: auto;
            margin: 0mm;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
          }
          .no-print { display: none !important; }
          main { 
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
          .bg-white { 
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 40px !important;
            border: none !important;
            box-shadow: none !important;
          }
          .print\\:page-break-after-always {
            page-break-after: always !important;
            break-after: page !important;
          }
          .print\\:page-break-before-always {
            page-break-before: always !important;
            break-before: page !important;
          }
          img {
            max-width: 100% !important;
            max-height: 80vh !important;
            object-contain: contain;
          }
          canvas {
             image-rendering: pixelated;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
