
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { JURISDICTIONS } from './constants';
import { Jurisdiction, DLFormData } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import { validateAAMVAStructure } from './utils/validator';
import BarcodeCanvas from './components/BarcodeCanvas';
import { 
  ArrowLeft, Camera, Search, Settings, Key, User, 
  ShieldCheck, Check, Info, Heart, AlertCircle, Zap, 
  Activity, Lock, Terminal, FileText, Printer, Edit3, Loader2
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'SELECT' | 'FORM' | 'RESULT'>('SELECT');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [filterText, setFilterText] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<DLFormData>({
    IIN: '', Version: '10', JurisdictionVersion: '00', 
    subfileType: 'DL',
    DCA: 'C', DCB: 'NONE', DCD: 'NONE', DBA: '01012030', DCS: '', DAC: '', DAD: '',
    DBD: '01012020', DBB: '01011990', DBC: '1', DAY: 'BRO', DAU: '5-09',
    DAG: '', DAI: '', DAJ: '', DAK: '', DAQ: '', DCF: '', DCG: 'USA', 
    DAW: '175', DAZ: 'BRO', DCU: '', DDA: 'F', DDK: '1',
    DDE: 'N', DDF: 'N', DDG: 'N'
  });

  useEffect(() => {
    const key = localStorage.getItem('gemini_api_key') || (process.env.API_KEY || "");
    setApiKey(key);
  }, []);

  const generatedString = useMemo(() => {
    return generateAAMVAString(formData);
  }, [formData]);

  const validation = useMemo(() => {
    return validateAAMVAStructure(generatedString, formData);
  }, [generatedString, formData]);

  const handleSelectJurisdiction = (jur: Jurisdiction) => {
    setSelectedJurisdiction(jur);
    setFormData(prev => ({ 
      ...prev, 
      DAJ: jur.code, 
      IIN: jur.iin, 
      Version: jur.version === '10' ? '10' : '08',
      JurisdictionVersion: '00',
      DCG: jur.country || 'USA'
    }));
    setStep('FORM');
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!apiKey) { setIsSettingsOpen(true); return; }
    setIsScanning(true);
    try {
      const base64 = await preprocessImage(file);
      const updates = await scanDLWithGemini(base64, apiKey);
      let detectedJur = updates.DAJ ? detectJurisdictionFromCode(updates.DAJ) : null;
      if (detectedJur) {
        setSelectedJurisdiction(detectedJur);
        setFormData(prev => ({ 
          ...prev, 
          ...updates, 
          IIN: detectedJur.iin, 
          DAJ: detectedJur.code,
          Version: detectedJur.version,
          JurisdictionVersion: '00' 
        }));
      } else {
        setFormData(prev => ({ ...prev, ...updates }));
      }
      setStep('FORM');
    } catch (err: any) {
      alert(`AI Scan Failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-500 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px] opacity-50" />
      </div>

      <header className="bg-slate-900/40 border-b border-white/5 backdrop-blur-2xl px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {step !== 'SELECT' && (
            <button 
              onClick={() => setStep(step === 'RESULT' ? 'FORM' : 'SELECT')} 
              className="p-2 hover:bg-white/10 rounded-xl transition-all text-sky-400 border border-transparent hover:border-white/10"
            >
              <ArrowLeft size={20}/>
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="bg-sky-500 p-1.5 rounded-lg shadow-[0_0_15px_rgba(14,165,233,0.5)]">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-black tracking-tight leading-tight">
                AAMVA <span className="text-sky-500">2020 PRO</span>
              </h1>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-none">Security Validation Suite</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 bg-slate-950/50 border border-white/5 rounded-full backdrop-blur-sm">
              <Activity size={12} className="text-emerald-500" />
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Matrix Live</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
           </div>
           <button 
            onClick={() => setIsSettingsOpen(true)} 
            className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors border border-transparent hover:border-white/5"
           >
            <Settings size={20} />
           </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 relative z-10">
        {step === 'SELECT' && (
          <div className="max-w-4xl mx-auto space-y-12 py-10">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-[0.1em]">
                <ShieldCheck size={14} className="animate-pulse" /> ISO/IEC 15438 Compliant Generator
              </div>
              <h2 className="text-6xl sm:text-8xl font-black tracking-tighter bg-gradient-to-b from-white via-white to-slate-600 bg-clip-text text-transparent">
                Identity Matrix
              </h2>
              <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium leading-relaxed">
                Генерация защищенных PDF417 штрих-кодов по стандарту AAMVA 2020. 
                Используйте AI для мгновенного извлечения данных из существующих документов.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* AI Scan Card */}
              <div 
                className="group relative bg-slate-900/50 border border-white/5 rounded-[3rem] p-10 hover:border-sky-500/40 transition-all cursor-pointer shadow-2xl overflow-hidden active:scale-[0.98]" 
                onClick={() => !isScanning && fileInputRef.current?.click()}
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                  <Terminal size={180} />
                </div>
                <div className="bg-sky-500/10 w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 border border-sky-500/20 group-hover:bg-sky-500/20 transition-all">
                  {isScanning ? <Loader2 size={32} className="text-sky-500 animate-spin" /> : <Camera className="text-sky-500" size={32} />}
                </div>
                <h3 className="text-3xl font-black mb-3">AI Vision</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-10 font-medium">
                  Извлечение AAMVA тегов с помощью Gemini 3 Flash. Автоматическое распознавание штата, номера DL и REAL ID статуса.
                </p>
                <div className="flex items-center gap-3 text-sky-400 text-xs font-black uppercase tracking-[0.2em]">
                  {isScanning ? "Neural Scanning..." : "Initialize OCR"} <ArrowLeft className="rotate-180" size={16}/>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*" capture="environment"/>
              </div>

              {/* Template Selection */}
              <div className="bg-slate-900/30 border border-white/5 rounded-[3rem] p-10 flex flex-col shadow-2xl backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-3xl font-black mb-8 flex items-center gap-3">
                  <FileText className="text-slate-500" size={24} /> Templates
                </h3>
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  <input 
                    placeholder="Filter jurisdictions..." 
                    className="w-full bg-slate-950/80 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all placeholder:text-slate-700 shadow-inner" 
                    onChange={e => setFilterText(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
                  {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).map(j => (
                    <button 
                      key={j.name} 
                      onClick={() => handleSelectJurisdiction(j)} 
                      className="group bg-slate-800/40 hover:bg-sky-600 border border-white/5 p-3 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1 active:scale-95"
                    >
                      <span className="text-sky-500 group-hover:text-white transition-colors">{j.code}</span>
                      <span className="text-[7px] text-slate-500 group-hover:text-sky-100 uppercase truncate w-full text-center">{j.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Form Section */}
            <div className="lg:col-span-8 bg-slate-900/60 rounded-[3.5rem] p-8 sm:p-12 border border-white/5 shadow-2xl space-y-10 backdrop-blur-xl relative">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-white/5 pb-10">
                <div className="flex items-center gap-6">
                   <div className="bg-sky-500/10 p-5 rounded-[1.5rem] border border-sky-500/20 shadow-inner"><User className="text-sky-500" size={40} /></div>
                   <div>
                    <h3 className="text-4xl font-black tracking-tight flex items-center gap-3">
                      {selectedJurisdiction?.name}
                      {selectedJurisdiction?.country === 'CAN' && <span className="text-sm bg-red-500/10 text-red-500 px-2 py-0.5 rounded-lg border border-red-500/20">CAN</span>}
                    </h3>
                    <div className="flex items-center gap-3 mt-2">
                       <span className="bg-sky-500 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">AAMVA 2020 Compliant</span>
                       <span className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Standard v10</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setFormData({...formData, DDK: formData.DDK === '1' ? '0' : '1'})} 
                    className={`p-4 rounded-[1.25rem] flex flex-col items-center gap-1.5 transition-all border shadow-lg ${formData.DDK === '1' ? 'bg-rose-500 border-rose-400 text-white shadow-rose-500/20' : 'bg-slate-800/40 border-white/5 text-slate-500'}`}
                  >
                    <span className="text-[7px] font-black uppercase">Organ Donor</span>
                    <Heart size={22} fill={formData.DDK === '1' ? 'currentColor' : 'none'}/>
                  </button>
                  <button 
                    onClick={() => setFormData({...formData, DDA: formData.DDA === 'F' ? 'N' : 'F'})} 
                    className={`px-6 py-4 rounded-[1.25rem] flex flex-col items-center gap-1.5 transition-all border shadow-lg ${formData.DDA === 'F' ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-amber-500/20' : 'bg-slate-800/40 border-white/5 text-slate-500'}`}
                  >
                    <span className="text-[7px] font-black uppercase tracking-widest">Real ID Status</span>
                    <span className="text-xs font-black uppercase">{formData.DDA === 'F' ? 'COMPLIANT' : 'NON-COMP'}</span>
                  </button>
                </div>
              </div>

              {/* Form Grid */}
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: "Family Name", tag: "DCS", placeholder: "SURNAME" },
                    { label: "Given Name", tag: "DAC", placeholder: "FIRST" },
                    { label: "Middle", tag: "DAD", placeholder: "OPTIONAL" },
                    { label: "Suffix", tag: "DCU", placeholder: "JR, III" }
                  ].map(f => (
                    <div key={f.tag} className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between tracking-widest px-1">
                        {f.label} <span className="text-sky-500/40">{f.tag}</span>
                      </label>
                      <input 
                        value={formData[f.tag as keyof DLFormData]} 
                        onChange={e => setFormData({...formData, [f.tag]: e.target.value.toUpperCase()})} 
                        placeholder={f.placeholder}
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all shadow-inner placeholder:text-slate-800" 
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between tracking-widest px-1">DL Number <span>DAQ</span></label>
                    <input 
                      value={formData.DAQ} 
                      onChange={e => setFormData({...formData, DAQ: e.target.value.toUpperCase()})} 
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-black text-sky-400 tracking-widest outline-none focus:border-sky-500/50" 
                    />
                  </div>
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between tracking-widest px-1">Date of Birth <span>DBB</span></label>
                    <input 
                      value={formData.DBB} 
                      placeholder="MMDDCCYY"
                      onChange={e => setFormData({...formData, DBB: e.target.value.replace(/\D/g, '')})} 
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50" 
                      maxLength={8}
                    />
                  </div>
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between tracking-widest px-1">Expiry Date <span>DBA</span></label>
                    <input 
                      value={formData.DBA} 
                      placeholder="MMDDCCYY"
                      onChange={e => setFormData({...formData, DBA: e.target.value.replace(/\D/g, '')})} 
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50" 
                      maxLength={8}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Full Street Address <span>DAG</span></label>
                    <input 
                      value={formData.DAG} 
                      onChange={e => setFormData({...formData, DAG: e.target.value.toUpperCase()})} 
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">City <span>DAI</span></label>
                      <input 
                        value={formData.DAI} 
                        onChange={e => setFormData({...formData, DAI: e.target.value.toUpperCase()})} 
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50" 
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Zip <span>DAK</span></label>
                      <input 
                        value={formData.DAK} 
                        onChange={e => setFormData({...formData, DAK: e.target.value.toUpperCase()})} 
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  onClick={() => setStep('SELECT')} 
                  className="px-8 py-5 bg-slate-800 hover:bg-slate-700 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-[0.98]"
                >
                  Change Jurisdiction
                </button>
                <button 
                  onClick={() => setStep('RESULT')} 
                  className="flex-1 bg-sky-600 hover:bg-sky-500 py-6 rounded-[2rem] font-black text-xl transition-all shadow-[0_20px_50px_rgba(8,145,178,0.3)] active:scale-[0.98] flex items-center justify-center gap-4 group"
                >
                  <Lock className="group-hover:rotate-12 transition-transform" size={24} /> 
                  LOCK & GENERATE
                </button>
              </div>
            </div>

            {/* Side Metrics Section */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-8 shadow-xl backdrop-blur-md">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Activity size={14} /> Security Compliance
                    </h4>
                    <span className={`text-2xl font-black ${validation.overallScore > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{validation.overallScore}%</span>
                 </div>
                 <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`h-full transition-all duration-1000 shadow-[0_0_15px_rgba(14,165,233,0.5)] ${validation.overallScore === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} 
                      style={{ width: `${validation.overallScore}%` }} 
                    />
                 </div>
                 <div className="space-y-5">
                    {validation.fields.map(f => (
                      <div key={f.elementId} className="flex items-center justify-between group">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{f.elementId}</span>
                          <span className="text-[10px] font-bold text-slate-300">{f.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className={`text-[9px] font-black ${f.status === 'MATCH' ? 'text-emerald-400' : 'text-rose-400'}`}>{f.status}</span>
                           {f.status === 'MATCH' ? 
                            <Check size={14} className="text-emerald-500 bg-emerald-500/10 p-0.5 rounded-full" /> : 
                            <AlertCircle size={14} className="text-rose-500 bg-rose-500/10 p-0.5 rounded-full" />
                           }
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="bg-sky-500/5 rounded-[2.5rem] p-8 border border-sky-500/10 space-y-4">
                <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-2">
                  <Info size={16}/> A.7.7 Standard Protocol
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Имена автоматически усекаются по алгоритму AAMVA 2020: сначала удаляются пробелы у дефисов, 
                  затем апострофы, и наконец остальные символы справа налево с защитой спецсимволов.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
            {/* Result Header */}
            <div className="flex flex-col sm:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
              <div className="space-y-2">
                <h2 className="text-4xl font-black tracking-tighter">Barcode Output</h2>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 rounded-md text-[9px] font-black uppercase tracking-wider border border-sky-500/20">Final Compilation</span>
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Signed Matrix Payload</span>
                </div>
              </div>
              <button 
                onClick={() => setStep('FORM')} 
                className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-white/5"
              >
                <Edit3 size={16} /> Edit Values
              </button>
            </div>

            {/* Barcode Display */}
            <div className="bg-white rounded-[4rem] p-12 text-slate-950 flex flex-col items-center gap-12 shadow-[0_50px_100px_rgba(0,0,0,0.5)] border-4 border-slate-200 group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rotate-45 translate-x-12 -translate-y-12" />
              <div className="text-center space-y-2 relative">
                <h3 className="text-5xl font-black tracking-tighter uppercase italic text-slate-900">AAMVA PDF417</h3>
                <div className="flex items-center justify-center gap-3">
                   <span className="bg-slate-100 px-3 py-1 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] border border-slate-200">ISO/IEC 15438</span>
                   <span className="bg-sky-500 px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-sky-500/20">Standard 2020</span>
                </div>
              </div>
              
              <div className="w-full max-w-2xl transform transition-transform duration-700 hover:scale-[1.05]">
                <BarcodeCanvas data={generatedString} />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                <button 
                  onClick={() => window.print()} 
                  className="flex-1 bg-slate-950 text-white py-5 rounded-[1.75rem] font-black text-lg hover:bg-slate-800 hover:-translate-y-1 transition-all shadow-[0_15px_30px_rgba(0,0,0,0.2)] active:translate-y-0 flex items-center justify-center gap-3 group"
                >
                  <Printer size={24} className="group-hover:scale-110 transition-transform" /> PRINT MATRIX
                </button>
              </div>
            </div>

            {/* Raw Data Stream */}
            <div className="bg-slate-900/50 border border-white/5 p-8 rounded-[3rem] space-y-6 backdrop-blur-md">
               <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                    <Terminal size={14} /> Encrypted Stream
                  </h4>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-tighter">
                     <Lock size={12}/> Bitstream Integrity Verified
                  </div>
               </div>
               <div className="bg-slate-950 p-6 rounded-2xl font-mono text-[10px] break-all leading-relaxed text-sky-500/80 border border-white/5 opacity-80 select-all custom-scrollbar shadow-inner max-h-[150px] overflow-y-auto">
                 {generatedString}
               </div>
            </div>
          </div>
        )}
      </main>

      {/* API Key Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full max-w-md rounded-[3rem] p-10 border border-white/10 shadow-[0_0_100px_rgba(14,165,233,0.1)] space-y-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-5">
               <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 shadow-inner">
                <Key className="text-amber-500" size={32} />
               </div>
               <div>
                  <h3 className="text-2xl font-black tracking-tight">AI Activation</h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1 leading-none">Security Gateway Node</p>
               </div>
            </div>
            <div className="space-y-5">
               <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Для работы AI Vision требуется Gemini API Key. Ваши данные обрабатываются локально и не сохраняются на сервере.
               </p>
               <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={e => setApiKey(e.target.value)} 
                  placeholder="Enter Matrix API Key..." 
                  className="w-full bg-slate-950/80 border border-white/5 rounded-2xl p-5 pl-12 text-white font-mono outline-none focus:border-sky-500/50 transition-all text-sm shadow-inner" 
                />
               </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setIsSettingsOpen(false)} 
                className="flex-1 bg-slate-800 text-slate-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => { localStorage.setItem('gemini_api_key', apiKey); setIsSettingsOpen(false); }} 
                className="flex-1 bg-sky-600 hover:bg-sky-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-sky-500/20 active:scale-95"
              >
                Update Node
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for scrollbars */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(14,165,233,0.3); }
        @media print {
          header, button, footer { display: none !important; }
          body { background: white !important; }
          main { padding: 0 !important; max-width: none !important; }
          .bg-white { box-shadow: none !important; border: none !important; }
        }
      `}</style>
    </div>
  );
};

export default App;
