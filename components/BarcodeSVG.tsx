import React, { useEffect, useState } from 'react';
import bwipjs from 'bwip-js';

interface BarcodeSVGProps {
  data: string;
}

const BarcodeSVG: React.FC<BarcodeSVGProps> = ({ data }) => {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    if (data) {
      try {
        const svgOutput = bwipjs.toSVG({
          bcid: 'pdf417',
          text: data,
          scale: 3,             // Fixed modwidth calibration
          height: 15,            // Row height >= 3X
          eclevel: 5,           // Standard 2020 Requirement
          paddingwidth: 4,      // Quiet Zone
          paddingheight: 4,
        });
        setSvg(svgOutput);
      } catch (e) {
        console.error('Barcode Generation Error:', e);
      }
    }
  }, [data]);

  return (
    <div className="flex justify-center p-8 bg-white rounded-[3rem] border-4 border-slate-100 shadow-inner group">
      {svg ? (
        <div 
          dangerouslySetInnerHTML={{ __html: svg }} 
          className="max-w-full h-auto drop-shadow-sm transition-transform duration-500 group-hover:scale-[1.02]"
          style={{ imageRendering: 'auto' }}
        />
      ) : (
        <div className="w-64 h-32 bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center text-slate-300 font-black uppercase text-xs tracking-widest">
          Generating Matrix...
        </div>
      )}
    </div>
  );
};

export default BarcodeSVG;