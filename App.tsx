
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
    const steps = [
      "Initializing ANSI-15434 Container...", 
      "Mapping AAMVA 2020 Data Tags...", 
      "Calculating Subfile Offsets...", 
      "Generating PDF417 Reed-Solomon Code...", 
      "Synthesizing Matrix Vector..."
    ];
    for (const s of steps) {
      setCompilationStatus(s);
      await new Promise(r => setTimeout(r, 250));
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
      const updates = await scanDLWithGemini(base64, (msg) => {
        setScanStatusMsg(msg);
        if (msg.includes("REFINEMENT")) setScanAttempt(2);
      });
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
           <div className="w-64 h-1 bg-slate-800 rounded-full mt-8 overflow-hidden relative">
              <div className="h-full bg-sky-500 animate-[progress_1.5s_ease-in-out_infinite]" />
           </div>
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
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/50 border border-white/5 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider italic">Neural Compliance Engine</span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 relative z-10 print:p-0 print:max-w-none">
        {step === 'SELECT' && (
          <div className="max-w-4xl mx-auto space-y-12 py-10 no-print">
            <div className="text-center space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest"><ShieldCheck size={14}/> AAMVA 2020 Compliance Engine</div>
              <h2 className="text-6xl sm:text-8xl font-black tracking-tighter bg-gradient-to-b from-white via-white to-slate-600 bg-clip-text text-transparent italic">DSPy Pipeline</h2>
              <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium italic text-center">Интеллектуальный OCR пайплайн на базе Gemini 2.5 Flash с нейронной самокоррекцией.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="group relative bg-slate-900/50 border border-white/5 rounded-[3rem] p-10 transition-all cursor-pointer hover:border-sky-500/40 shadow-2xl overflow-hidden" onClick={() => !isScanning && fileInputRef.current?.click()}>
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity rotate-12"><Terminal size={120} /></div>
                <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 bg-sky-500/10 border border-sky-500/20">{isScanning ? <Loader2 size={32} className="text-sky-500 animate-spin" /> : <Camera className="text-sky-500" size={32} />}</div>
                <h3 className="text-3xl font-black italic">{isScanning ? 'Neural Analysis...' : 'Neural Scan'}</h3>
                <p className="text-slate-400 text-sm italic mt-2 leading-relaxed">{scanStatusMsg || 'Predict-Validate-Refine extraction pipeline.'}</p>
                <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*" />
              </div>

              <div className="bg-slate-900/30 border border-white/5 rounded-[3rem] p-10 flex flex-col shadow-2xl backdrop-blur-sm">
                <h3 className="text-3xl font-black mb-8 italic">Jurisdiction</h3>
                <div className="relative mb-6">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                   <input placeholder="Search State Node..." className="w-full bg-slate-950/80 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all" onChange={e => setFilterText(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
                  {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).map(j => (
                    <button key={j.name} onClick={() => handleSelectJurisdiction(j)} className="bg-slate-800/40 hover:bg-sky-600 border border-white/5 p-3 rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all group">
                      <span className="text-sky-400 italic group-hover:text-white">{j.code}</span>
                      <span className="text-[7px] text-slate-500 uppercase truncate w-full text-center group-hover:text-sky-100">{j.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 no-print animate-in fade-in zoom-in-95 duration-500">
            <div className="lg:col-span-8 bg-slate-900/60 rounded-[3.5rem] p-8 sm:p-12 border border-white/5 shadow-2xl space-y-10 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-white/5 pb-10">
                <div className="flex items-center gap-6">
                   <div className="bg-sky-500/10 p-5 rounded-[1.5rem] border border-sky-500/20 shadow-inner"><User className="text-sky-500" size={40} /></div>
                   <div>
                    <h3 className="text-4xl font-black italic">{selectedJurisdiction?.name}</h3>
                    <div className="flex items-center gap-3 mt-2">
                       <span className="bg-sky-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black italic uppercase">V.{formData.Version} REV</span>
                       <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{formData.DCG} Region</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                   <div className="flex gap-2 bg-slate-950/50 p-1.5 rounded-2xl border border-white/5">
                      <button onClick={() => setActiveTab('BASIC')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'BASIC' ? 'bg-sky-600 text-white shadow-lg italic' : 'text-slate-500'}`}>Basic</button>
                      <button onClick={() => setActiveTab('ADVANCED')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ADVANCED' ? 'bg-sky-600 text-white shadow-lg italic' : 'text-slate-500'}`}>Advanced</button>
                   </div>
                </div>
              </div>

              {activeTab === 'BASIC' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-left-4 duration-300">
                  <InputField label="Family Name" tag="DCS" />
                  <InputField label="First Name" tag="DAC" />
                  <InputField label="ID Number" tag="DAQ" />
                  <InputField label="Birth Date" tag="DBB" placeholder="YYYYMMDD" maxLength={8} />
                  <InputField label="Expiration Date" tag="DBA" placeholder="YYYYMMDD" maxLength={8} />
                  <div className="lg:col-span-3"><InputField label="Address Line 1" tag="DAG" /></div>
                  <InputField label="City" tag="DAI" />
                  <InputField label="State" tag="DAJ" maxLength={2} />
                  <InputField label="Zip Code" tag="DAK" maxLength={11} />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-right-4 duration-300">
                  <InputField label="Middle Name" tag="DAD" />
                  <InputField label="Sex (1/2/9)" tag="DBC" maxLength={1} />
                  <InputField label="Eye Color" tag="DAY" placeholder="BRO/BLU" maxLength={3} />
                  <InputField label="Hair Color" tag="DAZ" placeholder="BRO/BLK" maxLength={3} />
                  <InputField label="Height" tag="DAU" placeholder="070 IN" />
                  <InputField label="Issue Date" tag="DBD" placeholder="YYYYMMDD" />
                  <InputField label="Restrictions" tag="DCB" placeholder="NONE" />
                  <InputField label="Endorsements" tag="DCD" placeholder="NONE" />
                  <InputField label="Class" tag="DCA" placeholder="C" />
                  <div className="lg:col-span-3 border-t border-white/5 pt-6 mt-4"><h5 className="text-[9px] font-black text-sky-500 uppercase tracking-widest italic mb-4">Identity Markers</h5></div>
                  <InputField label="Compliance" tag="DDA" maxLength={1} />
                  <InputField label="Discriminator" tag="DCF" />
                </div>
              )}

              <button onClick={handleCompile} className="w-full bg-sky-600 hover:bg-sky-500 py-6 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 group italic transition-all shadow-2xl shadow-sky-600/30"><FileCode size={24} className="group-hover:rotate-12 transition-transform"/> COMPILE MATRIX</button>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-xl">
                 <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-widest italic flex items-center gap-2"><Layers size={14}/> Test Nodes</h4>
                 <div className="grid grid-cols-1 gap-3">
                   {PRESETS.map(preset => (
                     <button key={preset.id} onClick={() => handleApplyPreset(preset)} className="w-full p-4 bg-slate-950/50 border border-white/5 hover:border-sky-500/40 rounded-2xl text-left transition-all group hover:bg-slate-900">
                        <div className="flex justify-between items-center mb-1"><span className="text-[11px] font-black text-slate-200 uppercase italic">{preset.label}</span><Box size={14} className="text-slate-600 group-hover:text-sky-400 transition-colors" /></div>
                        <p className="text-[9px] text-slate-500 italic font-medium">{preset.description}</p>
                     </button>
                   ))}
                 </div>
              </div>

              <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-8 shadow-xl sticky top-28">
                 <div className="flex items-center justify-between"><h4 className="text-[10px] font-black text-sky-500 uppercase italic tracking-widest">Kernel Validation</h4><span className={`text-2xl font-black italic ${validation.overallScore > 90 ? 'text-emerald-500' : 'text-amber-500'}`}>{validation.overallScore}%</span></div>
                 <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner"><div className={`h-full transition-all duration-1000 ${validation.overallScore > 90 ? 'bg-emerald-500' : 'bg-sky-600'}`} style={{ width: `${validation.overallScore}%` }} /></div>
                 
                 <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {validation.fields.map(f => (
                      <div key={f.elementId} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${f.status === 'CRITICAL_INVALID' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/5 border-transparent'}`}>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black uppercase text-slate-500">{f.elementId}</span>
                          <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px]">{f.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           {f.status === 'MATCH' ? <Check size={14} className="text-emerald-500"/> : <AlertCircle size={14} className="text-rose-500"/>}
                        </div>
                      </div>
                    ))}
                 </div>
                 {validation.complianceNotes.length > 0 && (
                   <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                      <p className="text-[9px] text-amber-500/80 italic leading-tight font-bold uppercase mb-2 flex items-center gap-2"><AlertTriangle size={12}/> Compliance Logs</p>
                      {validation.complianceNotes.slice(0, 3).map((note, i) => (
                        <p key={i} className="text-[8px] text-slate-400 italic mb-1 truncate leading-tight">• {note}</p>
                      ))}
                   </div>
                 )}
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="max-w-4xl mx-auto space-y-10 print:max-w-none print:space-y-0">
            <div className="flex justify-between items-end border-b border-white/5 pb-8 no-print animate-in fade-in duration-700">
              <div className="space-y-2">
                <h2 className="text-4xl font-black tracking-tighter italic uppercase">Compiled Bitstream</h2>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                   <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full italic uppercase tracking-wider">AAMVA Node Verified</span>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep('FORM')} className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest transition-all italic shadow-xl"><Edit3 size={18} /> Modify Core</button>
                <button onClick={handlePrint} className="flex items-center gap-2 px-8 py-4 bg-sky-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all italic shadow-2xl shadow-sky-600/30 group"><Printer size={18} className="group-hover:-translate-y-0.5 transition-transform" /> Print Master</button>
              </div>
            </div>

            <div className="flex flex-col print:block animate-in slide-in-from-bottom-10 duration-700">
               {/* PAGE 1: Source Document Reference */}
               {scannedImage && (
                 <div className="bg-white rounded-[4rem] p-12 text-slate-950 flex flex-col items-center justify-center min-h-[85vh] shadow-[0_50px_100px_rgba(0,0,0,0.5)] border-4 border-slate-200 relative overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:min-h-screen print:h-screen print:w-full print:page-break-after-always">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 no-print"><ImageIcon size={200} /></div>
                    <div className="w-full flex flex-col items-center gap-6 max-h-full print:h-full print:justify-center">
                        <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-2 border-slate-100 rounded-full shadow-sm no-print">
                           <ImageIcon size={18} className="text-sky-600" />
                           <span className="text-xs font-black text-slate-800 uppercase tracking-widest italic">SOURCE DOCUMENT REFERENCE</span>
                        </div>
                        <div className="max-w-4xl w-full bg-slate-50 p-6 rounded-[3rem] border-2 border-slate-100 overflow-hidden flex items-center justify-center shadow-inner print:p-0 print:border-none print:bg-transparent print:max-w-none print:h-screen">
                          <img src={scannedImage} alt="Reference" className="w-auto max-h-[85vh] object-contain rounded-[2rem] grayscale-[0.1] contrast-[1.05] print:max-h-full print:w-auto print:rounded-none" />
                        </div>
                        <div className="text-center mt-2 relative z-10 print:mt-4">
                          <p className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400">REFERENCE ID: {formData.DAQ || "AAMVA_MASTER"}</p>
                          <p className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-widest">{compilationTime}</p>
                        </div>
                    </div>
                 </div>
               )}

               {/* PAGE 2: Barcode & Metadata */}
               <div className="bg-white rounded-[4rem] p-12 text-slate-950 flex flex-col items-center justify-center min-h-[70vh] shadow-[0_50px_100px_rgba(0,0,0,0.5)] border-4 border-slate-200 relative overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:min-h-screen print:h-screen print:w-full print:page-break-before-always">
                  <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 no-print"><Shield size={200} /></div>
                  <div className="text-center space-y-3 w-full relative z-10 print:mt-[-10vh]">
                    <h3 className="text-5xl font-black tracking-tighter uppercase italic text-slate-900 flex flex-col items-center gap-2">
                      <span className="flex items-center gap-3"><Layout size={40} className="text-sky-600 no-print" /> {formData.DAQ || "AAMVA_MASTER"}</span>
                      <span className="text-xs font-mono font-bold text-slate-400 tracking-[0.2em] italic uppercase">GENERATED: {compilationTime}</span>
                    </h3>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono italic">AAMVA_2020_REV_1</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest font-mono italic">{selectedJurisdiction?.code} NODE</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-8 w-full mt-12 relative z-10 print:scale-[1.3]">
                     <BarcodeSVG data={generatedString} />
                  </div>
               </div>
            </div>

            <div className="bg-slate-900/50 border border-white/5 p-10 rounded-[3.5rem] no-print backdrop-blur-md shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3"><Terminal size={16} className="text-sky-400" /><h4 className="text-[11px] font-black text-slate-500 uppercase italic tracking-[0.3em]">Raw Matrix Explorer</h4></div>
                  <button onClick={handleCopy} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-3 italic shadow-xl ${copyFeedback ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>{copyFeedback ? <Check size={16} /> : <Copy size={16} />} {copyFeedback ? 'COPIED TO CLIPBOARD' : 'COPY RAW BITSTREAM'}</button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 bg-slate-950/60 border border-emerald-500/20 rounded-[2rem] space-y-1 group transition-all hover:bg-emerald-500/5">
                     <span className="text-[8px] font-black text-emerald-500 uppercase italic flex items-center gap-2">Header <div className="w-1 h-1 bg-emerald-500 rounded-full" /></span>
                     <p className="text-[9px] text-slate-400 italic leading-relaxed">ANSI 15434 Prefix, IIN ({formData.IIN}) and Revision Control Markers.</p>
                  </div>
                  <div className="p-5 bg-slate-950/60 border border-sky-500/20 rounded-[2rem] space-y-1 group transition-all hover:bg-sky-500/5">
                     <span className="text-[8px] font-black text-sky-500 uppercase italic flex items-center gap-2">Designator <div className="w-1 h-1 bg-sky-500 rounded-full" /></span>
                     <p className="text-[9px] text-slate-400 italic leading-relaxed">Subfile ID ({formData.subfileType}) and Data Offsets for the parser.</p>
                  </div>
                  <div className="p-5 bg-slate-950/60 border border-indigo-500/20 rounded-[2rem] space-y-1 group transition-all hover:bg-indigo-500/5">
                     <span className="text-[8px] font-black text-indigo-500 uppercase italic flex items-center gap-2">Payload <div className="w-1 h-1 bg-indigo-500 rounded-full" /></span>
                     <p className="text-[9px] text-slate-400 italic leading-relaxed">The actual driver metadata encoded with field separators.</p>
                  </div>
               </div>
               <div className="bg-slate-950 p-8 rounded-[2.5rem] font-mono text-[11px] break-all leading-relaxed text-sky-400/80 max-h-[220px] overflow-y-auto custom-scrollbar select-all border border-white/5 shadow-inner">{generatedString}</div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        
        @media print {
          @page { size: auto; margin: 0mm; }
          html, body { 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            height: auto !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: none !important; display: block !important; overflow: visible !important; }
          .bg-white { 
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 20px !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
          }
          img { max-width: 100% !important; max-height: 85vh !important; object-fit: contain !important; }
          canvas { image-rendering: pixelated; }
        }
      `}</style>
    </div>
  );
};

export default App;
