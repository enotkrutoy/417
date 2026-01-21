
import React, { useState, useRef, useMemo } from 'react';
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
  FileText, CreditCard
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'SELECT' | 'FORM' | 'RESULT'>('SELECT');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationStatus, setCompilationStatus] = useState("");
  const [retryCount, setRetryCount] = useState(0);
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

  const handleApplyPreset = (preset: DLDataPreset) => {
    setFormData(prev => ({ ...prev, ...preset.data }));
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    const steps = ["Initializing ANSI Engine...", "Mapping Tags...", "Calculating Offsets...", "Applying PDF417 Logic...", "Finalizing Matrix..."];
    for (const s of steps) {
      setCompilationStatus(s);
      await new Promise(r => setTimeout(r, 250));
    }
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
      ...prev, 
      DAJ: jur.code, IIN: jur.iin, 
      Version: jur.version || '10', DCG: jur.country || 'USA'
    }));
    setStep('FORM');
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const base64 = await preprocessImage(file);
      const updates = await scanDLWithGemini(base64, (c) => setRetryCount(c));
      
      let detectedJur = updates.DAJ ? detectJurisdictionFromCode(updates.DAJ) : null;
      if (detectedJur) {
        setSelectedJurisdiction(detectedJur);
        setFormData(prev => ({ 
          ...prev, 
          ...updates, 
          IIN: detectedJur.iin, 
          DAJ: detectedJur.code,
          DCG: detectedJur.country || 'USA'
        }));
      } else {
        setFormData(prev => ({ ...prev, ...updates }));
      }
      setStep('FORM');
    } catch (err: any) {
      setScanError(err.message || "OCR Node Error");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const InputField = ({ label, tag, placeholder = "", type = "text", maxLength = 100 }: { label: string, tag: string, placeholder?: string, type?: string, maxLength?: number }) => (
    <div className="space-y-1.5 group">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-focus-within:text-sky-400 transition-colors italic">{label}</label>
        <span className="text-[8px] font-mono text-slate-600 opacity-0 group-focus-within:opacity-100 transition-opacity">{tag}</span>
      </div>
      <input 
        type={type}
        value={formData[tag] || ""} 
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={e => setFormData({...formData, [tag]: e.target.value.toUpperCase()})} 
        className="w-full bg-slate-950/40 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 focus:bg-slate-950/80 transition-all placeholder:text-slate-700" 
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      {isCompiling && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="relative mb-8">
              <div className="w-20 h-20 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Zap size={24} className="text-sky-500 animate-pulse fill-sky-500" />
              </div>
           </div>
           <h4 className="text-2xl font-black italic tracking-tighter text-white">{compilationStatus}</h4>
           <div className="w-48 h-1 bg-slate-800 rounded-full mt-6 overflow-hidden">
              <div className="h-full bg-sky-500 animate-[progress_1.5s_ease-in-out_infinite]" />
           </div>
        </div>
      )}

      <header className="bg-slate-900/40 border-b border-white/5 backdrop-blur-2xl px-6 py-4 flex justify-between items-center sticky top-0 z-50 no-print">
        <div className="flex items-center gap-4">
          {step !== 'SELECT' && (
            <button onClick={() => setStep('SELECT')} className="p-2 hover:bg-white/10 rounded-xl transition-all text-sky-400">
              <ArrowLeft size={20}/>
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="bg-sky-600 p-1.5 rounded-lg shadow-[0_0_15px_rgba(14,165,233,0.3)]">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <h1 className="text-base font-black tracking-tight uppercase">MATRIX <span className="text-sky-500 italic">PRO 2025</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/50 border border-white/5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Neural Link Active</span>
           </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 relative z-10 print:p-0">
        {step === 'SELECT' && (
          <div className="max-w-4xl mx-auto space-y-12 py-10 no-print">
            <div className="text-center space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest">
                <ShieldCheck size={14}/> AAMVA 2020 Compliance Engine
              </div>
              <h2 className="text-6xl sm:text-8xl font-black tracking-tighter bg-gradient-to-b from-white via-white to-slate-600 bg-clip-text text-transparent italic">Vector Kernel</h2>
              <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium italic">Профессиональный генератор PDF417 для водительских удостоверений США и Канады.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div 
                className={`group relative bg-slate-900/50 border rounded-[3rem] p-10 transition-all cursor-pointer shadow-2xl overflow-hidden ${isScanning ? 'border-sky-500/50' : scanError ? 'border-rose-500/40' : 'border-white/5 hover:border-sky-500/40'}`}
                onClick={() => !isScanning && fileInputRef.current?.click()}
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity rotate-12"><Terminal size={180} /></div>
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 border transition-colors ${isScanning ? 'bg-sky-500/20 border-sky-500/40' : 'bg-sky-500/10 border-sky-500/20'}`}>
                  {isScanning ? <Loader2 size={32} className="text-sky-500 animate-spin" /> : <Camera className="text-sky-500" size={32} />}
                </div>
                <h3 className="text-3xl font-black mb-3 italic">{isScanning ? 'Neural Scan...' : 'Vision Node'}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-10 font-medium italic">
                  {isScanning ? `Extracting data... Attempt ${retryCount}/2` : 'Мгновенное распознавание DL через Gemini-3 Vision.'}
                </p>
                <div className="flex items-center gap-3 text-sky-400 text-xs font-black uppercase tracking-[0.2em]">
                  {scanError ? 'SCAN FAILED - RETRY' : 'INITIATE CAPTURE'} <RefreshCcw size={16} className={isScanning ? 'animate-spin' : ''}/>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*" />
              </div>

              <div className="bg-slate-900/30 border border-white/5 rounded-[3rem] p-10 flex flex-col shadow-2xl backdrop-blur-sm">
                <h3 className="text-3xl font-black mb-8 flex items-center gap-3 italic">Jurisdiction</h3>
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  <input 
                    placeholder="Search State Node..." 
                    className="w-full bg-slate-950/80 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all" 
                    onChange={e => setFilterText(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
                  {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).map(j => (
                    <button key={j.name} onClick={() => handleSelectJurisdiction(j)} className="group bg-slate-800/40 hover:bg-sky-600 border border-white/5 p-3 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1">
                      <span className="text-sky-400 group-hover:text-white transition-colors tracking-tighter italic">{j.code}</span>
                      <span className="text-[7px] text-slate-500 group-hover:text-sky-100 uppercase truncate w-full text-center">{j.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in zoom-in-95 duration-500 no-print">
            <div className="lg:col-span-8 bg-slate-900/60 rounded-[3.5rem] p-8 sm:p-12 border border-white/5 shadow-2xl space-y-10 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-white/5 pb-10">
                <div className="flex items-center gap-6">
                   <div className="bg-sky-500/10 p-5 rounded-[1.5rem] border border-sky-500/20 shadow-inner"><User className="text-sky-500" size={40} /></div>
                   <div>
                    <h3 className="text-4xl font-black tracking-tight italic">{selectedJurisdiction?.name}</h3>
                    <div className="flex items-center gap-3 mt-2">
                       <span className="bg-sky-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider italic">V.{formData.Version} REV</span>
                       <span className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">{formData.DCG} Region</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                   <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-white/5">
                      <button 
                        onClick={() => setFormData({...formData, subfileType: 'DL'})}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 text-[9px] font-black uppercase transition-all ${formData.subfileType === 'DL' ? 'bg-sky-600 text-white shadow-lg italic' : 'text-slate-500'}`}
                      >
                         <CreditCard size={12}/> Driver License
                      </button>
                      <button 
                        onClick={() => setFormData({...formData, subfileType: 'ID'})}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 text-[9px] font-black uppercase transition-all ${formData.subfileType === 'ID' ? 'bg-sky-600 text-white shadow-lg italic' : 'text-slate-500'}`}
                      >
                         <FileText size={12}/> ID Card
                      </button>
                   </div>
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
                  <InputField label="Middle Name" tag="DAD" />
                  <InputField label="ID Number" tag="DAQ" />
                  <InputField label="Birth Date" tag="DBB" placeholder="YYYYMMDD" maxLength={8} />
                  <InputField label="Expiration Date" tag="DBA" placeholder="YYYYMMDD" maxLength={8} />
                  <div className="lg:col-span-3">
                    <InputField label="Address Line 1" tag="DAG" />
                  </div>
                  <InputField label="City" tag="DAI" />
                  <InputField label="State" tag="DAJ" maxLength={2} />
                  <InputField label="Zip Code" tag="DAK" maxLength={11} />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 italic">Sex</label>
                    <select value={formData.DBC} onChange={e => setFormData({...formData, DBC: e.target.value})} className="w-full bg-slate-950/40 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 appearance-none cursor-pointer">
                      <option value="1">1 - MALE</option>
                      <option value="2">2 - FEMALE</option>
                      <option value="9">9 - NON SPECIFIED</option>
                    </select>
                  </div>
                  <InputField label="Eye Color" tag="DAY" placeholder="BRO/BLU/GRN" maxLength={3} />
                  <InputField label="Hair Color" tag="DAZ" placeholder="BRO/BLK/BLN" maxLength={3} />
                  <InputField label="Height" tag="DAU" placeholder="5-09 IN" />
                  <InputField label="Weight (LBS)" tag="DAW" maxLength={3} />
                  <InputField label="Issue Date" tag="DBD" placeholder="YYYYMMDD" />
                  <InputField label="Restrictions" tag="DCB" placeholder="CORR LENSES" />
                  <InputField label="Endorsements" tag="DCD" placeholder="NONE" />
                  <InputField label="Class" tag="DCA" placeholder="C" />
                  <div className="lg:col-span-3 border-t border-white/5 pt-6 mt-4">
                     <h5 className="text-[9px] font-black text-sky-500 uppercase tracking-widest mb-4 italic">Identity Markers</h5>
                  </div>
                  <InputField label="Compliance" tag="DDA" maxLength={1} />
                  <InputField label="Revision" tag="DDB" placeholder="YYYYMMDD" />
                  <InputField label="Discriminator" tag="DCF" />
                </div>
              )}

              <button onClick={handleCompile} className="w-full bg-sky-600 hover:bg-sky-500 py-6 rounded-[2.5rem] font-black text-xl transition-all shadow-[0_20px_50px_rgba(8,145,178,0.4)] flex items-center justify-center gap-4 group italic">
                <FileCode className="group-hover:rotate-12 transition-transform" size={24} /> COMPILE MATRIX
              </button>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-xl">
                 <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] italic flex items-center gap-2"><Layers size={14}/> Test Nodes</h4>
                 <div className="grid grid-cols-1 gap-3">
                   {PRESETS.map(preset => (
                     <button 
                       key={preset.id} 
                       onClick={() => handleApplyPreset(preset)}
                       className="w-full p-4 bg-slate-950/50 border border-white/5 hover:border-sky-500/40 rounded-2xl text-left transition-all group"
                     >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-black text-slate-200 uppercase italic">{preset.label}</span>
                          <Box size={14} className="text-slate-600 group-hover:text-sky-400 transition-colors" />
                        </div>
                        <p className="text-[9px] text-slate-500 font-medium italic">{preset.description}</p>
                     </button>
                   ))}
                 </div>
              </div>

              <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-8 shadow-xl sticky top-28">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] italic">Kernel Validation</h4>
                    <span className={`text-2xl font-black italic ${validation.overallScore > 90 ? 'text-emerald-500' : 'text-amber-500'}`}>{validation.overallScore}%</span>
                 </div>
                 <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${validation.overallScore > 90 ? 'bg-emerald-500' : 'bg-sky-600'}`} style={{ width: `${validation.overallScore}%` }} />
                 </div>
                 <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {validation.fields.map(f => (
                      <div key={f.elementId} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${f.status === 'CRITICAL_INVALID' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/5 border-transparent'}`}>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black uppercase text-slate-500">{f.elementId}</span>
                          <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px]">{f.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className={`text-[8px] font-black uppercase ${f.status === 'MATCH' ? 'text-emerald-500' : 'text-rose-400'}`}>{f.status === 'MATCH' ? 'Found' : 'Err'}</span>
                           {f.status === 'MATCH' ? <Check size={14} className="text-emerald-500"/> : <AlertCircle size={14} className="text-rose-500"/>}
                        </div>
                      </div>
                    ))}
                 </div>
                 {validation.complianceNotes.length > 0 && (
                   <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-500">
                        <AlertTriangle size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest italic">Compliance Logs</span>
                      </div>
                      {validation.complianceNotes.map((note, i) => (
                        <p key={i} className="text-[9px] text-amber-200/70 font-medium italic leading-tight">• {note}</p>
                      ))}
                   </div>
                 )}
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="flex justify-between items-end border-b border-white/5 pb-8 no-print">
              <div className="space-y-2">
                <h2 className="text-4xl font-black tracking-tighter italic">Compiled Bitstream</h2>
                <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 italic">Node Verified</span>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep('FORM')} className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest transition-all italic"><Edit3 size={18} /> Modify Core</button>
                <button onClick={() => setStep('SELECT')} className="p-4 bg-sky-600/10 text-sky-400 rounded-2xl border border-sky-500/20 hover:bg-sky-600/20 transition-colors"><RefreshCcw size={18} /></button>
              </div>
            </div>

            <div className="bg-white rounded-[4rem] p-12 text-slate-950 flex flex-col items-center gap-12 shadow-[0_50px_100px_rgba(0,0,0,0.5)] border-4 border-slate-200 relative overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 no-print"><Shield size={200} /></div>
              
              <div className="text-center space-y-3 relative z-10">
                <h3 className="text-5xl font-black tracking-tighter uppercase italic text-slate-900 flex items-center gap-4">
                  <Layout className="text-sky-600 no-print" size={40} /> PDF417 MATRIX
                </h3>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono italic">AAMVA_2020_REV_1</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest font-mono italic">{selectedJurisdiction?.code} NODE</span>
                </div>
              </div>
              
              <BarcodeSVG data={generatedString} />

              <div className="flex gap-4 w-full max-w-lg no-print">
                 <button onClick={handlePrint} className="flex-1 bg-slate-950 text-white py-6 rounded-[2.5rem] font-black text-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-4 group italic shadow-xl">
                    <Printer size={24} className="group-hover:translate-y-[-2px] transition-transform" /> PRINT MASTER
                 </button>
                 <button onClick={handleCopy} className={`flex-1 py-6 rounded-[2.5rem] font-black text-xl transition-all flex items-center justify-center gap-4 italic shadow-xl ${copyFeedback ? 'bg-emerald-500 text-white' : 'bg-sky-100 text-sky-600 hover:bg-sky-200'}`}>
                    {copyFeedback ? <Check size={24} /> : <Copy size={24} />} {copyFeedback ? 'COPIED' : 'COPY RAW'}
                 </button>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-white/5 p-10 rounded-[3.5rem] space-y-8 no-print backdrop-blur-md shadow-2xl">
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Terminal size={16} className="text-sky-400" />
                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] italic">Bitstream Matrix Explorer</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/5 px-3 py-1 rounded-full uppercase italic tracking-widest">Compliant Vector</span>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 bg-slate-950/60 border border-emerald-500/20 rounded-[2rem] space-y-2 group hover:bg-slate-950 transition-all">
                     <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em] italic">0-21 Bytes</span>
                     <h5 className="text-xs font-black italic">ANSI Header</h5>
                     <p className="text-[9px] text-slate-500 font-medium italic leading-tight">Standard file prefix with IIN & Version markers.</p>
                  </div>
                  <div className="p-6 bg-slate-950/60 border border-sky-500/20 rounded-[2rem] space-y-2 group hover:bg-slate-950 transition-all">
                     <span className="text-[8px] font-black text-sky-500 uppercase tracking-[0.2em] italic">21-31 Bytes</span>
                     <h5 className="text-xs font-black italic">Subfile Designator</h5>
                     <p className="text-[9px] text-slate-500 font-medium italic leading-tight">Lookup table for subfile offset and length.</p>
                  </div>
                  <div className="p-6 bg-slate-950/60 border border-indigo-500/20 rounded-[2rem] space-y-2 group hover:bg-slate-950 transition-all">
                     <span className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.2em] italic">31+ Bytes</span>
                     <h5 className="text-xs font-black italic">Matrix Payload</h5>
                     <p className="text-[9px] text-slate-500 font-medium italic leading-tight">Encrypted/Plain AAMVA tags with LF/CR delimiters.</p>
                  </div>
               </div>

               <div className="bg-slate-950 p-8 rounded-[2.5rem] font-mono text-[10px] break-all leading-relaxed text-sky-400/80 border border-white/5 select-all max-h-[220px] overflow-y-auto custom-scrollbar relative">
                 <div className="absolute top-4 right-8 text-[8px] font-black uppercase text-slate-700">ANSI 15434 V.2020</div>
                 <span className="text-emerald-400 font-black">{generatedString.substring(0, 21)}</span>
                 <span className="text-sky-400 font-black">{generatedString.substring(21, 31)}</span>
                 <span className="text-slate-300">{generatedString.substring(31)}</span>
               </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .bg-white { 
            box-shadow: none !important; 
            border: none !important; 
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          canvas, img { 
            max-width: 100% !important; 
            height: auto !important; 
            image-rendering: pixelated;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
