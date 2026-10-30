import React, { useEffect, useRef, useState } from 'react';
import { Detection } from '../../types';

interface DetectionOverlayProps {
  detections: Detection[];
  targetElement: HTMLElement | null;
  containerElement: HTMLDivElement | null;
}

const CLASS_COLORS: Record<string, string> = {
  person: '#3b82f6',
  Person: '#3b82f6',
  helmet: '#22c55e',
  Hardhat: '#22c55e',
  no_helmet: '#ef4444',
  'NO-Hardhat': '#ef4444',
  vest: '#22c55e',
  'Safety Vest': '#22c55e',
  no_vest: '#ef4444',
  'NO-Safety Vest': '#ef4444',
  mask: '#22c55e',
  Mask: '#22c55e',
  no_mask: '#ef4444',
  'NO-Mask': '#ef4444',
  gloves: '#10b981',
  no_gloves: '#ef4444',
  safety_cone: '#f59e0b',
  'Safety Cone': '#f59e0b',
  machinery: '#8b5cf6',
  vehicle: '#ec4899',
};

const getBadgeColor = (className: string): string => {
  if (CLASS_COLORS[className]) return CLASS_COLORS[className];
  const lower = className.toLowerCase();
  if (lower.includes('no') || lower.includes('violat') || lower.includes('miss')) return '#ef4444';
  if (lower.includes('safe') || lower.includes('helmet') || lower.includes('vest') || lower.includes('mask') || lower.includes('glove')) return '#22c55e';
  return '#3b82f6';
};

const DetectionOverlay: React.FC<DetectionOverlayProps> = ({ detections, targetElement, containerElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, top: 0, left: 0 });

  useEffect(() => {
    if (!targetElement || !containerElement) return;

    const updateDimensions = () => {
      const rect = targetElement.getBoundingClientRect();
      const containerRect = containerElement.getBoundingClientRect();
      
      setDimensions({
        width: rect.width,
        height: rect.height,
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(targetElement);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      observer.disconnect();
    };
  }, [targetElement, containerElement]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dimensions.width || !dimensions.height) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detections || detections.length === 0) return;

    const naturalWidth = (targetElement as any)?.naturalWidth || (targetElement as any)?.videoWidth || 640;
    const naturalHeight = (targetElement as any)?.naturalHeight || (targetElement as any)?.videoHeight || 480;

    detections.forEach(det => {
      if (!det.bbox || det.bbox.length < 4) return;
      const [rawXmin, rawYmin, rawXmax, rawYmax] = det.bbox;

      // Check whether coordinates are normalized [0.0 - 1.0] or absolute pixels
      const isNormalized = rawXmax <= 1.05 && rawYmax <= 1.05;

      const normXmin = isNormalized ? rawXmin : rawXmin / (naturalWidth || 640);
      const normYmin = isNormalized ? rawYmin : rawYmin / (naturalHeight || 480);
      const normXmax = isNormalized ? rawXmax : rawXmax / (naturalWidth || 640);
      const normYmax = isNormalized ? rawYmax : rawYmax / (naturalHeight || 480);

      const x = Math.max(0, normXmin * dimensions.width);
      const y = Math.max(0, normYmin * dimensions.height);
      const w = Math.min(dimensions.width - x, (normXmax - normXmin) * dimensions.width);
      const h = Math.min(dimensions.height - y, (normYmax - normYmin) * dimensions.height);

      if (w <= 2 || h <= 2) return;

      const color = getBadgeColor(det.class_name);

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, w, h);

      // Label text
      const cleanName = det.class_name.replace(/_/g, ' ');
      const confPercent = Math.round((det.confidence || 0.9) * 100);
      const label = det.track_id ? `#${det.track_id} ${cleanName} ${confPercent}%` : `${cleanName} ${confPercent}%`;

      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const textWidth = ctx.measureText(label).width;
      const tagHeight = 18;
      const tagY = y >= tagHeight ? y - tagHeight : y;

      // Label background
      ctx.fillStyle = color;
      ctx.fillRect(x, tagY, textWidth + 10, tagHeight);

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 5, tagY + 13);
    });
  }, [detections, dimensions, targetElement]);

  if (!dimensions.width || !dimensions.height) return null;

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      style={{
        position: 'absolute',
        top: `${dimensions.top}px`,
        left: `${dimensions.left}px`,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        pointerEvents: 'none',
        zIndex: 20
      }}
    />
  );
};

export default DetectionOverlay;
