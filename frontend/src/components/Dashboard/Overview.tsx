import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  AlertOctagon, 
  Video, 
  CheckCircle2, 
  Scan, 
  Car, 
  Zap, 
  Wrench, 
  Plane,
  ArrowRight, 
  ShieldCheck,
  Cpu
} from 'lucide-react';
import StatsCard from './StatsCard';
import IncidentTrendChart from './IncidentTrendChart';
import { analyticsApi, modelsApi } from '../../services/api';
import { AnalyticsSummary, ModelStatus } from '../../types';

const Overview = () => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, modRes] = await Promise.all([
          analyticsApi.getSummary(),
          modelsApi.getStatus()
        ]);
        setSummary(sumRes.data);
        setModelStatus(modRes.data);
      } catch (err) {
        console.error("Failed to fetch overview data", err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const modules = [
    {
      title: "Workplace PPE & Zone Safety",
      description: "Live camera stream, helmet/vest detection, restricted zones, and risk scoring.",
      route: "/monitoring",
      icon: Video,
      color: "bg-cyan-50 text-cyan-600 border-cyan-200",
      tag: "Vision Safety"
    },
    {
      title: "Steel Defect Vision",
      description: "YOLOv8 surface inspection across 6 manufacturing defect classes.",
      route: "/defect-vision",
      icon: Scan,
      color: "bg-emerald-50 text-emerald-600 border-emerald-200",
      tag: "Quality Control"
    },
    {
      title: "Vehicle & Fleet Faults",
      description: "OBD-II vehicle telemetry diagnosis, calibrated confidence & SHAP explanations.",
      route: "/car-fault",
      icon: Car,
      color: "bg-indigo-50 text-indigo-600 border-indigo-200",
      tag: "Fleet Telemetry"
    },
    {
      title: "Semiconductor Burn-In",
      description: "Early-burn-in degradation screening and anomaly scores for silicon ICs.",
      route: "/aegis-burn",
      icon: Zap,
      color: "bg-amber-50 text-amber-600 border-amber-200",
      tag: "Silicon QA"
    },
    {
      title: "Turbofan RUL (AeroGuard)",
      description: "NASA C-MAPSS aircraft engine degradation & Remaining Useful Life prediction.",
      route: "/aeroguard",
      icon: Plane,
      color: "bg-sky-50 text-sky-600 border-sky-200",
      tag: "Aviation AI"
    },
    {
      title: "Predictive Maintenance",
      description: "Machine failure risk, AI4I root-cause diagnostics, and prescriptive actions.",
      route: "/predictive-maintenance",
      icon: Wrench,
      color: "bg-blue-50 text-blue-600 border-blue-200",
      tag: "Machinery Fleet"
    }
  ];

  if (!summary) return <div className="p-8 text-gray-500 font-medium">Loading platform dashboard...</div>;

  return (
    <div className="space-y-8">
      {/* Platform Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 rounded-2xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Unified Platform
            </span>
            <span className="text-xs text-slate-400">Version 2.0</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Industrial AI & Operations Suite
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
            Single-pane operations intelligence across computer vision PPE safety, steel defect inspection, vehicle OBD-II telemetry, semiconductor screening, turbofan RUL forecasting, and machinery predictive maintenance.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-center">
            <span className="text-xs text-slate-400 block font-medium">AI Engines</span>
            <span className="text-xl font-bold text-cyan-400 font-mono">6 Online</span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-center">
            <span className="text-xs text-slate-400 block font-medium">Platform Status</span>
            <span className="text-xl font-bold text-emerald-400 flex items-center justify-center gap-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Nominal
            </span>
          </div>
        </div>
      </div>

      {/* Integrated Modules Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-800 uppercase tracking-wider text-xs">
              Integrated Industrial AI Modules
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Select a module to launch its dedicated operational view</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <div
              key={m.route}
              onClick={() => navigate(m.route)}
              className="card p-5 hover:border-cyan-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-lg border ${m.color}`}>
                    <m.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-mono">
                    {m.tag}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 group-hover:text-cyan-600 transition-colors text-base">
                  {m.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {m.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-cyan-600 group-hover:text-cyan-700">
                <span>Launch</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety & Camera Live Telemetry */}
      <div>
        <h2 className="text-base font-bold text-gray-800 uppercase tracking-wider text-xs mb-3">
          Safety & Camera Live Monitoring Telemetry
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard 
            title="Active Cameras" 
            value={summary.total_cameras} 
            icon={Video} 
          />
          <StatsCard 
            title="Open Incidents" 
            value={summary.open_incidents} 
            icon={Activity} 
          />
          <StatsCard 
            title="High Risk Incidents" 
            value={summary.high_risk_incidents} 
            icon={AlertOctagon} 
            color="red" 
          />
          <StatsCard 
            title="Vision Model Status" 
            value={modelStatus?.is_ready ? "Operational" : "Offline"} 
            icon={CheckCircle2} 
            color={modelStatus?.is_ready ? "green" : "red"} 
          />
        </div>
      </div>

      {/* Incident Analytics Chart */}
      <div className="grid grid-cols-1 gap-6">
        <IncidentTrendChart />
      </div>
    </div>
  );
};

export default Overview;
