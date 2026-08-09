import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  onSignatureChange: (signatureDataUrl: string | null) => void;
  className?: string;
}

const SignaturePad = React.forwardRef<HTMLDivElement, SignaturePadProps>(
  ({ onSignatureChange, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);
    const isDrawingRef = useRef(false);

    const setupCanvas = useCallback((preserveContent = false) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      let savedImage: string | null = null;
      if (preserveContent && !isEmpty) {
        savedImage = canvas.toDataURL('image/png');
      }

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);

      if (savedImage && !isEmpty) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = savedImage;
      }
    }, [isEmpty]);

    useEffect(() => {
      setupCanvas(false);
      
      const handleResize = () => {
        if (!isDrawingRef.current) {
          setupCanvas(true);
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [setupCanvas]);

    const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.setPointerCapture(e.pointerId);
      
      const coords = getCoordinates(e);
      if (!coords) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      setIsDrawing(true);
      isDrawingRef.current = true;
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDrawingRef.current) return;

      const coords = getCoordinates(e);
      if (!coords) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      setIsEmpty(false);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDrawingRef.current) return;
      
      setIsDrawing(false);
      isDrawingRef.current = false;
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.releasePointerCapture(e.pointerId);
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.closePath();
        const dataUrl = canvas.toDataURL('image/png');
        onSignatureChange(dataUrl);
      }
    };

    const clearSignature = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = container.getBoundingClientRect();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
        setIsEmpty(true);
        isDrawingRef.current = false;
        setIsDrawing(false);
        onSignatureChange(null);
      }
    };

    return (
      <div ref={ref} className={cn('w-full', className)}>
        <div
          ref={containerRef}
          className="relative bg-white dark:bg-white border-2 border-gray-300 dark:border-gray-300 rounded-lg overflow-hidden"
          style={{ height: '200px', minHeight: '150px', touchAction: 'none' }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full h-full cursor-crosshair block"
            style={{ display: 'block', touchAction: 'none' }}
          />
          
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-400 text-base font-medium">Sign here</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearSignature}
            disabled={isEmpty}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';

interface SignatureDisplayProps {
  signatureDataUrl?: string;
  signatureData?: string;
  className?: string;
  label?: string;
}

function SignatureDisplay({ signatureDataUrl, signatureData, className, label }: SignatureDisplayProps) {
  const src = signatureDataUrl || signatureData;
  if (!src) return null;
  
  return (
    <div className={cn('w-full', className)}>
      {label && <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-2">
        <img 
          src={src} 
          alt="Signature" 
          className="max-w-full h-auto max-h-24 mx-auto"
        />
      </div>
    </div>
  );
}

export { SignaturePad, SignatureDisplay };
