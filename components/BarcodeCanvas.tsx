
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
          scale: 3,             // Scale 3 provides excellent resolution for high-DPI prints
          height: 12,            // Row height >= 3X (X=1)
          eclevel: 5,           // Standard 2020 recommends level 5 for mission critical ID
          columns: 0,           // Optimal columns calculated automatically
          rows: 0,
          includetext: false,
          padding: 2,           // Standard A.7.3 compliance
        });
      } catch (e) {
        console.error('Barcode generation error:', e);
      }
    }
  }, [data]);

  return (
    <div className="flex justify-center p-8 bg-white rounded-[3rem] shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-slate-100">
      <canvas id="generated-pdf417" ref={canvasRef} className="max-w-full h-auto drop-shadow-sm" />
    </div>
  );
};

export default BarcodeCanvas;
