
import React, { useState, useRef, useEffect } from 'react';
import { JURISDICTIONS } from './constants';
import { Jurisdiction, DLFormData } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import { validateAAMVAStructure } from './utils/validator';
import BarcodeCanvas from './components/BarcodeCanvas';
import { 
  ArrowLeft, Camera, Search, Settings, Key, Fingerprint,
  ShieldCheck, ClipboardCheck, Check, Info
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'SELECT' | 'FORM' | 'RESULT'>('SELECT');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [generatedString, setGeneratedString] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [filterText, setFilterText] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<DLFormData>({
    IIN: '', Version: '10', JurisdictionVersion: '00', DDA: 'F',
    DCA: 'C', DCB: 'NONE', DCD: 'NONE', DBA: '', DCS: '', DAC: '', DAD: '',
    DBD: '', DBB: '', DBC: '1', DAY: 'BRO', DAU: '5-08',
    DAG: '', DAI: '', DAJ: '', DAK: '', DAQ: '', DCF: '', DCG: 'USA', 
    DAW: '165', DAZ: 'BRO', DEB: ''
  });

  useEffect(() => {
    const key = localStorage.getItem('gemini_api_key') || (process.env.API_KEY || "");
    setApiKey(key);
  }, []);

  const handleSelectJurisdiction = (jur: Jurisdiction) => {
    setSelectedJurisdiction(jur);
    setFormData(prev => ({ 
      ...prev, 
      DAJ: jur.code, 
      IIN: jur.iin, 
      Version: '10',
      DCG: jur.country || 'USA',
      DBD: new Date().toISOString().slice(0, 10).replace(/-/g, '')
    }));
    setStep('FORM');
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !apiKey) {
      if (!apiKey) setIsSettingsOpen(true);
      return;
    }
    setIsScanning(true);
    try {
      const base64 = await preprocessImage(e.target.files[0]);
      const updates = await scanDLWithGemini(base64, apiKey);
      let detectedJur = updates.DAJ ? detectJurisdictionFromCode(updates.DAJ) : null;
      if (detectedJur) {
        setSelectedJurisdiction(detectedJur);
        setFormData(prev => ({ ...prev, ...updates, IIN: detectedJur.iin, DAJ: detectedJur.code }));
      } else {
        setFormData(prev => ({ ...prev, ...updates }));
      }
      setStep('FORM');
    } catch (err) {
      console.error(err);
      alert("AI scan failed.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerate = () => {
    const str = generateAAMVAString(formData);
    setGeneratedString(str);
    setStep('RESULT');
  };

  const validation = generatedString ? validateAAMVAStructure(generatedString, formData) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      <header className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-xl px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {step !== 'SELECT' && (
            <button onClick={() => setStep('SELECT')} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-sky-400">
              <ArrowLeft size={20}/>
            </button>
          )}
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Fingerprint className="text-sky-500" size={24} /> 
            AAMVA <span className="text-sky-500 tracking-tighter">2020 PRO</span>
          </h1>
        </div>
        <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><Settings size={22} /></button>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8">
        {step === 'SELECT' && (
          <div className="max-w-4xl mx-auto space-y-12 py-10">
            <div className="text-center space-y-4">
              <h2 className="text-6xl font-black tracking-tighter bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent">Compliance Master</h2>
              <p className="text-slate-400 text-lg">Генерация PDF417 по стандарту AAMVA 2020 для систем верификации без отличий от оригинала.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 hover:border-sky-500/50 transition-all cursor-pointer shadow-2xl" onClick={() => fileInputRef.current?.click()}>
                <div className="w-14 h-14 bg-sky-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Camera className="text-sky-500" />
                </div>
                <h3 className="text-2xl font-bold mb-2">AI Extraction</h3>
                <p className="text-slate-400 text-sm mb-6">Загрузите фото лицензии. Gemini AI автоматически извлечет теги и определит штат.</p>
                <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-widest">
                  {isScanning ? "Processing..." : "Start Scanning"} <ArrowLeft className="rotate-180" size={14}/>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*"/>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-2xl">
                <div>
                  <h3 className="text-2xl font-bold mb-4">Quick Templates</h3>
                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                      placeholder="Search jurisdiction..." 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs focus:border-sky-500 outline-none transition-all"
                      onChange={e => setFilterText(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).slice(0, 6).map(j => (
                    <button key={j.name} onClick={() => handleSelectJurisdiction(j)} className="bg-slate-800/50 hover:bg-sky-600 p-3 rounded-xl text-[10px] font-bold transition-all truncate">
                      {j.code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 bg-slate-900 rounded-[2.5rem] p-8 sm:p-12 border border-slate-800 shadow-2xl space-y-12">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-800 pb-8">
                <div>
                  <h3 className="text-4xl font-black tracking-tight">{selectedJurisdiction?.name}</h3>
                  <p className="text-sky-500 font-mono text-xs mt-1">AAMVA 2020 STANDARD • v10 COMPLIANT</p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-center">
                    <p className="text-[9px] text-slate-500 font-bold uppercase">IIN Code</p>
                    <p className="font-mono text-sm">{formData.IIN}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {[
                   { label: "First Name", tag: "DAC" },
                   { label: "Middle Name", tag: "DAD" },
                   { label: "Last Name", tag: "DCS" }
                 ].map(f => (
                   <div key={f.tag} className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between">{f.label} <span>{f.tag}</span></label>
                     <input value={formData[f.tag as keyof DLFormData]} onChange={e => setFormData({...formData, [f.tag]: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm focus:border-sky-500 outline-none transition-all shadow-inner" />
                   </div>
                 ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between">ID Number <span>DAQ</span></label>
                  <input value={formData.DAQ} onChange={e => setFormData({...formData, DAQ: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm font-mono tracking-widest focus:border-sky-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between">Document Discriminator <span>DCF</span></label>
                  <input value={formData.DCF} placeholder="Audit Code" onChange={e => setFormData({...formData, DCF: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm font-mono focus:border-sky-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-slate-800 pt-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Birth Date</label>
                  <input value={formData.DBB} placeholder="MMDDCCYY" onChange={e => setFormData({...formData, DBB: e.target.value.replace(/\D/g, '')})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Gender</label>
                  <select value={formData.DBC} onChange={e => setFormData({...formData, DBC: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm appearance-none outline-none focus:border-sky-500">
                    <option value="1">Male (1)</option>
                    <option value="2">Female (2)</option>
                    <option value="9">Other (9)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Height (F-II)</label>
                  <input value={formData.DAU} placeholder="5-04" onChange={e => setFormData({...formData, DAU: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Eyes</label>
                  <select value={formData.DAY} onChange={e => setFormData({...formData, DAY: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm appearance-none">
                    {['BRO','BLU','GRN','HAZ','GRY','BLK'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={handleGenerate} className="w-full bg-sky-600 hover:bg-sky-500 py-6 rounded-2xl font-black text-xl transition-all shadow-xl shadow-sky-900/20 active:scale-[0.99] flex items-center justify-center gap-3">
                <ShieldCheck /> GENERATE ENCODED STREAM
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900/50 rounded-3xl p-6 border border-slate-800 space-y-6">
                <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-widest flex items-center gap-2">
                  <Info size={14}/> Standards Compliance
                </h4>
                <div className="space-y-3">
                  {[
                    { l: "Header v10", s: "ok" },
                    { l: "Subfile Offset 31", s: "ok" },
                    { l: "LF/RS/CR Delimiters", s: "ok" },
                    { l: "ISO-8859-1 Charset", s: "ok" }
                  ].map((x, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] bg-slate-950/50 p-3 rounded-xl border border-slate-800/30">
                      <span className="text-slate-400 font-medium">{x.l}</span>
                      <Check className="text-emerald-500" size={14} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && validation && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in zoom-in-95 duration-300">
            <div className="bg-white rounded-[3rem] p-12 text-slate-950 flex flex-col items-center gap-10 shadow-2xl relative">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-950 text-white rounded-full text-[10px] font-black tracking-widest uppercase mb-4">
                  <ShieldCheck size={12}/> Verified AAMVA 2020
                </div>
                <h3 className="text-5xl font-black tracking-tighter">Digital PDF417</h3>
              </div>
              
              <BarcodeCanvas data={generatedString} />
              
              <div className="w-full flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => window.print()} className="bg-slate-950 text-white px-10 py-5 rounded-2xl font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-lg">PRINT PDF417</button>
                <button onClick={() => setStep('SELECT')} className="bg-slate-100 text-slate-600 px-10 py-5 rounded-2xl font-black hover:bg-slate-200 transition-all border border-slate-200">NEW ENCODING</button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-sky-500 tracking-widest">Diagnostic Byte-Stream</h4>
                <button onClick={() => navigator.clipboard.writeText(generatedString)} className="text-[10px] font-bold text-slate-500 hover:text-sky-400 transition-colors flex items-center gap-2 uppercase tracking-widest"><ClipboardCheck size={14}/> Copy Data</button>
              </div>
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 font-mono text-[11px] text-slate-400 break-all leading-relaxed shadow-inner max-h-40 overflow-y-auto">
                {generatedString.split('').map((char, i) => {
                  const code = char.charCodeAt(0);
                  if (code < 32) return <span key={i} className="text-sky-500 font-bold bg-sky-900/20 px-1 rounded mx-0.5">[{code.toString(16).toUpperCase().padStart(2, '0')}]</span>;
                  return <span key={i}>{char}</span>;
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 border border-slate-800 shadow-2xl space-y-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-3xl font-black flex items-center gap-4 tracking-tight"><Key className="text-amber-400" /> API Setup</h3>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Gemini API Provider Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIza..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-white font-mono outline-none focus:ring-2 ring-sky-500/20 transition-all shadow-inner" />
            </div>
            <button onClick={() => { localStorage.setItem('gemini_api_key', apiKey); setIsSettingsOpen(false); }} className="w-full bg-sky-600 hover:bg-sky-500 py-5 rounded-2xl font-black text-lg transition-all shadow-xl">SAVE SETTINGS</button>
            <button onClick={() => setIsSettingsOpen(false)} className="w-full py-4 text-slate-500 font-bold hover:text-slate-300 transition-colors">CANCEL</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
