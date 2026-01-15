
import React, { useState, useRef, useEffect } from 'react';
import { JURISDICTIONS } from './constants';
import { Jurisdiction, DLFormData, ValidationReport } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import { validateBarcode } from './utils/validator';
import BarcodeCanvas from './components/BarcodeCanvas';
import { ArrowLeft, CreditCard, ShieldCheck, Camera, Loader2, Sparkles, ScanBarcode, CheckCircle, AlertTriangle, XCircle, Upload, FileText, Image as ImageIcon, Search, Maximize2, X, Trash2, Settings, Save, Key, Fingerprint, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [generatedString, setGeneratedString] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [filterText, setFilterText] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validatorInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<DLFormData>({
    IIN: '', Version: '10', JurisdictionVersion: '00', DDA: 'F',
    DCA: 'C', DCB: 'NONE', DCD: 'NONE', DBA: '20280101', DCS: '', DAC: '', DAD: '',
    DBD: '20230101', DBB: '19900101', DBC: '1', DAY: 'BRO', DAU: '070 IN',
    DAG: '', DAI: '', DAJ: '', DAK: '', DAQ: '', DCF: '', DCG: 'USA', DAW: '165', DAZ: 'BRO', DEB: ''
  });

  useEffect(() => {
    const key = localStorage.getItem('gemini_api_key') || (process.env.API_KEY || "");
    setApiKey(key);
    const now = new Date();
    setFormData(prev => ({ ...prev, DEB: now.toISOString().slice(0, 10).replace(/-/g, '') }));
  }, []);

  const handleSelectJurisdiction = (jur: Jurisdiction) => {
    setSelectedJurisdiction(jur);
    setFormData(prev => ({ ...prev, DAJ: jur.code, IIN: jur.iin, Version: jur.version, DCG: jur.country || 'USA' }));
    setGeneratedString("");
    setValidationReport(null);
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !apiKey) return;
    setIsScanning(true);
    setScanStatus("Analyzing...");
    try {
      const base64 = await preprocessImage(e.target.files[0]);
      const updates = await scanDLWithGemini(base64, apiKey);
      setFormData(prev => ({ ...prev, ...updates }));
      if (updates.DAJ) {
        const jur = detectJurisdictionFromCode(updates.DAJ);
        if (jur) setSelectedJurisdiction(jur);
      }
    } catch (err) {
      alert("AI extraction failed.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerate = () => {
    const str = generateAAMVAString(formData);
    setGeneratedString(str);
    setValidationReport(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-20 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {selectedJurisdiction && <button onClick={() => setSelectedJurisdiction(null)}><ArrowLeft className="text-sky-400"/></button>}
          <h1 className="text-xl font-bold flex items-center gap-2"><CreditCard className="text-sky-500"/> AAMVA <span className="text-sky-500">PRO</span></h1>
        </div>
        <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-slate-800 rounded-full"><Settings/></button>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {!selectedJurisdiction ? (
          <div className="space-y-10">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-6">
              <Sparkles className="mx-auto w-12 h-12 text-sky-400"/>
              <h2 className="text-2xl font-bold">AI ID Reader</h2>
              <p className="text-slate-400">Extract AAMVA 2020 standard data automatically from photo.</p>
              <button onClick={() => fileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-500 px-8 py-4 rounded-xl font-bold transition-all transform hover:scale-105">
                {isScanning ? <Loader2 className="animate-spin inline mr-2"/> : <Camera className="inline mr-2"/>}
                {isScanning ? "Processing..." : "Scan Identity Document"}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*"/>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-500"/>
                <input placeholder="Search jurisdiction..." className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-3" onChange={e => setFilterText(e.target.value)}/>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).map(j => (
                  <button key={j.name} onClick={() => handleSelectJurisdiction(j)} className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-sm hover:border-sky-500 transition-colors">
                    {j.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">First Name</label>
                  <input value={formData.DAC} onChange={e => setFormData({...formData, DAC: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3"/>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Last Name</label>
                  <input value={formData.DCS} onChange={e => setFormData({...formData, DCS: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3"/>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">ID Number (DAQ)</label>
                  <input value={formData.DAQ} onChange={e => setFormData({...formData, DAQ: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono"/>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">DOB (CCYYMMDD)</label>
                  <input value={formData.DBB} onChange={e => setFormData({...formData, DBB: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono"/>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Audit/DD (DCF)</label>
                  <input value={formData.DCF} onChange={e => setFormData({...formData, DCF: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono"/>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">State Code</label>
                  <div className="p-3 bg-slate-800/50 rounded-lg text-sky-400 font-bold">{formData.DAJ}</div>
                </div>
              </div>

              <button onClick={handleGenerate} className="w-full bg-sky-600 hover:bg-sky-500 py-4 rounded-xl font-bold shadow-lg shadow-sky-900/20 transition-all">
                Generate AAMVA 2020 Barcode
              </button>
            </div>

            {generatedString && (
              <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 space-y-6">
                <h3 className="font-bold flex items-center gap-2"><ScanBarcode/> Generated PDF417</h3>
                <BarcodeCanvas data={generatedString}/>
                <div className="p-4 bg-slate-950 rounded-lg">
                  <label className="text-[10px] font-bold text-slate-600 uppercase mb-2 block">Raw Byte Stream</label>
                  <pre className="text-[10px] font-mono text-slate-500 overflow-x-auto whitespace-pre-wrap">{generatedString}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2"><Key className="text-amber-400"/> Settings</h3>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">Gemini API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white font-mono"/>
            </div>
            <button onClick={() => { localStorage.setItem('gemini_api_key', apiKey); setIsSettingsOpen(false); }} className="w-full bg-sky-600 py-3 rounded-xl font-bold">Save Changes</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
