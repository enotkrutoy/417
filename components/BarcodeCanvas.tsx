import React, { useEffect, useRef } from 'react';
import bwipjs from 'bwip-js';

interface BarcodeCanvasProps {
  data: string;
}

const BarcodeCanvas: React.FC<BarcodeCanvasProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && data) {
      try {
        bwipjs.toCanvas(canvasRef.current, {
          bcid: 'pdf417',
          text: data,
          scale: 3,             // 3 pixels per module for 300 DPI clarity
          height: 15,            // Row height >= 3X compliance
          eclevel: 5,           // Standard 2020 Recommendation
          columns: 0,           // Optimal layout
          includetext: false,
          paddingwidth: 4,      // Quiet Zone compliance
          paddingheight: 4,
        });
      } catch (e) {
        console.error('Bwipjs Error:', e);
      }
    }
  }, [data]);

  return (
    <div className="flex justify-center p-6 bg-white rounded-3xl border-4 border-slate-100 shadow-inner overflow-hidden">
      <canvas 
        ref={canvasRef} 
        style={{ imageRendering: 'pixelated' }}
        className="max-w-full h-auto" 
      />
    </div>
  );
};

export default BarcodeCanvas;