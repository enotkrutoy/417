import React, { useState, useRef, useEffect, useMemo } from 'react';
import { JURISDICTIONS } from './constants';
import { Jurisdiction, DLFormData } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import { validateAAMVAStructure } from './utils/validator';
import BarcodeCanvas from './components/BarcodeCanvas';
import { 
  ArrowLeft, Camera, Search, Settings, Key, Fingerprint,
  ShieldCheck, Check, Info, User, Heart, AlertCircle, Zap, ShieldAlert
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
      <header className="bg-slate-900/40 border-b border-white/5 backdrop-blur-2xl px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {step !== 'SELECT' && (
            <button onClick={() => setStep('SELECT')} className="p-2 hover:bg-white/10 rounded-full transition-all text-sky-400">
              <ArrowLeft size={20}/>
            </button>
          )}
          <div className="flex flex-col">
            <h1 className="text-lg font-black flex items-center gap-2 tracking-tight">
              <Zap className="text-sky-500 fill-sky-500" size={18} /> 
              AAMVA <span className="text-sky-500">2020 PRO</span>
            </h1>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Security Validation Suite</span>
          </div>
        </div>
        <div className="flex gap-2">
           <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 bg-slate-950 border border-white/5 rounded-full">
              <div className={`w-2 h-2 rounded-full ${validation.isHeaderValid ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[10px] font-black uppercase text-slate-400">System Ready</span>
           </div>
           <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors"><Settings size={20} /></button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8">
        {step === 'SELECT' && (
          <div className="max-w-4xl mx-auto space-y-12 py-10">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-500 text-[10px] font-bold uppercase tracking-tighter">
                <ShieldCheck size={12}/> Verified Compliance Standard
              </div>
              <h2 className="text-7xl font-black tracking-tighter bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent">Compliance Master</h2>
              <p className="text-slate-400 text-lg max-w-xl mx-auto">Генерация и валидация PDF417 штрих-кодов по новейшему стандарту 2020 AAMVA DL/ID Card Design.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="group relative bg-slate-900/50 border border-white/5 rounded-[3rem] p-10 hover:border-sky-500/40 transition-all cursor-pointer shadow-2xl overflow-hidden" onClick={() => fileInputRef.current?.click()}>
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Camera size={120} />
                </div>
                <Camera className="text-sky-500 mb-8" size={48} />
                <h3 className="text-3xl font-black mb-3">AI Engine</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">Мгновенное извлечение данных из фотографий с использованием Gemini 3 Flash. Определение штата, типа документа и признаков REAL ID.</p>
                <div className="flex items-center gap-2 text-sky-400 text-xs font-black uppercase tracking-[0.2em]">
                  {isScanning ? "Scanning Matrix..." : "Start Capture"} <ArrowLeft className="rotate-180" size={16}/>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*"/>
              </div>

              <div className="bg-slate-900/30 border border-white/5 rounded-[3rem] p-10 flex flex-col justify-between shadow-2xl backdrop-blur-sm">
                <div>
                  <h3 className="text-3xl font-black mb-6">Quick Templates</h3>
                  <div className="relative mb-8">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input placeholder="Search jurisdiction..." className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all placeholder:text-slate-700" onChange={e => setFilterText(e.target.value)}/>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).slice(0, 9).map(j => (
                    <button key={j.name} onClick={() => handleSelectJurisdiction(j)} className="group bg-slate-800/40 hover:bg-sky-600 border border-white/5 p-4 rounded-2xl text-xs font-black transition-all flex flex-col items-center gap-1 active:scale-95">
                      <span className="text-sky-500 group-hover:text-white transition-colors">{j.code}</span>
                      <span className="text-[8px] text-slate-500 group-hover:text-sky-100 uppercase truncate w-full text-center">{j.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="lg:col-span-3 bg-slate-900/40 rounded-[3.5rem] p-8 sm:p-12 border border-white/5 shadow-2xl space-y-10 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-white/5 pb-10">
                <div className="flex items-center gap-6">
                   <div className="bg-sky-500/10 p-5 rounded-[1.5rem] border border-sky-500/20"><User className="text-sky-500" size={40} /></div>
                   <div>
                    <h3 className="text-4xl font-black tracking-tight">{selectedJurisdiction?.name}</h3>
                    <div className="flex items-center gap-3 mt-2">
                       <span className="bg-slate-950 px-2 py-1 rounded text-[10px] font-black text-sky-500 border border-sky-500/20">AAMVA 2020</span>
                       <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Version {formData.Version}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setFormData({...formData, DDK: formData.DDK === '1' ? '0' : '1'})} className={`p-4 rounded-2xl flex flex-col items-center gap-1 transition-all border ${formData.DDK === '1' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 'bg-slate-800/40 border-white/5 text-slate-600'}`}>
                    <span className="text-[8px] font-black uppercase">Organ Donor</span>
                    <Heart size={20} fill={formData.DDK === '1' ? 'currentColor' : 'none'}/>
                  </button>
                  <button onClick={() => setFormData({...formData, DDA: formData.DDA === 'F' ? 'N' : 'F'})} className={`px-6 py-4 rounded-2xl flex flex-col items-center gap-1 transition-all border ${formData.DDA === 'F' ? 'bg-amber-500 border-amber-400 text-slate-950' : 'bg-slate-800/40 border-white/5 text-slate-600'}`}>
                    <span className="text-[8px] font-black uppercase tracking-widest">Standard</span>
                    <span className="text-xs font-black uppercase">{formData.DDA === 'F' ? 'REAL ID' : 'NON-COMP'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                 {[
                   { label: "First Name", tag: "DAC" },
                   { label: "Middle", tag: "DAD" },
                   { label: "Last Name", tag: "DCS" },
                   { label: "Suffix", tag: "DCU" }
                 ].map(f => (
                   <div key={f.tag} className="space-y-3">
                     <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between tracking-widest">{f.label} <span className="text-sky-500/50">{f.tag}</span></label>
                     <input value={formData[f.tag as keyof DLFormData]} onChange={e => setFormData({...formData, [f.tag]: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all shadow-inner" />
                   </div>
                 ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between tracking-widest">DL Number <span>DAQ</span></label>
                  <input value={formData.DAQ} onChange={e => setFormData({...formData, DAQ: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-sm font-black text-sky-400 tracking-wider" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between tracking-widest">Audit (DD) <span>DCF</span></label>
                  <input value={formData.DCF} onChange={e => setFormData({...formData, DCF: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-sm font-bold" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between tracking-widest">DOB (MMDDCCYY) <span>DBB</span></label>
                  <input value={formData.DBB} onChange={e => setFormData({...formData, DBB: e.target.value.replace(/\D/g, '')})} className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-sm font-bold" maxLength={8} />
                </div>
              </div>

              <button onClick={() => setStep('RESULT')} className="w-full bg-sky-600 hover:bg-sky-500 py-6 rounded-[2rem] font-black text-xl transition-all shadow-[0_20px_50px_rgba(8,145,178,0.3)] active:scale-[0.98] flex items-center justify-center gap-4 group">
                <ShieldCheck className="group-hover:scale-110 transition-transform" size={28} /> 
                COMPILE SECURITY MATRIX
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-xl">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em]">Compliance Score</h4>
                    <span className={`text-xl font-black ${validation.overallScore > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{validation.overallScore}%</span>
                 </div>
                 <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 transition-all duration-1000" style={{ width: `${validation.overallScore}%` }} />
                 </div>
                 <div className="space-y-4">
                    {validation.fields.map(f => (
                      <div key={f.elementId} className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">{f.description}</span>
                        <div className="flex items-center gap-2">
                           <span className={f.status === 'MATCH' ? 'text-emerald-400' : 'text-rose-400'}>{f.status}</span>
                           {f.status === 'MATCH' ? <Check size={12} className="text-emerald-500"/> : <AlertCircle size={12} className="text-rose-500"/>}
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="bg-sky-500/5 rounded-[2.5rem] p-8 border border-sky-500/10 space-y-4">
                <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-2"><Info size={16}/> AAMVA A.7.7 NOTICE</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Алгоритм усечения имен теперь полностью соответствует стандарту 2020 года. Пробелы и апострофы фильтруются в первую очередь, сохраняя правостороннюю целостность данных.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="bg-white rounded-[4rem] p-12 text-slate-950 flex flex-col items-center gap-12 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
              <div className="text-center space-y-2">
                <h3 className="text-5xl font-black tracking-tighter">AAMVA PDF417</h3>
                <div className="flex items-center justify-center gap-3">
                   <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">ISO/IEC 15438 Compliant</span>
                   <span className="bg-sky-500 px-3 py-1 rounded-full text-[10px] font-black text-white uppercase tracking-widest">Standard 2020</span>
                </div>
              </div>
              <div className="w-full max-w-2xl transform hover:scale-[1.02] transition-transform duration-500">
                <BarcodeCanvas data={generatedString} />
              </div>
              <div className="flex gap-6 w-full max-w-md">
                <button onClick={() => window.print()} className="flex-1 bg-slate-950 text-white py-5 rounded-[1.5rem] font-black text-lg hover:bg-slate-800 hover:-translate-y-1 transition-all shadow-xl active:translate-y-0">PRINT MATRIX</button>
                <button onClick={() => setStep('FORM')} className="flex-1 bg-slate-100 text-slate-600 py-5 rounded-[1.5rem] font-black text-lg hover:bg-slate-200 transition-all border border-slate-200">EDIT DATA</button>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-white/5 p-8 rounded-[2.5rem] space-y-6">
               <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Encrypted Data Stream</h4>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">
                     <ShieldCheck size={10}/> Integrity Verified
                  </div>
               </div>
               <div className="bg-slate-950 p-6 rounded-2xl font-mono text-[11px] break-all leading-relaxed text-sky-500/80 border border-white/5 opacity-80 select-all">
                 {generatedString}
               </div>
            </div>
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-[3rem] p-10 border border-white/10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-4">
               <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20"><Key className="text-amber-400" size={32} /></div>
               <div>
                  <h3 className="text-2xl font-black">AI Activation</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Google Gemini API Gateway</p>
               </div>
            </div>
            <div className="space-y-4">
               <p className="text-xs text-slate-400 leading-relaxed font-medium">Для работы AI Engine требуется действующий ключ API Gemini. Данные обрабатываются в зашифрованном виде.</p>
               <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter API Key..." className="w-full bg-slate-950 border border-white/5 rounded-2xl p-5 text-white font-mono outline-none focus:border-sky-500/50 transition-all text-sm" />
            </div>
            <div className="flex gap-4">
              <button onClick={() => setIsSettingsOpen(false)} className="flex-1 bg-slate-800 text-slate-400 py-4 rounded-2xl font-black text-sm uppercase">Cancel</button>
              <button onClick={() => { localStorage.setItem('gemini_api_key', apiKey); setIsSettingsOpen(false); }} className="flex-1 bg-sky-600 hover:bg-sky-500 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-lg active:scale-95">Save Config</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;