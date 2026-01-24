import React, { useEffect, useRef, useState } from 'react';
import bwipjs from 'bwip-js';

interface BarcodeSVGProps {
  data: string;
  onSuccess?: (dataUrl: string) => void;
}

const BarcodeSVG: React.FC<BarcodeSVGProps> = ({ data, onSuccess }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [printImg, setPrintImg] = useState<string | null>(null);

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const generate = async () => {
      setIsGenerating(true);
      setError(null);
      
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // AAMVA 2020 Annex D Requirements
        // Using cols: 12 to match the specific wide-stretched look from reference page 3
        await bwipjs.toCanvas(canvas, {
          bcid: 'pdf417',
          text: data,
          scale: 5, 
          height: 10, 
          cols: 12,
          eclevel: 5, 
          parsefnc: true, 
          paddingwidth: 10,
          paddingheight: 10,
          backgroundcolor: 'ffffff'
        });
        
        const dataUrl = canvas.toDataURL('image/png');
        setPrintImg(dataUrl);
        if (onSuccess) onSuccess(dataUrl);
        setError(null);
      } catch (e: any) {
        console.error('BwipJS Error:', e);
        setError(e.message || 'Matrix Generation Failed');
      } finally {
        setIsGenerating(false);
      }
    };

    const timer = setTimeout(generate, 100);
    return () => clearTimeout(timer);
  }, [data, onSuccess]);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-[2.5rem] border-4 border-slate-100 shadow-inner group min-h-[300px] w-full overflow-hidden print:border-none print:shadow-none print:p-0">
      {error ? (
        <div className="flex flex-col items-center gap-4 p-8 text-rose-500 bg-rose-50 rounded-3xl border border-rose-100 animate-in fade-in zoom-in no-print">
          <div className="p-3 bg-rose-500/10 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="text-center">
            <p className="font-black text-xs uppercase tracking-widest">Logic Conflict / Buffer Overflow</p>
            <p className="text-[10px] opacity-70 mt-1 font-mono">{error}</p>
          </div>
        </div>
      ) : (
        <div className="relative w-full flex justify-center items-center">
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10 rounded-2xl no-print">
              <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          
          <canvas 
            ref={canvasRef} 
            className={`max-w-full h-auto drop-shadow-2xl transition-all duration-700 print:hidden ${isGenerating ? 'opacity-20 scale-95' : 'opacity-100 scale-100 hover:scale-[1.01]'}`}
            style={{ imageRendering: 'pixelated' }}
          />

          {printImg && (
            <img 
              src={printImg} 
              alt="AAMVA 2020 Matrix" 
              className="hidden print:block w-full h-auto" 
              style={{ imageRendering: 'pixelated' }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default BarcodeSVG;