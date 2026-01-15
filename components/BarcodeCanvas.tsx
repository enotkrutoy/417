
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
          scale: 2,             // Оптимальный X-dimension для стандартных ID
          height: 12,            // Row height >= 3X
          eclevel: 5,           // Повышенный уровень коррекции для надежности (AAMVA 2020)
          columns: 0,           // Авто-расчет колонок
          rows: 0,
          includetext: false,
          padding: 2,           // Свободная зона (Quiet Zone)
        });
      } catch (e) {
        console.error('Barcode generation error:', e);
      }
    }
  }, [data]);

  return (
    <div className="flex justify-center p-6 bg-white border border-slate-100 rounded-[2rem] shadow-inner">
      <canvas id="generated-pdf417" ref={canvasRef} className="max-w-full h-auto" />
    </div>
  );
};

export default BarcodeCanvas;
