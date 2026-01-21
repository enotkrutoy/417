import React, { useState, useRef, useEffect, useMemo } from 'react';
import { JURISDICTIONS } from './constants';
import { Jurisdiction, DLFormData } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import { validateAAMVAStructure } from './utils/validator';
import BarcodeSVG from './components/BarcodeSVG';
import { 
  ArrowLeft, Camera, Search, Settings, Key, User, 
  ShieldCheck, Check, Info, Heart, AlertCircle, Zap, 
  Activity, Lock, Terminal, Printer, Edit3, Loader2, Cpu,
  FileCode, Database, RefreshCcw, Copy, Layout, XCircle,
  Eye, Hash, Calendar, MapPin, Ruler
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'SELECT' | 'FORM' | 'RESULT'>('SELECT');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
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

  useEffect(() => {
    const key = localStorage.getItem('gemini_api_key') || (process.env.API_KEY || "");
    setApiKey(key);
  }, []);

  const generatedString = useMemo(() => generateAAMVAString(formData), [formData]);
  const validation = useMemo(() => validateAAMVAStructure(generatedString, formData), [generatedString, formData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedString);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleSelectJurisdiction = (jur: Jurisdiction) => {
    setSelectedJurisdiction(jur);
    setFormData(prev => ({ 
      ...prev, 
      DAJ: jur.code, IIN: jur.iin, 
      Version: '10', DCG: jur.country || 'USA'
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
      const updates = await scanDLWithGemini(base64, apiKey, (c) => setRetryCount(c));
      let detectedJur = updates.DAJ ? detectJurisdictionFromCode(updates.DAJ) : null;
      if (detectedJur) {
        setSelectedJurisdiction(detectedJur);
        setFormData(prev => ({ ...prev, ...updates, IIN: detectedJur.iin, DAJ: detectedJur.code }));
      } else {
        setFormData(prev => ({ ...prev, ...updates }));
      }
      setStep('FORM');
    } catch (err: any) {
      setScanError(err.message || "OCR Node Error");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      <header className="bg-slate-900/40 border-b border-white/5 backdrop-blur-2xl px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {step !== 'SELECT' && (
            <button onClick={() => setStep('SELECT')} className="p-2 hover:bg-white/10 rounded-xl transition-all text-sky-400 border border-transparent hover:border-white/10">
              <ArrowLeft size={20}/>
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="bg-sky-600 p-1.5 rounded-lg shadow-[0_0_15px_rgba(14,165,233,0.5)]">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <h1 className="text-base font-black tracking-tight leading-tight uppercase">MATRIX <span className="text-sky-500">2020 PRO</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 bg-slate-950/50 border border-white/5 rounded-full backdrop-blur-sm">
              <Activity size={12} className="text-emerald-500" />
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sync Active</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
           </div>
           <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors"><Settings size={20} /></button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 relative z-10">
        {step === 'SELECT' && (
          <div className="max-w-4xl mx-auto space-y-12 py-10">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-[0.1em]">
                <ShieldCheck size={14}/> AAMVA 2020 Compliant
              </div>
              <h2 className="text-6xl sm:text-8xl font-black tracking-tighter bg-gradient-to-b from-white via-white to-slate-600 bg-clip-text text-transparent italic">Vector Kernel</h2>
              <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium">Элитный инструмент генерации PDF417. Полная поддержка Annex D.5.4.5 и ANSI ISO 15434.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div 
                className={`group relative bg-slate-900/50 border rounded-[3rem] p-10 transition-all cursor-pointer shadow-2xl overflow-hidden ${isScanning ? 'border-sky-500/50 cursor-wait' : scanError ? 'border-rose-500/40' : 'border-white/5 hover:border-sky-500/40 active:scale-[0.98]'}`}
                onClick={() => !isScanning && fileInputRef.current?.click()}
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity rotate-12"><Terminal size={180} /></div>
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 border transition-colors ${isScanning ? 'bg-sky-500/20 border-sky-500/40' : scanError ? 'bg-rose-500/10 border-rose-500/20' : 'bg-sky-500/10 border-sky-500/20'}`}>
                  {isScanning ? <Loader2 size={32} className="text-sky-500 animate-spin" /> : scanError ? <AlertCircle className="text-rose-500" size={32} /> : <Camera className="text-sky-500" size={32} />}
                </div>
                <h3 className="text-3xl font-black mb-3 italic">{isScanning ? 'Synchronizing...' : 'Vision Node'}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-10 font-medium italic">
                  {isScanning ? (retryCount > 0 ? `Retry Protocol ${retryCount}/3...` : 'Deep Extraction in Progress...') : 'Автоматическое распознавание через Gemini-3 Neural Vision.'}
                </p>
                <div className="flex items-center gap-3 text-sky-400 text-xs font-black uppercase tracking-[0.2em]">
                  {scanError ? 'RESET PROTOCOL' : 'INITIATE CAPTURE'} <ArrowLeft className="rotate-180" size={16}/>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*" />
              </div>

              <div className="bg-slate-900/30 border border-white/5 rounded-[3rem] p-10 flex flex-col shadow-2xl backdrop-blur-sm">
                <h3 className="text-3xl font-black mb-8 flex items-center gap-3 italic">Jurisdiction</h3>
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  <input placeholder="Search State Node..." className="w-full bg-slate-950/80 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all shadow-inner" onChange={e => setFilterText(e.target.value)}/>
                </div>
                <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
                  {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).map(j => (
                    <button key={j.name} onClick={() => handleSelectJurisdiction(j)} className="group bg-slate-800/40 hover:bg-sky-600 border border-white/5 p-3 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1 active:scale-95">
                      <span className="text-sky-400 group-hover:text-white transition-colors tracking-tighter italic">{j.code}</span>
                      <span className="text-[7px] text-slate-500 group-hover:text-sky-100 uppercase truncate w-full text-center font-bold tracking-widest">{j.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="lg:col-span-8 bg-slate-900/60 rounded-[3.5rem] p-8 sm:p-12 border border-white/5 shadow-2xl space-y-10 backdrop-blur-xl relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-sky-600/5 rounded-full blur-3xl" />
              
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-white/5 pb-10 relative z-10">
                <div className="flex items-center gap-6">
                   <div className="bg-sky-500/10 p-5 rounded-[1.5rem] border border-sky-500/20 shadow-inner"><User className="text-sky-500" size={40} /></div>
                   <div>
                    <h3 className="text-4xl font-black tracking-tight italic">{selectedJurisdiction?.name}</h3>
                    <div className="flex items-center gap-3 mt-2">
                       <span className="bg-sky-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider italic">V.10 ARCH</span>
                       <span className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">{formData.DCG} Node</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 bg-slate-950/50 p-1.5 rounded-2xl border border-white/5">
                  <button onClick={() => setActiveTab('BASIC')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'BASIC' ? 'bg-sky-600 text-white shadow-lg italic' : 'text-slate-500 hover:text-slate-300'}`}>Basic</button>
                  <button onClick={() => setActiveTab('ADVANCED')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ADVANCED' ? 'bg-sky-600 text-white shadow-lg italic' : 'text-slate-500 hover:text-slate-300'}`}>Advanced</button>
                </div>
              </div>

              <div className="space-y-8 relative z-10">
                {activeTab === 'BASIC' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase flex gap-2 tracking-widest px-1"><User size={12}/> Family Name <span className="text-sky-500/40">DCS</span></label>
                        <input value={formData.DCS} onChange={e => setFormData({...formData, DCS: e.target.value.toUpperCase()})} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all shadow-inner" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase flex gap-2 tracking-widest px-1"><User size={12}/> First Name <span className="text-sky-500/40">DAC</span></label>
                        <input value={formData.DAC} onChange={e => setFormData({...formData, DAC: e.target.value.toUpperCase()})} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all shadow-inner" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase flex gap-2 tracking-widest px-1"><Hash size={12}/> ID Number <span className="text-sky-500/40">DAQ</span></label>
                        <input value={formData.DAQ} onChange={e => setFormData({...formData, DAQ: e.target.value.toUpperCase()})} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-black text-sky-400 tracking-widest outline-none focus:border-sky-500/50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase flex gap-2 tracking-widest px-1"><Calendar size={12}/> Birth Date <span className="text-sky-500/40">DBB</span></label>
                        <input value={formData.DBB} placeholder="MMDDYYYY" onChange={e => setFormData({...formData, DBB: e.target.value.replace(/\D/g, '')})} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 font-mono" maxLength={8} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase flex gap-2 tracking-widest px-1"><Calendar size={12}/> Expiration <span className="text-sky-500/40">DBA</span></label>
                        <input value={formData.DBA} placeholder="MMDDYYYY" onChange={e => setFormData({...formData, DBA: e.target.value.replace(/\D/g, '')})} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 font-mono" maxLength={8} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase flex gap-2 tracking-widest px-1"><MapPin size={12}/> State Code <span className="text-sky-500/40">DAJ</span></label>
                        <input value={formData.DAJ} maxLength={2} onChange={e => setFormData({...formData, DAJ: e.target.value.toUpperCase()})} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all shadow-inner" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase flex gap-2 tracking-widest px-1"><MapPin size={12}/> Address Line 1 <span className="text-sky-500/40">DAG</span></label>
                      <input value={formData.DAG} onChange={e => setFormData({...formData, DAG: e.target.value.toUpperCase()})} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all shadow-inner" />
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <div className="space-y-4">
                       <h4 className="text-[11px] font-black text-sky-500 uppercase tracking-widest mb-4 flex gap-2 items-center italic"><ShieldCheck size={14}/> Compliance Elements</h4>
                       <div className="grid grid-cols-2 gap-4">
                         <button onClick={() => setFormData({...formData, DDK: formData.DDK === '1' ? '0' : '1'})} className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-1 ${formData.DDK === '1' ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-slate-950/50 border-white/5 text-slate-600'}`}>
                           <Heart size={20} fill={formData.DDK === '1' ? 'currentColor' : 'none'}/>
                           <span className="text-[8px] font-black uppercase tracking-widest">Donor</span>
                         </button>
                         <button onClick={() => setFormData({...formData, DDL: formData.DDL === '1' ? '0' : '1'})} className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-1 ${formData.DDL === '1' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-950/50 border-white/5 text-slate-600'}`}>
                           <ShieldCheck size={20}/>
                           <span className="text-[8px] font-black uppercase tracking-widest">Veteran</span>
                         </button>
                       </div>
                       <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase flex gap-2 tracking-widest px-1"><Hash size={12}/> Audit / DD String <span className="text-sky-500/40">DCF</span></label>
                        <input value={formData.DCF} onChange={e => setFormData({...formData, DCF: e.target.value.toUpperCase()})} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all shadow-inner font-mono" />
                      </div>
                    </div>
                    <div className="space-y-4">
                       <h4 className="text-[11px] font-black text-sky-500 uppercase tracking-widest mb-4 flex gap-2 items-center italic"><Ruler size={14}/> Physical Identity</h4>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex gap-2 tracking-widest px-1">Height <span className="text-sky-500/40">DAU</span></label>
                            <input value={formData.DAU} placeholder="5-09 IN" onChange={e => setFormData({...formData, DAU: e.target.value.toUpperCase()})} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex gap-2 tracking-widest px-1">Eye Color <span className="text-sky-500/40">DAY</span></label>
                            <select value={formData.DAY} onChange={e => setFormData({...formData, DAY: e.target.value})} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 appearance-none">
                              {['BRO','BLU','GRN','HAZ','GRY','BLK','MAR'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                       </div>
                       <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase flex gap-2 tracking-widest px-1">Vehicle Class <span className="text-sky-500/40">DCA</span></label>
                        <input value={formData.DCA} onChange={e => setFormData({...formData, DCA: e.target.value.toUpperCase()})} className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setStep('RESULT')} className="w-full bg-sky-600 hover:bg-sky-500 py-6 rounded-[2.5rem] font-black text-xl transition-all shadow-[0_20px_50px_rgba(8,145,178,0.3)] active:scale-[0.98] flex items-center justify-center gap-4 group relative z-10">
                <FileCode className="group-hover:rotate-12 transition-transform" size={24} /> COMPILE KERNEL
              </button>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-8 shadow-xl backdrop-blur-md">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] flex items-center gap-2 italic"><Database size={14} /> Validation Node</h4>
                    <span className={`text-2xl font-black italic ${validation.overallScore > 90 ? 'text-emerald-500' : validation.overallScore > 70 ? 'text-amber-500' : 'text-rose-500'}`}>{validation.overallScore}%</span>
                 </div>
                 <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
                    <div className={`h-full transition-all duration-1000 ${validation.overallScore > 90 ? 'bg-emerald-500' : 'bg-sky-600'}`} style={{ width: `${validation.overallScore}%` }} />
                 </div>
                 <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {validation.fields.map(f => (
                      <div key={f.elementId} className={`flex items-center justify-between group p-3 rounded-xl transition-all border ${f.status === 'CRITICAL_INVALID' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/5 border-transparent hover:border-white/5'}`}>
                        <div className="flex flex-col">
                          <span className={`text-[8px] font-black uppercase tracking-widest leading-none mb-1 font-mono ${f.status === 'CRITICAL_INVALID' ? 'text-rose-400' : 'text-slate-500'}`}>{f.elementId}</span>
                          <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px]">{f.description}</span>
                        </div>
                        {f.status === 'MATCH' ? <Check size={14} className="text-emerald-500"/> : <AlertCircle size={14} className={f.status === 'CRITICAL_INVALID' ? 'text-rose-500' : 'text-amber-500'}/>}
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
              <div className="space-y-2">
                <h2 className="text-4xl font-black tracking-tighter italic">Compiled Bitstream</h2>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-lg italic ${validation.overallScore > 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}>
                  {validation.overallScore > 90 ? 'Production Ready Node' : 'Test Environment Node'}
                </span>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep('FORM')} className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-white/5 shadow-xl italic"><Edit3 size={18} /> Edit Core</button>
                <button onClick={() => setStep('SELECT')} className="p-4 bg-sky-600/10 text-sky-400 rounded-2xl hover:bg-sky-600/20 transition-all border border-sky-500/20 shadow-xl"><RefreshCcw size={18} /></button>
              </div>
            </div>

            <div className="bg-white rounded-[4rem] p-12 text-slate-950 flex flex-col items-center gap-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border-4 border-slate-200 relative overflow-hidden group print:m-0 print:p-0">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 opacity-20" />
              <div className="text-center space-y-3">
                <h3 className="text-6xl font-black tracking-tighter uppercase italic text-slate-900 flex items-center gap-4">
                  <Layout className="text-sky-600" size={48} /> PDF417 CORE
                </h3>
                <span className="bg-slate-100 px-4 py-1.5 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] font-mono italic">ANNEX_D_5_2_ENABLED</span>
              </div>
              <div className="w-full">
                <BarcodeSVG data={generatedString} />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
                 <button onClick={() => window.print()} className="flex-1 bg-slate-950 text-white py-7 rounded-[2.5rem] font-black text-xl hover:bg-slate-800 hover:-translate-y-1 transition-all shadow-xl flex items-center justify-center gap-4 group italic">
                    <Printer size={24} className="group-hover:scale-110 transition-transform"/> PRINT MASTER
                 </button>
                 <button onClick={handleCopy} className={`flex-1 py-7 rounded-[2.5rem] font-black text-xl transition-all shadow-xl flex items-center justify-center gap-4 italic ${copyFeedback ? 'bg-emerald-500 text-white' : 'bg-sky-100 text-sky-600 hover:bg-sky-200'}`}>
                    {copyFeedback ? <Check size={24} /> : <Copy size={24} />} {copyFeedback ? 'COPIED' : 'COPY RAW'}
                 </button>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-white/5 p-10 rounded-[3.5rem] space-y-6 backdrop-blur-md shadow-2xl">
               <div className="flex justify-between items-center">
                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3 italic"><Terminal size={16} /> Bitstream Matrix</h4>
                  <span className="text-[9px] font-mono text-sky-500/50 uppercase tracking-widest">{generatedString.length} OCTETS</span>
               </div>
               <div className="bg-slate-950 p-8 rounded-3xl font-mono text-[10px] break-all leading-relaxed text-sky-400/80 border border-white/5 shadow-inner select-all custom-scrollbar max-h-[180px] overflow-y-auto">
                 {generatedString}
               </div>
               <p className="flex items-center gap-2 text-[9px] text-slate-500 font-medium px-4">
                  <Info size={12} className="text-sky-500" /> ANSI ISO 15434 Compliant stream with LF/RS/CR delimiters.
               </p>
            </div>
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-[3rem] p-12 border border-white/10 shadow-2xl space-y-10 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-6">
               <div className="p-5 bg-amber-500/10 rounded-[1.5rem] border border-amber-500/20 shadow-inner"><Key className="text-amber-500" size={36} /></div>
               <div>
                  <h3 className="text-3xl font-black tracking-tight italic">Node API</h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1 font-mono">Gemini-3 Access</p>
               </div>
            </div>
            <div className="space-y-6">
               <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="ENTER_API_KEY..." className="w-full bg-slate-950/80 border border-white/5 rounded-2xl p-6 text-white font-mono outline-none focus:border-sky-500/50 transition-all text-sm shadow-inner" />
               <p className="text-[10px] text-slate-500 font-medium px-2 italic text-center leading-relaxed">Ключ используется для нейросетевой экстракции данных. Хранится локально.</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setIsSettingsOpen(false)} className="flex-1 bg-slate-800 text-slate-400 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors hover:bg-slate-700 italic">Close</button>
              <button onClick={() => { localStorage.setItem('gemini_api_key', apiKey); setIsSettingsOpen(false); }} className="flex-1 bg-sky-600 hover:bg-sky-500 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95 italic">Update</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        @media print {
          header, button, footer, .lg:col-span-4, .Matrix-Bitstream { display: none !important; }
          body { background: white !important; }
          main { padding: 0 !important; max-width: none !important; margin: 0 !important; }
          .bg-white { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 40px auto !important; }
          svg { width: 100% !important; height: auto !important; max-width: 600px !important; margin: 0 auto !important; }
        }
      `}</style>
    </div>
  );
};

export default App;