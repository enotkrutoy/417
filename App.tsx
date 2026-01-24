
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { JURISDICTIONS, PRESETS } from './constants';
import { Jurisdiction, DLFormData, DLDataPreset } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import { validateAAMVAStructure } from './utils/validator';
import BarcodeSVG from './components/BarcodeSVG';
import { 
  ArrowLeft, Camera, ShieldCheck, Check, Info, Heart, AlertCircle, Zap, 
  Activity, Terminal, Printer, Edit3, Loader2,
  Database, RefreshCcw, Copy, Layout,
  Hash, Calendar, MapPin, Ruler, Eye, Briefcase,
  AlertTriangle, Fingerprint, Shield, Box, Layers,
  FileText, CreditCard, Sparkles, BrainCircuit, Image as ImageIcon,
  Download, ExternalLink, ChevronRight, Gauge, User
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
  const [scanError, setScanError] = useState<string | null>(null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string | null>(null);
  const [showComplianceDetail, setShowComplianceDetail] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<DLFormData>({
    IIN: '', Version: '10', JurisdictionVersion: '00', subfileType: 'DL',
    DCA: 'C', DCB: 'NONE', DCD: 'NONE', DBA: '', DCS: '', DAC: '', DAD: '',
    DBD: '', DBB: '', DBC: '1', DAY: 'BRO', DAU: '070 IN',
    DAG: '', DAI: '', DAJ: '', DAK: '', DAQ: '', DCF: '', DCG: 'USA', 
    DAH: '', DAZ: 'BRO', DCI: '', DCJ: '', DCK: '', DBN: '', DBG: '',
    DBS: '', DCU: '', DCE: '', DCL: '', DCM: '', DCN: '', DCO: '',
    DCP: '', DCQ: '', DCR: '', DDA: 'F', DDB: '', DDC: '', DDD: '0',
    DAW: '', DAX: '', DDH: '', DDI: '', DDJ: '', DDK: '0', DDL: '0',
    DDE: 'N', DDF: 'N', DDG: 'N'
  });

  const generatedString = useMemo(() => generateAAMVAString(formData), [formData]);
  const validation = useMemo(() => validateAAMVAStructure(generatedString, formData), [generatedString, formData]);

  const docId = useMemo(() => {
    const safeId = (formData.DAQ || '39626584').replace(/[^a-zA-Z0-9]/g, '');
    const datePart = compilationTime ? compilationTime.split(',')[0].replace(/\//g, '_') : '01_24_2025';
    return `MATRIX_NODE_${safeId}_${datePart}`;
  }, [formData.DAQ, compilationTime]);

  const handleApplyPreset = (preset: DLDataPreset) => {
    setFormData(prev => ({ ...prev, ...preset.data }));
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    setCompilationStatus("Synchronizing Bitstream...");
    await new Promise(r => setTimeout(r, 800));
    
    setCompilationTime(new Date().toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }));
    setIsCompiling(false);
    setStep('RESULT');
    window.scrollTo(0, 0);
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const base64 = await preprocessImage(file);
      setScannedImage(`data:image/jpeg;base64,${base64}`);
      const result = await scanDLWithGemini(base64, setScanStatusMsg);
      const jur = detectJurisdictionFromCode(result.DAJ);
      if (jur) {
        setSelectedJurisdiction(jur);
        setFormData(prev => ({ ...prev, ...result, IIN: jur.iin, Version: jur.version, DCG: jur.country || 'USA' }));
      } else {
        setFormData(prev => ({ ...prev, ...result }));
      }
      setStep('FORM');
    } catch (err: any) {
      setScanError(err.message || "Matrix Extraction Failed");
    } finally {
      setIsScanning(false);
    }
  };

  const InputField = ({ tag, label, icon: Icon, placeholder = "" }: { tag: string, label: string, icon?: any, placeholder?: string }) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        {Icon && <Icon size={12} className="text-slate-500" />}
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono-tech">{label} ({tag})</label>
      </div>
      <input 
        value={formData[tag] || ''} 
        onChange={e => setFormData(p => ({ ...p, [tag]: e.target.value }))}
        className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 outline-none transition-all font-mono text-sm"
        placeholder={placeholder}
      />
    </div>
  );

  const PrintHeader = () => (
    <div className="hidden print:flex justify-between w-full text-[10px] text-slate-400 font-mono-tech mb-10 border-b border-slate-100 pb-4">
      <div className="flex gap-4">
        <span>GENERATED: {compilationTime}</span>
        <span>NODE: {formData.DAJ || 'XX'}</span>
      </div>
      <div className="uppercase font-bold tracking-widest text-slate-900">{docId}</div>
    </div>
  );

  if (step === 'SELECT') {
    return (
      <div className="min-h-screen text-slate-200 p-6 md:p-12 flex flex-col items-center justify-center relative">
        <div className="w-full max-w-4xl space-y-16 py-12">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-sky-500/10 border border-sky-500/30 rounded-full text-sky-400 text-[10px] font-black tracking-[0.3em] uppercase animate-pulse">
              <BrainCircuit size={16} /> Matrix Neural Engine v3.0
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white uppercase italic leading-none">
              MATRIX <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-600">PRO</span>
            </h1>
            <p className="text-slate-400 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
              Standard-Compliant AAMVA PDF417 Generation. <br/>
              <span className="text-sky-500/60 font-mono-tech text-sm uppercase tracking-widest">Protocol: ANSI-15434 / Version: 2025.1</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isScanning}
              className="group relative overflow-hidden bg-slate-900/40 border border-slate-800 hover:border-sky-500/50 rounded-[3rem] p-10 text-left transition-all hover:shadow-[0_0_80px_rgba(14,165,233,0.15)] active:scale-[0.98] disabled:opacity-50"
            >
              <div className="relative z-10 flex flex-col h-full justify-between gap-12">
                <div className="p-5 bg-sky-500/10 rounded-3xl w-fit group-hover:bg-sky-500 group-hover:text-white transition-all duration-500">
                  {isScanning ? <Loader2 size={40} className="animate-spin" /> : <Camera size={40} />}
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white mb-3 italic tracking-tight">Neural Scan</h3>
                  <p className="text-slate-400 italic font-medium leading-snug">Extract identity metadata from any US/CAN driver's license automatically.</p>
                </div>
              </div>
              {isScanning && (
                 <div className="absolute bottom-0 left-0 w-full h-1 bg-sky-500/20">
                   <div className="h-full bg-sky-500 animate-[loading_2s_infinite]" />
                 </div>
              )}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onFileChange} />

            <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-10 space-y-8 backdrop-blur-sm">
              <div className="flex items-center gap-4 text-white">
                <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400"><Layers size={28} /></div>
                <h3 className="text-2xl font-black italic tracking-tight">Presets</h3>
              </div>
              <div className="space-y-4">
                {PRESETS.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => { handleApplyPreset(p); setStep('FORM'); }} 
                    className="w-full p-5 bg-slate-800/30 hover:bg-slate-800/60 rounded-2xl text-left border border-slate-700/30 hover:border-indigo-500/40 transition-all flex justify-between items-center group"
                  >
                    <div>
                      <div className="font-black text-slate-100 group-hover:text-white italic tracking-wide">{p.label}</div>
                      <div className="text-[11px] text-slate-500 italic mt-1 font-mono-tech">{p.description}</div>
                    </div>
                    <ChevronRight size={20} className="opacity-0 group-hover:opacity-100 transition-all text-indigo-400 translate-x-[-10px] group-hover:translate-x-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {scanError && (
            <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-3xl flex items-center gap-4 text-rose-400 font-bold italic animate-in fade-in slide-in-from-bottom-4">
              <AlertCircle size={24} />
              <span>{scanError}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'FORM') {
    return (
      <div className="min-h-screen p-4 md:p-10 flex flex-col items-center">
        <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-8">
          {/* Main Form Area */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between gap-4">
               <button onClick={() => setStep('SELECT')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group italic font-bold">
                 <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                 Engine Root
               </button>
               <div className="flex gap-4">
                 <button onClick={handleCompile} className="px-10 py-4 bg-white text-slate-950 font-black rounded-2xl hover:bg-slate-200 transition-all shadow-xl shadow-sky-500/10 flex items-center gap-3 italic">
                    {isCompiling ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} fill="currentColor" />}
                    Initialize Matrix
                 </button>
               </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-[3rem] p-8 md:p-12 backdrop-blur-md">
              <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-800">
                <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400"><Database size={24} /></div>
                <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] italic">Element Registry</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Identity Group */}
                <div className="space-y-6">
                  <h4 className="text-sky-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">I. Identity Manifest</h4>
                  {/* Fix: use the imported User icon */}
                  <InputField tag="DCS" label="Family Name" icon={User} />
                  <InputField tag="DAC" label="Given Name" icon={User} />
                  <InputField tag="DAD" label="Middle Name" icon={User} />
                  <div className="grid grid-cols-2 gap-4">
                    <InputField tag="DAQ" label="License ID" icon={Hash} />
                    <InputField tag="DBC" label="Sex (1/2/9)" icon={Fingerprint} />
                  </div>
                </div>

                {/* Physical/Dates Group */}
                <div className="space-y-6">
                  <h4 className="text-sky-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">II. Biological / Temporal</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField tag="DBB" label="Birth Date" icon={Calendar} placeholder="YYYYMMDD" />
                    <InputField tag="DBA" label="Expiry Date" icon={Calendar} placeholder="YYYYMMDD" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField tag="DAU" label="Height" icon={Ruler} placeholder="070 IN" />
                    <InputField tag="DAY" label="Eye Color" icon={Eye} placeholder="BRO" />
                  </div>
                  <InputField tag="DBD" label="Issue Date" icon={Calendar} />
                </div>

                {/* Geography Group */}
                <div className="space-y-6">
                  <h4 className="text-sky-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">III. Geospatial Node</h4>
                  <InputField tag="DAG" label="Address" icon={MapPin} />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1"><InputField tag="DAJ" label="State" /></div>
                    <div className="col-span-2"><InputField tag="DAI" label="City" /></div>
                  </div>
                  <InputField tag="DAK" label="Postal Code" icon={Hash} />
                </div>

                {/* Credential Group */}
                <div className="space-y-6">
                  <h4 className="text-sky-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">IV. Protocol Context</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField tag="DCA" label="Class" icon={Briefcase} />
                    <InputField tag="DCG" label="Country" icon={Shield} />
                  </div>
                  <InputField tag="DCF" label="Document Discriminator" icon={ShieldCheck} />
                  <div className="grid grid-cols-2 gap-4">
                     <InputField tag="DDA" label="Compliance" />
                     <InputField tag="DDD" label="Limited Duration" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Side Compliance Tracker */}
          <div className="w-full lg:w-[400px] space-y-6">
            <div className="sticky top-10 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-6 opacity-10"><Gauge size={80} /></div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Compliance Score</h3>
                <div className="flex items-end gap-2 mb-2">
                  <span className={`text-6xl font-black italic ${validation.overallScore > 90 ? 'text-emerald-400' : validation.overallScore > 70 ? 'text-amber-400' : 'text-rose-500'}`}>
                    {validation.overallScore}
                  </span>
                  <span className="text-slate-600 font-black text-xl mb-2">/ 100</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-8">
                   <div 
                    className={`h-full transition-all duration-1000 ${validation.overallScore > 90 ? 'bg-emerald-500' : validation.overallScore > 70 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                    style={{ width: `${validation.overallScore}%` }}
                   />
                </div>

                <div className="space-y-3">
                   {validation.complianceNotes.slice(0, 4).map((note, i) => (
                     <div key={i} className="flex gap-3 text-[11px] text-slate-400 font-mono-tech leading-relaxed">
                       <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                       <span>{note}</span>
                     </div>
                   ))}
                   {validation.complianceNotes.length === 0 && (
                     <div className="flex gap-3 text-[11px] text-emerald-400 font-mono-tech italic">
                        <Check size={14} />
                        <span>Protocol Synchronized. All fields compliant.</span>
                     </div>
                   )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl shadow-sky-500/10">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Live Matrix Preview</div>
                <div className="scale-[0.85] origin-top">
                  <BarcodeSVG data={generatedString} onSuccess={setBarcodeDataUrl} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'RESULT') {
    return (
      <div className="min-h-screen bg-slate-100 print:bg-white flex flex-col items-center">
        {/* Persistent Toolbar */}
        <div className="fixed top-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-4 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-[2rem] z-[100] no-print w-full max-w-lg md:w-fit">
          <button onClick={() => setStep('FORM')} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-600 flex items-center gap-2 font-black text-xs uppercase tracking-widest">
            <Edit3 size={18} /> Edit
          </button>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <div className="flex-1 text-center md:text-left">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Generated Matrix Node</div>
            <div className="text-xs font-black text-slate-950 truncate max-w-[150px]">{docId}</div>
          </div>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <button onClick={() => window.print()} className="px-8 py-3 bg-slate-950 text-white rounded-2xl font-black hover:bg-slate-900 transition-all flex items-center gap-2 italic text-xs tracking-widest shadow-lg active:scale-95">
            <Printer size={18} /> PRINT
          </button>
          <button onClick={() => {
              const link = document.createElement('a');
              link.href = barcodeDataUrl || '';
              link.download = `${docId}.png`;
              link.click();
          }} className="p-3 bg-sky-500 text-white rounded-2xl transition-all hover:bg-sky-400 shadow-lg shadow-sky-500/20">
            <Download size={18} />
          </button>
        </div>

        {/* 5-Page Compliance Structure */}
        <div className="flex flex-col gap-16 py-36 print:p-0 print:gap-0 w-full max-w-[210mm]">
          
          {/* Page 1: Source Attachment */}
          <div className="bg-white shadow-2xl print:shadow-none w-full aspect-[210/297] flex flex-col p-16 print:p-12 break-after-page relative overflow-hidden">
            <PrintHeader />
            <div className="flex-1 flex flex-col items-center justify-center gap-16 border-[1px] border-dashed border-slate-200 rounded-[3rem]">
              <div className="flex flex-col items-center gap-6">
                <div className="p-8 bg-slate-50 rounded-full text-slate-200">
                   <ImageIcon size={64} />
                </div>
                <div className="text-center space-y-2">
                  <span className="text-xs font-black italic tracking-[0.5em] text-slate-950 uppercase">SOURCE DOCUMENT REFERENCE</span>
                  <p className="text-[10px] text-slate-400 font-mono-tech">ATTACHMENT ID: {formData.DAQ || 'NONE'}</p>
                </div>
              </div>
              
              <div className="w-[85%] aspect-[4/3] rounded-[3rem] border-[12px] border-slate-50 shadow-inner overflow-hidden flex items-center justify-center bg-slate-50/30">
                {scannedImage ? (
                  <img src={scannedImage} className="w-full h-full object-cover grayscale opacity-80" alt="Scan Reference" />
                ) : (
                  <div className="flex flex-col items-center text-slate-100 gap-6">
                    <Database size={100} />
                    <span className="font-mono text-[10px] font-bold text-slate-300 tracking-widest">DATA IMAGE NOT ATTACHED</span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-10 text-center">
               <p className="text-[10px] font-mono-tech text-slate-300 uppercase italic">AAMVA 2020 Compliance Archive Node v1.0</p>
            </div>
            <div className="mt-auto flex justify-between text-[9px] font-black text-slate-300 uppercase tracking-widest pt-8 border-t border-slate-50">
               <span>MATRIX PRO 2025</span>
               <span>PAGE 01 / 05</span>
            </div>
          </div>

          {/* Page 2: Blank Page (compliance spacer) */}
          <div className="bg-white shadow-2xl print:shadow-none w-full aspect-[210/297] flex flex-col p-16 break-after-page relative">
             <PrintHeader />
             <div className="flex-1 flex items-center justify-center">
                <div className="text-[10px] font-mono-tech text-slate-100 uppercase tracking-[2em] -rotate-45">INTENTIONALLY BLANK</div>
             </div>
             <div className="mt-auto flex justify-between text-[9px] font-black text-slate-300 uppercase tracking-widest pt-8">
               <span>MATRIX PRO 2025</span>
               <span>PAGE 02 / 05</span>
            </div>
          </div>

          {/* Page 3: Primary Barcode Output */}
          <div className="bg-white shadow-2xl print:shadow-none w-full aspect-[210/297] flex flex-col p-16 print:p-12 break-after-page relative">
            <PrintHeader />
            
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <div className="text-center mb-16 w-full">
                <div className="text-[10px] font-black text-sky-500 uppercase tracking-[0.8em] mb-4">SYNCHRONIZED BITSTREAM</div>
                <h1 className="text-[80px] leading-[0.8] font-black italic tracking-tighter text-slate-950 mb-8 font-mono-tech break-all uppercase">
                  {formData.DAQ || '39626584'}
                </h1>
                
                <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-[12px] font-black tracking-[0.3em] uppercase">
                   <span className="text-slate-400 italic">JUR: {(formData.DAJ || 'XX').substring(0,2)}</span>
                   <span className="text-slate-400 italic">TYPE: {formData.subfileType || 'DL'}</span>
                   <span className="text-slate-400 italic">VER: {formData.Version || '10'}</span>
                </div>
              </div>

              {/* PDF417 Matrix Component */}
              <div className="w-full max-w-[95%] border-[1px] border-slate-100 p-8 rounded-[2rem]">
                 <BarcodeSVG data={generatedString} onSuccess={setBarcodeDataUrl} />
              </div>

              <div className="mt-16 w-full grid grid-cols-2 gap-8 text-left border-t border-slate-100 pt-10">
                 <div className="space-y-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">AAMVA PROTOCOL SPEC</span>
                    <p className="text-[10px] font-mono-tech text-slate-800 leading-relaxed break-all">
                      @\n\x1E\rANSI {formData.IIN}{formData.Version}{formData.JurisdictionVersion}01{formData.subfileType}0031{generateAAMVAString(formData).length.toString().padStart(4, '0')}
                    </p>
                 </div>
                 <div className="space-y-2 text-right">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ENCRYPTION ENGINE</span>
                    <p className="text-[10px] font-mono-tech text-slate-800 italic uppercase">REED-SOLOMON LEVEL 5</p>
                 </div>
              </div>
            </div>

            <div className="mt-auto flex justify-between text-[9px] font-black text-slate-300 uppercase tracking-widest pt-8 border-t border-slate-50">
               <span>MATRIX PRO 2025</span>
               <span>PAGE 03 / 05</span>
            </div>
          </div>

          {/* Page 4 & 5: Compliance Spacers */}
          {[4, 5].map(p => (
            <div key={p} className="bg-white shadow-2xl print:shadow-none w-full aspect-[210/297] flex flex-col p-16 break-after-page relative">
              <PrintHeader />
              <div className="flex-1" />
              <div className="mt-auto flex justify-between text-[9px] font-black text-slate-300 uppercase tracking-widest pt-8">
                <span>MATRIX PRO 2025</span>
                <span>PAGE 0{p} / 05</span>
              </div>
            </div>
          ))}

        </div>
        
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body { background: white !important; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none !important; }
            @page { size: A4 portrait; margin: 0; }
            .break-after-page { page-break-after: always; break-after: page; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}} />
      </div>
    );
  }

  return null;
};

export default App;
