
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
          scale: 2,             // Оптимальный масштаб для печати 600dpi
          height: 12,            // Высота баров согласно D.5.4.2
          eclevel: 3,           // Обязательный уровень коррекции ошибок AAMVA
          columns: 0,           // Автоматический расчет колонок для компактности
          rows: 0,
          includetext: false,
        });
      } catch (e) {
        console.error('Barcode generation error:', e);
      }
    }
  }, [data]);

  return (
    <div className="flex justify-center p-6 bg-white border border-slate-200 rounded-2xl shadow-inner">
      <canvas id="generated-pdf417" ref={canvasRef} className="max-w-full h-auto" />
    </div>
  );
};

export default BarcodeCanvas;
