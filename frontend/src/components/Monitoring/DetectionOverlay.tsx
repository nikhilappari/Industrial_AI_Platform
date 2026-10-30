import React, { useEffect, useRef, useState } from 'react';
import { Detection } from '../../types';

interface DetectionOverlayProps {
  detections: Detection[];
  targetElement: HTMLElement | null;
  containerElement: HTMLDivElement | null;
}

/**
 * Color Scheme:
 * Compliant Safety Gear (Mask, Vest, Helmet, Gloves) -> Vibrant Emerald Green (#10b981)
 * Missing PPE / Violations (NO-Mask, NO-Hardhat, NO-Vest, etc.) -> High-Visibility Red (#ef4444)
 * Detected Personnel / Workers -> High-Visibility Sky Blue (#0ea5e9)
 * Machinery / Equipment -> Purple (#a855f7)
 */
export const getDetectionColor = (className: string): { border: string; bg: string; text: string } => {
  const name = className.toLowerCase().trim();

  // 1. Missing PPE / Safety Violations -> RED
  if (
    name.startsWith('no-') ||
    name.startsWith('no_') ||
    name.includes('missing') ||
    name.includes('violation')
  ) {
    return {
      border: '#ef4444', // Red-500
      bg: '#dc2626',
      text: '#ffffff'
    };
  }

  // 2. Verified Compliant Safety Gear (Mask, Vest, Helmet, Hardhat, Gloves) -> GREEN
  if (
    name.includes('mask') ||
    name.includes('vest') ||
    name.includes('helmet') ||
    name.includes('hardhat') ||
    name.includes('glove') ||
    name.includes('safe')
  ) {
    return {
      border: '#10b981', // Emerald-500 (Clean Bright Green)
      bg: '#059669',     // Emerald-600
      text: '#ffffff'
    };
  }

  // 3. Person / Worker -> SKY BLUE
  if (name.includes('person') || name.includes('worker') || name.includes('operator')) {
    return {
      border: '#0ea5e9', // Sky-500
      bg: '#0284c7',
      text: '#ffffff'
    };
  }

  // 4. Default / Hazard Cones / Vehicles
  if (name.includes('cone')) {
    return { border: '#f59e0b', bg: '#d97706', text: '#ffffff' };
  }
  return { border: '#8b5cf6', bg: '#7c3aed', text: '#ffffff' };
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

      // Coordinate normalization check
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

      const colorScheme = getDetectionColor(det.class_name);

      // 1. Draw outer glowing boundary for high visibility
      ctx.strokeStyle = colorScheme.border;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, w, h);

      // Subtle filled highlight for PPE items
      const isPpe = !det.class_name.toLowerCase().includes('person');
      if (isPpe) {
        ctx.fillStyle = colorScheme.border + '22'; // 15% opacity fill
        ctx.fillRect(x, y, w, h);
      }

      // 2. Format human-friendly label
      let cleanName = det.class_name.replace(/_/g, ' ');
      if (cleanName.toLowerCase() === 'hardhat' || cleanName.toLowerCase() === 'helmet') {
        cleanName = 'Hardhat Helmet';
      } else if (cleanName.toLowerCase() === 'mask') {
        cleanName = 'Face Mask';
      } else if (cleanName.toLowerCase() === 'vest' || cleanName.toLowerCase() === 'safety vest') {
        cleanName = 'Safety Vest';
      } else if (cleanName.toLowerCase() === 'no-hardhat' || cleanName.toLowerCase() === 'no-helmet' || cleanName.toLowerCase() === 'no_helmet') {
        cleanName = 'NO Hardhat';
      } else if (cleanName.toLowerCase() === 'no-mask' || cleanName.toLowerCase() === 'no_mask') {
        cleanName = 'NO Face Mask';
      } else if (cleanName.toLowerCase() === 'no-safety vest' || cleanName.toLowerCase() === 'no_vest') {
        cleanName = 'NO Safety Vest';
      }

      const confPercent = Math.round((det.confidence || 0.9) * 100);
      const label = det.track_id ? `#${det.track_id} ${cleanName} (${confPercent}%)` : `${cleanName} (${confPercent}%)`;

      ctx.font = 'bold 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const textWidth = ctx.measureText(label).width;
      const tagHeight = 18;
      const tagY = y >= tagHeight ? y - tagHeight : y;

      // Label background pill
      ctx.fillStyle = colorScheme.bg;
      ctx.fillRect(x, tagY, textWidth + 10, tagHeight);

      // Label text
      ctx.fillStyle = colorScheme.text;
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
