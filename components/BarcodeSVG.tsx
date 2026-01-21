
import React, { useEffect, useRef, useState } from 'react';
import bwipjs from 'bwip-js';

interface BarcodeSVGProps {
  data: string;
}

const BarcodeSVG: React.FC<BarcodeSVGProps> = ({ data }) => {
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

        // Параметры согласно AAMVA 2020 Annex D
        await bwipjs.toCanvas(canvas, {
          bcid: 'pdf417',
          text: data,
          scale: 3,
          height: 15,
          eclevel: 5,
          parsefnc: true, 
          paddingwidth: 15,
          paddingheight: 15,
          backgroundcolor: 'ffffff'
        });
        
        // Создаем DataURL для надежной печати (некоторые браузеры лучше печатают <img> чем <canvas>)
        setPrintImg(canvas.toDataURL('image/png'));
        setError(null);
      } catch (e: any) {
        console.error('BwipJS Critical Error:', e);
        setError(e.message || 'Matrix Generation Failed');
      } finally {
        setIsGenerating(false);
      }
    };

    const timer = setTimeout(generate, 150);
    return () => clearTimeout(timer);
  }, [data]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-[2.5rem] border-4 border-slate-100 shadow-inner group min-h-[300px] w-full overflow-hidden print:border-none print:shadow-none print:p-0">
      {error ? (
        <div className="flex flex-col items-center gap-4 p-8 text-rose-500 bg-rose-50 rounded-3xl border border-rose-100 animate-in fade-in zoom-in no-print">
          <div className="p-3 bg-rose-500/10 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="text-center">
            <p className="font-black text-xs uppercase tracking-widest">Buffer Overflow / Data Invalid</p>
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
          
          {/* Canvas для экранного отображения */}
          <canvas 
            ref={canvasRef} 
            className={`max-w-full h-auto drop-shadow-2xl transition-all duration-700 print:hidden ${isGenerating ? 'opacity-20 scale-95' : 'opacity-100 scale-100 hover:scale-[1.02]'}`}
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Image для печати (скрыта на экране) */}
          {printImg && (
            <img 
              src={printImg} 
              alt="Barcode for Print" 
              className="hidden print:block max-w-full h-auto" 
              style={{ imageRendering: 'pixelated' }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default BarcodeSVG;
