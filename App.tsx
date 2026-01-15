
import React, { useState, useRef, useEffect } from 'react';
import { JURISDICTIONS } from './constants';
import { Jurisdiction, DLFormData, ValidationReport } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import { validateBarcode } from './utils/validator';
import BarcodeCanvas from './components/BarcodeCanvas';
import { 
  ArrowLeft, Camera, Loader2, Sparkles, Search, Settings, Key, FileText, Database, Fingerprint,
  ShieldCheck, ShieldAlert, AlertCircle, Info, RefreshCw
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
    IIN: '', Version: '08', JurisdictionVersion: '00', DDA: 'F',
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
      Version: jur.version, 
      DCG: jur.country || 'USA',
      DBD: new Date().toISOString().slice(0, 10).replace(/-/g, '')
    }));
    setStep('FORM');
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !apiKey) return;
    setIsScanning(true);
    try {
      const base64 = await preprocessImage(e.target.files[0]);
      const updates = await scanDLWithGemini(base64, apiKey);
      
      let detectedJur = null;
      if (updates.DAJ) {
        detectedJur = detectJurisdictionFromCode(updates.DAJ);
      }

      if (detectedJur) {
        setSelectedJurisdiction(detectedJur);
        setFormData(prev => ({ 
          ...prev, 
          ...updates, 
          IIN: detectedJur.iin, 
          Version: detectedJur.version,
          DAJ: detectedJur.code
        }));
      } else {
        setFormData(prev => ({ ...prev, ...updates }));
      }
      setStep('FORM');
    } catch (err) {
      alert("AI scan failed. Please verify your Gemini API key in settings.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerate = () => {
    const str = generateAAMVAString(formData);
    setGeneratedString(str);
    setStep('RESULT');
  };

  const resetAll = () => {
    setStep('SELECT');
    setGeneratedString("");
    setSelectedJurisdiction(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md px-4 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {step !== 'SELECT' && (
            <button onClick={resetAll} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-sky-400"/>
            </button>
          )}
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Fingerprint className="text-sky-500" /> 
            AAMVA <span className="text-sky-500">PRO</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {apiKey ? (
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-green-500/10 rounded-full border border-green-500/20">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-mono text-green-500 uppercase tracking-tight">API Active</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-red-500/10 rounded-full border border-red-500/20">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
              <span className="text-[10px] font-mono text-red-500 uppercase tracking-tight">API Required</span>
            </div>
          )}
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-slate-800 rounded-full transition-all text-slate-400">
            <Settings size={22} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-8">
        {step === 'SELECT' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Call to Action */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
              <Sparkles className="absolute -top-12 -right-12 w-48 h-48 text-sky-500/10 rotate-12 group-hover:text-sky-500/20 transition-all duration-700" />
              <div className="relative z-10 space-y-6">
                <h2 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  Scan Identity Card
                </h2>
                <p className="text-slate-400 max-w-md mx-auto text-sm sm:text-base">
                  Our advanced computer vision automatically extracts mandatory AAMVA tags from license photos.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="w-full sm:w-auto bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 px-8 py-4 rounded-2xl font-bold transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-sky-900/20"
                  >
                    {isScanning ? <RefreshCw className="animate-spin" size={20}/> : <Camera size={20}/>}
                    {isScanning ? "Processing..." : "Select Document Photo"}
                  </button>
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*"/>
            </div>

            {/* Jurisdiction Grid */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Database className="text-sky-500" size={22}/> Manual Entry
                </h3>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    placeholder="Search jurisdictions..." 
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                    onChange={e => setFilterText(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).map(j => (
                  <button 
                    key={j.name + j.iin} 
                    onClick={() => handleSelectJurisdiction(j)}
                    className="bg-slate-900/50 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 p-4 rounded-xl text-xs sm:text-sm font-medium transition-all group"
                  >
                    <div className="text-slate-100 group-hover:text-sky-400 transition-colors">{j.name}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{j.code} • IIN {j.iin}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-6 gap-4">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <FileText className="text-sky-500" /> Verify Information
                  </h3>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setFormData({...formData, DDA: formData.DDA === 'F' ? 'N' : 'F'})}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold transition-all border ${formData.DDA === 'F' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-orange-500/10 text-orange-500 border-orange-500/30'}`}
                    >
                      {formData.DDA === 'F' ? <ShieldCheck size={14}/> : <ShieldAlert size={14}/>}
                      {formData.DDA === 'F' ? 'REAL ID' : 'NON-REAL'}
                    </button>
                    <span className="bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 border border-slate-700">
                      {selectedJurisdiction?.code} Protocol
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Name Section */}
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-4 h-px bg-sky-400/30"></span> Personal Identity
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">First Name (DAC)</label>
                        <input 
                          value={formData.DAC} 
                          onChange={e => setFormData({...formData, DAC: e.target.value.toUpperCase()})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:ring-2 ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Last Name (DCS)</label>
                        <input 
                          value={formData.DCS} 
                          onChange={e => setFormData({...formData, DCS: e.target.value.toUpperCase()})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:ring-2 ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Middle/Suffix (DAD)</label>
                        <input 
                          value={formData.DAD} 
                          onChange={e => setFormData({...formData, DAD: e.target.value.toUpperCase()})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:ring-2 ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Attributes Section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Birth Date (MMDDCCYY)</label>
                      <input 
                        value={formData.DBB} 
                        placeholder="04101990"
                        onChange={e => setFormData({...formData, DBB: e.target.value.replace(/\D/g, '')})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono focus:ring-2 ring-sky-500/20 focus:border-sky-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Sex</label>
                      <select 
                        value={formData.DBC} 
                        onChange={e => setFormData({...formData, DBC: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:ring-2 ring-sky-500/20 focus:border-sky-500 outline-none"
                      >
                        <option value="1">Male</option>
                        <option value="2">Female</option>
                        <option value="9">Not Specified</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Height (F-II)</label>
                      <input 
                        value={formData.DAU} 
                        placeholder="5-04"
                        onChange={e => setFormData({...formData, DAU: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:ring-2 ring-sky-500/20 focus:border-sky-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Document Data Section */}
                  <div className="space-y-4 pt-4 border-t border-slate-800/50">
                    <h4 className="text-[11px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-4 h-px bg-sky-400/30"></span> Document Credentials
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">License Number (DAQ)</label>
                        <input 
                          value={formData.DAQ} 
                          onChange={e => setFormData({...formData, DAQ: e.target.value.toUpperCase()})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono focus:ring-2 ring-sky-500/20 focus:border-sky-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Discriminator (DCF)</label>
                        <input 
                          value={formData.DCF} 
                          placeholder="Audit/DD Number"
                          onChange={e => setFormData({...formData, DCF: e.target.value.toUpperCase()})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono focus:ring-2 ring-sky-500/20 focus:border-sky-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleGenerate}
                  className="w-full bg-sky-600 hover:bg-sky-500 py-5 rounded-2xl font-black text-lg shadow-xl shadow-sky-900/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                >
                  GENERATE PDF417 BARCODE
                </button>
              </div>
            </div>

            {/* Sidebar Controls */}
            <div className="space-y-6">
              <div className="bg-slate-900/50 rounded-3xl p-6 border border-slate-800 h-fit space-y-6">
                <h4 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                  <AlertCircle size={18} className="text-sky-400" /> AAMVA Metadata
                </h4>
                <div className="space-y-5 text-xs text-slate-400">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500">IIN (6 digits)</label>
                    <input 
                      value={formData.IIN} 
                      onChange={e => setFormData({...formData, IIN: e.target.value.replace(/\D/g, '').substring(0,6)})} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-slate-200 outline-none focus:border-sky-500/50" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500">Standard Version</label>
                    <select 
                      value={formData.Version} 
                      onChange={e => setFormData({...formData, Version: e.target.value})} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-sky-500/50"
                    >
                      <option value="01">01 (Legacy)</option>
                      <option value="03">03 (V3)</option>
                      <option value="08">08 (2016)</option>
                      <option value="10">10 (2020)</option>
                    </select>
                  </div>
                  <div className="pt-4 border-t border-slate-800/50 space-y-3">
                    <div className="flex items-start gap-2">
                      <Info size={14} className="text-sky-400/50 mt-0.5" />
                      <p className="leading-relaxed">This encoder uses <span className="text-slate-300">ISO-8859-1</span> encoding as required by AAMVA 2020 annex D.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
            <div className="bg-white rounded-[2.5rem] p-10 text-slate-950 flex flex-col items-center gap-10 shadow-2xl border-b-[8px] border-sky-500">
              <div className="text-center space-y-2">
                <h3 className="text-4xl font-black uppercase tracking-tighter italic">PDF417</h3>
                <div className="px-4 py-1.5 bg-slate-950 text-white rounded-full text-[10px] font-bold tracking-[0.2em] uppercase">
                  AAMVA Standard 2020
                </div>
              </div>
              
              <div className="w-full">
                <BarcodeCanvas data={generatedString} />
              </div>
              
              <div className="w-full grid grid-cols-2 gap-4">
                <button 
                  onClick={() => window.print()} 
                  className="bg-slate-950 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  PRINT BARCODE
                </button>
                <button 
                  onClick={() => setStep('SELECT')} 
                  className="bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 border border-slate-200"
                >
                  NEW ENTRY
                </button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between mb-4 px-2">
                <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest">Protocol Byte Stream</h4>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedString);
                    alert("Protocol stream copied to clipboard.");
                  }} 
                  className="text-[10px] font-bold text-sky-400 hover:text-sky-300 underline underline-offset-4"
                >
                  COPY STREAM
                </button>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-[11px] text-slate-400 break-all h-32 overflow-y-auto leading-relaxed shadow-inner">
                {generatedString}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-slate-900 w-full max-w-md rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <Key className="text-amber-400" /> API Settings
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white">
                <RefreshCw size={20} />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Gemini API Key</label>
              <input 
                type="password" 
                value={apiKey} 
                onChange={e => setApiKey(e.target.value)} 
                placeholder="AIza..." 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-mono outline-none focus:ring-2 ring-sky-500/20 focus:border-sky-500 transition-all" 
              />
              <p className="text-[10px] text-slate-500 italic mt-2 ml-1">
                Keys are stored locally in your browser and never touch our servers.
              </p>
            </div>
            <button 
              onClick={() => { 
                localStorage.setItem('gemini_api_key', apiKey); 
                setIsSettingsOpen(false); 
              }} 
              className="w-full bg-sky-600 hover:bg-sky-500 py-4 rounded-2xl font-black transition-all shadow-xl shadow-sky-900/20"
            >
              SAVE CONFIGURATION
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
