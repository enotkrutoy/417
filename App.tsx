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
    const datePart = compilationTime ? compilationTime.split(',')[0].replace(/\//g, '_') : '01_24_2026';
    const timePart = compilationTime ? compilationTime.split(',')[1].trim().replace(/:/g, '_') : '01_21_07';
    return `AAMVA_${safeId}_${datePart}_${timePart}`;
  }, [formData.DAQ, compilationTime]);

  useEffect(() => {
    if (step === 'RESULT') {
      document.title = docId;
    } else {
      document.title = "AAMVA Barcode Pro";
    }
  }, [step, docId]);

  const handleApplyPreset = (preset: DLDataPreset) => {
    setFormData(prev => ({ ...prev, ...preset.data }));
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    const now = new Date();
    const formatted = now.toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
    
    setCompilationStatus("Finalizing Bitstream...");
    await new Promise(r => setTimeout(r, 600));
    
    setCompilationTime(formatted);
    setIsCompiling(false);
    setStep('RESULT');
    window.scrollTo(0, 0);
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError(null);
    setScanAttempt(prev => prev + 1);
    
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
      setScanError(err.message || "Extraction failed.");
    } finally {
      setIsScanning(false);
    }
  };

  const PrintHeader = () => (
    <div className="hidden print:flex justify-between w-full text-[11px] text-slate-500 font-mono mb-8 border-b border-slate-100 pb-2">
      <div className="flex gap-2">
        <span>{new Date().toLocaleDateString()}</span>
        <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="uppercase font-bold">{docId}</div>
    </div>
  );

  const PrintFooter = ({ page }: { page: number }) => (
    <div className="hidden print:flex justify-between w-full text-[11px] text-slate-500 font-mono mt-auto pt-4 border-t border-slate-100">
      <div className="font-bold">{window.location.origin}</div>
      <div className="font-bold">{page}/5</div>
    </div>
  );

  if (step === 'SELECT') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-12 py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500/10 border border-sky-500/20 rounded-full text-sky-400 text-xs font-bold tracking-widest uppercase italic">
              <BrainCircuit size={14} /> Neural Engine 2025
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white uppercase italic">
              MATRIX <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-500">PRO</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-xl mx-auto italic font-medium">Compliance-first AAMVA PDF417 generation via neural OCR.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button onClick={() => fileInputRef.current?.click()} className="group relative overflow-hidden bg-slate-900 border-2 border-slate-800 hover:border-sky-500/50 rounded-[2.5rem] p-8 text-left transition-all hover:shadow-[0_0_40px_rgba(14,165,233,0.1)] active:scale-95 disabled:opacity-50">
              <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                <div className="p-4 bg-sky-500/10 rounded-2xl w-fit group-hover:bg-sky-500 group-hover:text-white transition-colors">
                  {isScanning ? <Loader2 size={32} className="animate-spin" /> : <Camera size={32} />}
                </div>
                <div><h3 className="text-2xl font-bold text-white mb-2 italic">Neural Scan</h3><p className="text-slate-400 italic">Automatic AAMVA field extraction.</p></div>
              </div>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onFileChange} />
            <div className="bg-slate-900 border-2 border-slate-800 rounded-[2.5rem] p-8 space-y-6">
              <div className="flex items-center gap-4 text-white"><div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400"><Layers size={24} /></div><h3 className="text-xl font-bold italic">Quick Presets</h3></div>
              <div className="space-y-3">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => { handleApplyPreset(p); setStep('FORM'); }} className="w-full p-4 bg-slate-800/50 hover:bg-slate-800 rounded-2xl text-left border border-slate-700/50 hover:border-indigo-500/30 transition-all flex justify-between items-center group">
                    <div><div className="font-bold text-slate-200 group-hover:text-white italic">{p.label}</div><div className="text-xs text-slate-500 italic">{p.description}</div></div>
                    <ArrowLeft size={18} className="rotate-180 opacity-0 group-hover:opacity-100 transition-all text-indigo-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'FORM') {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <button onClick={() => setStep('SELECT')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group italic"><ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />Back to Engine</button>
            <div className="flex gap-4">
              <button onClick={() => setStep('SELECT')} className="px-6 py-3 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all italic">Discard</button>
              <button onClick={handleCompile} className="px-8 py-3 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-sky-500/20 flex items-center gap-2 italic">
                {isCompiling ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />} Compile Matrix
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-800"><User className="text-sky-400" /><h2 className="text-xl font-bold text-white uppercase tracking-widest italic">Identity Elements</h2></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(['DCS', 'DAC', 'DAQ', 'DBB', 'DBA', 'DBD', 'DAJ', 'DAK'] as const).map(tag => (
                    <div key={tag} className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1 italic">{tag === 'DCS' ? 'Family Name' : tag === 'DAC' ? 'Given Name' : tag === 'DAQ' ? 'ID Number' : tag}</label>
                      <input value={formData[tag]} onChange={e => setFormData(p => ({ ...p, [tag]: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:border-sky-500 outline-none transition-all font-mono font-bold" />
                    </div>
                  ))}
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
      <div className="min-h-screen bg-slate-100/50 print:bg-white flex flex-col items-center">
        {/* Navigation Toolbar */}
        <div className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-full z-[100] no-print">
          <button onClick={() => setStep('FORM')} className="p-2.5 hover:bg-slate-100 rounded-full transition-colors text-slate-600"><Edit3 size={22} /></button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="text-sm font-black text-slate-950 px-2 italic uppercase">{docId}.pdf</div>
          <div className="h-5 w-px bg-slate-200" />
          <button onClick={() => window.print()} className="px-8 py-2.5 bg-slate-950 text-white rounded-full font-black hover:bg-slate-900 transition-all flex items-center gap-2 italic shadow-lg">
            <Printer size={20} />
            PRINT PDF
          </button>
        </div>

        {/* 5-Page Standard Compliant Structure */}
        <div className="flex flex-col gap-12 py-32 print:p-0 print:gap-0 w-full max-w-[210mm]">
          
          {/* Page 1: Source Attachment */}
          <div className="bg-white shadow-2xl print:shadow-none w-full aspect-[210/297] flex flex-col p-16 print:p-12 break-after-page relative overflow-hidden">
            <PrintHeader />
            <div className="flex-1 flex flex-col items-center justify-center gap-16">
              <div className="inline-flex items-center gap-4 px-12 py-6 bg-white border-2 border-slate-100 rounded-full shadow-lg">
                <ImageIcon className="text-sky-500" size={32} />
                <span className="text-sm font-black italic tracking-widest text-slate-950 uppercase italic">S O U R C E D O C U M E N T R E F E R E N C E</span>
              </div>
              
              <div className="w-full aspect-[4/3] rounded-[4rem] border-[16px] border-slate-50 shadow-inner overflow-hidden flex items-center justify-center bg-slate-50/50">
                {scannedImage ? (
                  <img src={scannedImage} className="w-full h-full object-cover" alt="Scan Reference" />
                ) : (
                  <div className="flex flex-col items-center text-slate-200 gap-6">
                    <Database size={80} />
                    <span className="font-mono text-xs font-bold">NO ATTACHED DATA IMAGE</span>
                  </div>
                )}
              </div>

              <div className="text-center space-y-4">
                <p className="text-[14px] font-black uppercase tracking-[0.5em] text-slate-950 italic">ATTACHED REFERENCE: {formData.DAQ || '39626584'}</p>
                <p className="text-[12px] font-mono text-slate-400 font-bold">{compilationTime}</p>
              </div>
            </div>
            <PrintFooter page={1} />
          </div>

          {/* Page 2: Blank Page (compliance spacer) */}
          <div className="bg-white shadow-2xl print:shadow-none w-full aspect-[210/297] flex flex-col p-16 break-after-page relative">
             <PrintHeader />
             <div className="flex-1" />
             <PrintFooter page={2} />
          </div>

          {/* Page 3: Primary Barcode Output (High Visibility) */}
          <div className="bg-white shadow-2xl print:shadow-none w-full aspect-[210/297] flex flex-col p-16 print:p-12 break-after-page relative">
            <PrintHeader />
            
            <div className="flex-1 flex flex-col items-center pt-28">
              {/* Massive Identity Header */}
              <div className="text-center mb-24 w-full">
                <h1 className="text-[120px] leading-[0.8] font-black italic tracking-tighter text-slate-950 mb-12">
                  {formData.DAQ || '39626584'}
                </h1>
                
                <div className="space-y-8">
                   <p className="text-[16px] font-mono font-bold tracking-[0.6em] text-slate-950 uppercase italic">
                    G E N E R A T E D : {compilationTime.replace(/,/g, ', ')}
                   </p>
                   
                   <div className="flex items-center justify-center gap-16 text-[15px] font-black tracking-[0.35em] uppercase">
                     <span className="text-slate-300 italic">AAMVA_2020_REV_1</span>
                     <span className="text-sky-500 italic">{(formData.DAJ || 'TX').substring(0,2)} NODE</span>
                   </div>
                </div>
              </div>

              {/* PDF417 Matrix Component */}
              <div className="w-full px-2">
                 <BarcodeSVG data={generatedString} />
              </div>
            </div>

            <PrintFooter page={3} />
          </div>

          {/* Page 4: Blank Spacer */}
          <div className="bg-white shadow-2xl print:shadow-none w-full aspect-[210/297] flex flex-col p-16 break-after-page relative">
            <PrintHeader />
            <div className="flex-1" />
            <PrintFooter page={4} />
          </div>

          {/* Page 5: Terminal Blank */}
          <div className="bg-white shadow-2xl print:shadow-none w-full aspect-[210/297] flex flex-col p-16 relative">
            <PrintHeader />
            <div className="flex-1" />
            <PrintFooter page={5} />
          </div>

        </div>
        
        {/* Final Style Injection for Perfect Print Rendering */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body { background: white !important; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none !important; }
            @page { size: A4 portrait; margin: 0; }
            .break-after-page { page-break-after: always; break-after: page; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        `}} />
      </div>
    );
  }

  return null;
};

export default App;