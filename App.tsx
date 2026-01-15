
import React, { useState, useRef, useEffect } from 'react';
import { JURISDICTIONS } from './constants';
import { Jurisdiction, DLFormData, ValidationReport } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import { validateBarcode } from './utils/validator';
import BarcodeCanvas from './components/BarcodeCanvas';
import { 
  ArrowLeft, CreditCard, ShieldCheck, Camera, Loader2, Sparkles, ScanBarcode, 
  CheckCircle, AlertTriangle, XCircle, Search, Settings, Save, Key, Info, 
  FileText, Database, ShieldAlert, Fingerprint
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'SELECT' | 'FORM' | 'RESULT'>('SELECT');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [generatedString, setGeneratedString] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [filterText, setFilterText] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<DLFormData>({
    IIN: '', Version: '10', JurisdictionVersion: '00', DDA: 'F',
    DCA: 'C', DCB: 'NONE', DCD: 'NONE', DBA: '', DCS: '', DAC: '', DAD: '',
    DBD: '', DBB: '', DBC: '1', DAY: 'BRO', DAU: '070 IN',
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
      
      if (updates.DAJ) {
        const jur = detectJurisdictionFromCode(updates.DAJ);
        if (jur) {
          setSelectedJurisdiction(jur);
          setFormData(prev => ({ ...prev, ...updates, IIN: jur.iin, Version: jur.version }));
        } else {
          setFormData(prev => ({ ...prev, ...updates }));
        }
      } else {
        setFormData(prev => ({ ...prev, ...updates }));
      }
      setStep('FORM');
    } catch (err) {
      alert("Failed to analyze image. Please check API Key.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerate = () => {
    const str = generateAAMVAString(formData);
    setGeneratedString(str);
    setStep('RESULT');
  };

  const reset = () => {
    setStep('SELECT');
    setGeneratedString("");
    setValidationReport(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {step !== 'SELECT' && (
            <button onClick={reset} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-sky-400"/>
            </button>
          )}
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Fingerprint className="text-sky-500" /> 
            AAMVA <span className="text-sky-500">PRO</span>
          </h1>
        </div>
        <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <Settings size={20} className="text-slate-400" />
        </button>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-8">
        {step === 'SELECT' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* AI Call to Action */}
            <div className="relative group overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center shadow-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles size={120} className="text-sky-400" />
              </div>
              <h2 className="text-3xl font-extrabold mb-4 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Scan ID to Auto-Fill
              </h2>
              <p className="text-slate-400 max-w-md mx-auto mb-8">
                Use Google Gemini Vision to extract AAMVA data directly from a license photo.
              </p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 px-10 py-4 rounded-2xl font-bold transition-all transform hover:scale-105 flex items-center gap-3 mx-auto shadow-lg shadow-sky-900/20"
              >
                {isScanning ? <Loader2 className="animate-spin" /> : <Camera />}
                {isScanning ? "Analyzing Document..." : "Quick Scan Identity Card"}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*"/>
            </div>

            {/* Jurisdiction Grid */}
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Database size={20} className="text-sky-500" /> Or Select Jurisdiction
                </h3>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    placeholder="Search states..." 
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 focus:border-sky-500 outline-none transition-all"
                    onChange={e => setFilterText(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).map(j => (
                  <button 
                    key={j.name + j.iin} 
                    onClick={() => handleSelectJurisdiction(j)}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-sky-500 p-4 rounded-xl text-sm font-medium transition-all text-center"
                  >
                    {j.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl space-y-8">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    <FileText className="text-sky-500" /> Identity Details
                  </h3>
                  <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded-full text-slate-400">
                    {selectedJurisdiction?.code} Standard 2020
                  </span>
                </div>

                {/* Form Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">First Name (DAC)</label>
                    <input 
                      value={formData.DAC} 
                      onChange={e => setFormData({...formData, DAC: e.target.value.toUpperCase()})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Name (DCS)</label>
                    <input 
                      value={formData.DCS} 
                      onChange={e => setFormData({...formData, DCS: e.target.value.toUpperCase()})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ID Number (DAQ)</label>
                    <input 
                      value={formData.DAQ} 
                      onChange={e => setFormData({...formData, DAQ: e.target.value.toUpperCase()})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">DOB (MMDDCCYY)</label>
                    <input 
                      value={formData.DBB} 
                      placeholder="01011990"
                      onChange={e => setFormData({...formData, DBB: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Street Address (DAG)</label>
                    <input 
                      value={formData.DAG} 
                      onChange={e => setFormData({...formData, DAG: e.target.value.toUpperCase()})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-sky-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex gap-4">
                  <button 
                    onClick={handleGenerate}
                    className="flex-1 bg-sky-600 hover:bg-sky-500 py-4 rounded-2xl font-extrabold shadow-lg shadow-sky-900/20 transition-all active:scale-95"
                  >
                    Generate AAMVA 2020 PDF417
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar info */}
            <div className="space-y-6">
              <div className="bg-slate-900/50 rounded-3xl p-6 border border-slate-800">
                <h4 className="font-bold flex items-center gap-2 mb-4">
                  <Info size={18} className="text-sky-400" /> Requirements
                </h4>
                <ul className="text-xs text-slate-400 space-y-3">
                  <li className="flex gap-2">
                    <CheckCircle size={14} className="text-green-500 shrink-0" />
                    All mandatory tags (20+) will be included in the PDF417 stream.
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle size={14} className="text-green-500 shrink-0" />
                    21-byte ANSI header is automatically calculated.
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle size={14} className="text-green-500 shrink-0" />
                    ISO-8859-1 compatible encoding.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in-95 duration-300">
            <div className="bg-white rounded-3xl p-8 text-slate-950 flex flex-col items-center gap-6 shadow-2xl border-4 border-sky-500">
              <div className="text-center">
                <h3 className="text-2xl font-black uppercase tracking-tighter">AAMVA PDF417</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest -mt-1">Standard 2020 Compliant</p>
              </div>
              
              <BarcodeCanvas data={generatedString} />
              
              <div className="w-full flex gap-3">
                <button 
                  onClick={() => window.print()}
                  className="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                >
                  Print Barcode
                </button>
                <button 
                  onClick={reset}
                  className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300 transition-all"
                >
                  Create New
                </button>
              </div>
            </div>

            {/* Debug Raw View */}
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                  <Database size={14}/> Raw Byte Stream (2020 Structure)
                </h4>
                <button 
                  onClick={() => navigator.clipboard.writeText(generatedString)}
                  className="text-[10px] text-sky-400 hover:underline"
                >
                  Copy String
                </button>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-400 break-all leading-relaxed h-32 overflow-y-auto whitespace-pre-wrap">
                {generatedString}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 w-full max-w-md rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <Key className="text-amber-400" /> API Settings
            </h3>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Google Gemini API Key</label>
              <input 
                type="password" 
                value={apiKey} 
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono outline-none focus:border-sky-500 transition-all"
              />
            </div>
            <p className="text-[10px] text-slate-500 italic">
              Keys are stored locally in your browser and never sent to our servers.
            </p>
            <button 
              onClick={() => { localStorage.setItem('gemini_api_key', apiKey); setIsSettingsOpen(false); }}
              className="w-full bg-sky-600 hover:bg-sky-500 py-3 rounded-xl font-bold transition-all"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
