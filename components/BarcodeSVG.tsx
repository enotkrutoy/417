import React, { useEffect, useState } from 'react';
import bwipjs from 'bwip-js';

interface BarcodeSVGProps {
  data: string;
}

const BarcodeSVG: React.FC<BarcodeSVGProps> = ({ data }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      try {
        // AAMVA 2020 Annex D.5.4.5: eclevel 5 recommended
        // D.5.4.2: Row height >= 3X (height: 15 / scale: 3 = 5X)
        const svgOutput = bwipjs.toSVG({
          bcid: 'pdf417',
          text: data,
          scale: 3,             
          height: 15,            
          eclevel: 5,           
          paddingwidth: 10,     // Enhanced Quiet Zone
          paddingheight: 10,
          backgroundcolor: 'ffffff'
        });
        setSvg(svgOutput);
        setError(null);
      } catch (e: any) {
        console.error('Barcode Generation Error:', e);
        setError(e.message || 'Generation failed');
      }
    }
  }, [data]);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-[3rem] border-4 border-slate-100 shadow-inner group min-h-[300px]">
      {error ? (
        <div className="text-rose-500 font-mono text-[10px] uppercase text-center bg-rose-50 p-4 rounded-xl border border-rose-100">
          Matrix Overload: {error}<br/>Reduce optional data payload.
        </div>
      ) : svg ? (
        <div 
          dangerouslySetInnerHTML={{ __html: svg }} 
          className="max-w-full h-auto drop-shadow-xl transition-transform duration-500 group-hover:scale-[1.01]"
          style={{ imageRendering: 'auto' }}
        />
      ) : (
        <div className="w-64 h-32 bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center text-slate-300 font-black uppercase text-[10px] tracking-widest">
          Synthesizing Matrix...
        </div>
      )}
    </div>
  );
};

export default BarcodeSVG;