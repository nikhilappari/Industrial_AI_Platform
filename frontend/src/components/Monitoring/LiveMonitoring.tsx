import React, { useState, useEffect, useRef } from 'react';
import { Camera, Play, Square, Laptop, Video } from 'lucide-react';
import VideoFeed from './VideoFeed';
import DetectionOverlay from './DetectionOverlay';
import { camerasApi, sessionsApi, modelsApi, videosApi } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Camera as CameraType, Detection, SessionMetrics } from '../../types';

export const LiveMonitoring = () => {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [mode, setMode] = useState<'server' | 'browser'>('server');

  // Browser client-side webcam state
  const [browserStreamActive, setBrowserStreamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Client-side detection results & telemetry
  const [browserDetections, setBrowserDetections] = useState<Detection[]>([]);
  const [browserMetrics, setBrowserMetrics] = useState<SessionMetrics>({
    fps: 0,
    latency_ms: 0,
    frames_processed: 0,
    detections_count: 0
  });

  const { isConnected, detections: serverDetections, metrics: serverMetrics, frameData } = useWebSocket(sessionId);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    camerasApi.list().then(res => {
      setCameras(res.data);
      if (res.data && res.data.length > 0 && !selectedCamera) {
        setSelectedCamera(String(res.data[0].id));
      }
    }).catch(console.error);

    modelsApi.getStatus().then(res => setModelReady(res.data.is_ready)).catch(console.error);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleStartServer = async () => {
    if (!selectedCamera) {
      setErrorMsg("Please select a camera first.");
      return;
    }
    setErrorMsg(null);
    try {
      const res = await sessionsApi.create({ camera_id: parseInt(selectedCamera) });
      setSessionId(res.data.id);
    } catch (err: any) {
      console.error("Failed to start session", err);
      const detail = err?.response?.data?.detail || err?.message || "Failed to start monitoring session";
      setErrorMsg(detail);
    }
  };

  const handleStopServer = async () => {
    if (!sessionId) return;
    try {
      await sessionsApi.stop(sessionId);
      setSessionId(null);
    } catch (err) {
      console.error("Failed to stop session", err);
    }
  };

  const handleStartBrowserWebcam = async () => {
    setErrorMsg(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setBrowserStreamActive(true);
      } else {
        setErrorMsg("Your browser does not support local camera access.");
      }
    } catch (err: any) {
      console.error("Browser camera access error:", err);
      setErrorMsg("Unable to access PC webcam. Please grant camera permission in your browser.");
    }
  };

  const handleStopBrowserWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setBrowserStreamActive(false);
    setBrowserDetections([]);
    setBrowserMetrics({
      fps: 0,
      latency_ms: 0,
      frames_processed: 0,
      detections_count: 0
    });
  };

  // Live inference loop for Browser PC Webcam mode
  useEffect(() => {
    if (!browserStreamActive || mode !== 'browser') return;

    let isCancelled = false;
    let isProcessing = false;

    if (!hiddenCanvasRef.current) {
      hiddenCanvasRef.current = document.createElement('canvas');
      hiddenCanvasRef.current.width = 640;
      hiddenCanvasRef.current.height = 480;
    }

    const intervalId = setInterval(async () => {
      if (isCancelled || isProcessing) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const canvas = hiddenCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      isProcessing = true;
      try {
        ctx.drawImage(video, 0, 0, 640, 480);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);

        const res = await videosApi.detectFrame({
          frame_base64: dataUrl,
          required_ppe: ['helmet', 'vest']
        });

        if (!isCancelled && res.data) {
          setBrowserDetections(res.data.detections || []);
          if (res.data.metrics) {
            setBrowserMetrics(prev => ({
              fps: res.data.metrics.fps || 15.0,
              latency_ms: res.data.metrics.latency_ms || 45.0,
              frames_processed: prev.frames_processed + 1,
              detections_count: res.data.metrics.detections_count || 0
            }));
          }
        }
      } catch (err) {
        console.debug("Frame inference check:", err);
      } finally {
        isProcessing = false;
      }
    }, 280);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [browserStreamActive, mode]);

  const activeCam = cameras.find(c => String(c.id) === selectedCamera);
  const activeDetections = mode === 'browser' ? browserDetections : serverDetections;
  const activeMetrics = mode === 'browser' ? browserMetrics : serverMetrics;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] gap-6">
      <div className="flex-1 flex flex-col gap-4">
        {/* Controls Card */}
        <div className="card p-4 flex justify-between items-center flex-wrap gap-4">
          <div className="flex gap-3 items-center flex-wrap">
            {/* Source Mode Selector */}
            <div className="flex rounded-lg border border-gray-300 p-0.5 bg-gray-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  if (browserStreamActive) handleStopBrowserWebcam();
                  setMode('server');
                }}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'server' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-cyan-600" />
                Server / Factory Feed
              </button>
              <button
                type="button"
                onClick={() => {
                  if (sessionId) handleStopServer();
                  setMode('browser');
                }}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'browser' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Laptop className="w-3.5 h-3.5 text-indigo-600" />
                Browser PC Webcam
              </button>
            </div>

            {mode === 'server' ? (
              <>
                <select 
                  className="border border-gray-300 rounded-lg p-2 text-sm min-w-[200px]"
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  disabled={!!sessionId}
                >
                  <option value="">Select Camera...</option>
                  {cameras.map((cam: any) => (
                    <option key={cam.id} value={cam.id}>{cam.name}</option>
                  ))}
                </select>

                {!sessionId ? (
                  <button 
                    onClick={handleStartServer} 
                    disabled={!selectedCamera || !modelReady}
                    className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="w-4 h-4" /> Start Monitoring
                  </button>
                ) : (
                  <button 
                    onClick={handleStopServer}
                    className="btn-danger flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Square className="w-4 h-4" /> Stop Monitoring
                  </button>
                )}
              </>
            ) : (
              <>
                {!browserStreamActive ? (
                  <button
                    onClick={handleStartBrowserWebcam}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <Play className="w-4 h-4" /> Start Local PC Camera
                  </button>
                ) : (
                  <button
                    onClick={handleStopBrowserWebcam}
                    className="btn-danger flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Square className="w-4 h-4" /> Stop PC Camera
                  </button>
                )}
              </>
            )}

            {/* Enforced PPE Badge */}
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="font-semibold text-slate-700">Enforced PPE:</span>
              <div className="flex gap-1.5">
                <span className="bg-white border border-slate-300 font-medium text-slate-800 px-2 py-0.5 rounded shadow-2xs">
                  ⛑️ Hardhat Helmet
                </span>
                <span className="bg-white border border-slate-300 font-medium text-slate-800 px-2 py-0.5 rounded shadow-2xs">
                  🦺 Safety Vest
                </span>
              </div>
            </div>

            {errorMsg && (
              <span className="text-xs text-rose-600 font-semibold bg-rose-50 px-2.5 py-1 rounded border border-rose-200">
                {errorMsg}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected || browserStreamActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-gray-600">
                {mode === 'browser' ? (browserStreamActive ? 'Local Camera Active' : 'Offline') : (isConnected ? 'WS Stream Live' : 'WS Idle')}
              </span>
            </div>
          </div>
        </div>

        {/* Video Canvas / Display Area */}
        <div 
          ref={containerRef}
          className="flex-1 bg-gray-950 rounded-xl overflow-hidden relative border border-gray-800 flex items-center justify-center min-h-[400px]"
        >
          {mode === 'browser' ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`max-w-full max-h-full object-contain ${browserStreamActive ? 'block' : 'hidden'}`}
              />
              {browserStreamActive && (
                <DetectionOverlay 
                  detections={browserDetections}
                  targetElement={videoRef.current}
                  containerElement={containerRef.current}
                />
              )}
              {!browserStreamActive && (
                <div className="text-gray-400 flex flex-col items-center p-6 text-center">
                  <Laptop className="w-16 h-16 mb-3 text-gray-600" />
                  <p className="font-semibold text-sm">Direct Browser Webcam Mode</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Click "Start Local PC Camera" to access your laptop or desktop webcam directly with real-time AI PPE detection.
                  </p>
                </div>
              )}
            </div>
          ) : sessionId ? (
            <VideoFeed frameData={frameData} detections={serverDetections} />
          ) : (
            <div className="text-gray-400 flex flex-col items-center p-6 text-center">
              <Camera className="w-16 h-16 mb-3 text-gray-600" />
              <p className="font-semibold text-sm">No Live Stream Running</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Select a registered camera and click "Start Monitoring", or toggle "Browser PC Webcam" to use your computer's built-in camera.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Sidebar */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        <div className="card p-5">
          <h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2 text-sm flex items-center justify-between">
            <span>Real-Time Telemetry</span>
            <span className="text-[10px] font-mono bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded">
              {mode === 'browser' ? 'CLIENT STREAM' : 'AI INFERENCE'}
            </span>
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-gray-500">Processing Speed (FPS):</span>
              <p className="text-xl font-bold text-gray-900 font-mono mt-0.5">
                {activeMetrics?.fps ? `${activeMetrics.fps.toFixed(1)} FPS` : '0.0 FPS'}
              </p>
            </div>

            <div>
              <span className="text-gray-500">Inference Latency:</span>
              <p className="text-xl font-bold text-gray-900 font-mono mt-0.5">
                {activeMetrics?.latency_ms ? `${activeMetrics.latency_ms.toFixed(1)} ms` : '0.0 ms'}
              </p>
            </div>

            <div>
              <span className="text-gray-500">Active Detected Objects:</span>
              <p className="text-xl font-bold text-gray-900 font-mono mt-0.5">
                {activeDetections?.length || 0}
              </p>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <span className="text-gray-500">Active Camera Source:</span>
              <p className="font-semibold text-gray-800 mt-0.5 truncate">
                {mode === 'browser' ? 'Direct Browser WebRTC' : (activeCam?.name || 'None Selected')}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {mode === 'browser' ? 'Local Hardware Capture' : (activeCam?.location || 'Automatic Fallback Enabled')}
              </p>
            </div>
          </div>
        </div>

        {/* Live Detection Badges Card */}
        <div className="card p-5 flex-1 overflow-y-auto">
          <h3 className="font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2 text-sm">
            Active Object Tracking
          </h3>

          {activeDetections && activeDetections.length > 0 ? (
            <div className="space-y-2">
              {activeDetections.map((d: any, idx: number) => (
                <div key={idx} className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      d.class_name.toLowerCase().includes('no') ? 'bg-rose-500' : 'bg-emerald-500'
                    }`} />
                    <span className="font-semibold text-gray-800">{d.class_name.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="font-mono text-gray-500">
                    {Math.round((d.confidence || 0.9) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-6">
              {sessionId || browserStreamActive ? 'Scanning video frames for safety compliance...' : 'Start camera to begin detection'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveMonitoring;
