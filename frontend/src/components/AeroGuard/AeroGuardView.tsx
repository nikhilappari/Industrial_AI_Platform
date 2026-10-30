import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Plane, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Filter, 
  Gauge, 
  BarChart3, 
  TrendingDown, 
  ShieldAlert,
  Sliders,
  Send
} from 'lucide-react';

interface EngineItem {
  engine_id: string;
  current_cycles: number;
  predicted_rul_cycles: number;
  risk_level: 'High' | 'Medium' | 'Low';
  health_status: string;
  urgency: string;
  exhaust_gas_temp: number;
  core_speed_rpm: number;
  hpc_outlet_temp: number;
  fan_speed_rpm: number;
  bypass_ratio: number;
}

interface AeroGuardFleetData {
  summary: {
    total_turbofans: number;
    critical_engines: number;
    warning_engines: number;
    healthy_engines: number;
    fleet_avg_rul_cycles: number;
    reliability_index_pct: number;
  };
  fleet: EngineItem[];
  metrics: {
    r2_score: number;
    mae: number;
    rmse: number;
    algorithm: string;
    training_cycles: number;
    training_engines: number;
  };
  dataset: string;
}

export const AeroGuardView: React.FC = () => {
  const [data, setData] = useState<AeroGuardFleetData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterRisk, setFilterRisk] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom Simulator state
  const [testCycle, setTestCycle] = useState<number>(95);
  const [testEgt, setTestEgt] = useState<number>(648.5);
  const [testCoreSpeed, setTestCoreSpeed] = useState<number>(1592.0);
  const [testFanSpeed, setTestFanSpeed] = useState<number>(2388.5);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);

  const getApiUrl = (endpoint: string) => {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return endpoint;
    }
    return `http://localhost:8000${endpoint}`;
  };

  const fetchFleet = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await axios.get<AeroGuardFleetData>(getApiUrl('/api/aeroguard/fleet'));
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to fetch AeroGuard fleet data', err);
      setErrorMsg(err?.message || 'Failed to connect to AeroGuard turbofan telemetry endpoint');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    try {
      setSimulating(true);
      const payload = {
        cycle: testCycle,
        setting_1: 0.002,
        setting_2: 0.0002,
        setting_3: 100.0,
        sensor_2: testEgt,
        sensor_3: testCoreSpeed,
        sensor_4: 1410.0,
        sensor_7: 552.0,
        sensor_8: testFanSpeed,
        sensor_11: 47.6,
        sensor_12: 520.8,
        sensor_15: 8.44,
        sensor_20: 38.6,
        sensor_21: 23.2
      };
      const res = await axios.post(getApiUrl('/api/aeroguard/predict'), payload);
      setSimResult(res.data);
    } catch (err: any) {
      console.error('Simulation error', err);
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  const fleet = data?.fleet || [];

  const filteredFleet = fleet.filter((e) => {
    const matchesFilter = filterRisk === 'ALL' || e.risk_level.toUpperCase() === filterRisk;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      e.engine_id.toLowerCase().includes(term) ||
      e.health_status.toLowerCase().includes(term) ||
      e.urgency.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
              Module 6 · Aerospace & Aviation Diagnostics
            </span>
            <span className="text-xs text-gray-400 font-mono">
              NASA C-MAPSS Trajectories · DHEEMANTH241106
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1 flex items-center gap-2">
            <Plane className="w-7 h-7 text-sky-600" />
            AeroGuard AI · Turbofan Remaining Useful Life (RUL) Prediction
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Real-time degradation telemetry, flight cycle wear modeling, and predictive RUL estimation for commercial aircraft turbofan engines.
          </p>
        </div>

        <button
          onClick={fetchFleet}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer shadow-sm transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Fleet Telemetry
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button 
            onClick={fetchFleet}
            className="px-3 py-1 bg-rose-600 text-white rounded text-xs font-semibold hover:bg-rose-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-600 mb-3" />
          <p className="text-gray-600 font-medium text-sm">Evaluating NASA C-MAPSS Turbofan Sensor Streams...</p>
        </div>
      ) : data ? (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center text-gray-500 text-xs font-semibold uppercase">
                <span>Active Turbofans Monitored</span>
                <Gauge className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {data.summary.total_turbofans} Engines
              </p>
              <p className="text-xs text-gray-400 mt-1">Operational Fleet In-Service</p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center text-rose-600 text-xs font-semibold uppercase">
                <span>Critical (RUL &lt; 20 Cycles)</span>
                <ShieldAlert className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-2xl font-bold text-rose-600 mt-2">
                {data.summary.critical_engines} Units
              </p>
              <p className="text-xs text-rose-400 mt-1">Grounding recommended for overhaul</p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center text-amber-600 text-xs font-semibold uppercase">
                <span>Scheduled Maintenance</span>
                <TrendingDown className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-600 mt-2">
                {data.summary.warning_engines} Units
              </p>
              <p className="text-xs text-amber-400 mt-1">Approaching wear threshold</p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center text-emerald-600 text-xs font-semibold uppercase">
                <span>Fleet Mean RUL</span>
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                {data.summary.fleet_avg_rul_cycles} Cycles
              </p>
              <p className="text-xs text-emerald-600 font-medium mt-1">
                {data.summary.reliability_index_pct}% Nominal Operating Fleet
              </p>
            </div>
          </div>

          {/* Machine Learning Model Performance Card */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Trained Turbofan RUL Estimator</p>
                <p className="text-xs text-slate-400">{data.metrics.algorithm} · {data.dataset}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-xs">
              <div>
                <span className="text-slate-400">Model R² Score:</span>{' '}
                <span className="font-mono font-bold text-emerald-400">
                  {data.metrics.r2_score.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Mean Abs Error:</span>{' '}
                <span className="font-mono font-bold text-sky-400">
                  ±{data.metrics.mae.toFixed(1)} Cycles
                </span>
              </div>
              <div>
                <span className="text-slate-400">RMSE:</span>{' '}
                <span className="font-mono font-bold text-white">
                  {data.metrics.rmse.toFixed(1)} Cycles
                </span>
              </div>
            </div>
          </div>

          {/* Interactive RUL What-If Simulator Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-600" />
                <h3 className="font-bold text-gray-800 text-sm">Interactive Turbofan Diagnostic Simulator</h3>
              </div>
              <span className="text-[11px] text-gray-400">Live In-Flight Sensor What-If Testing</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-gray-500 font-medium block mb-1">Current Operating Cycles</label>
                <input
                  type="number"
                  value={testCycle}
                  onChange={(e) => setTestCycle(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="text-gray-500 font-medium block mb-1">Exhaust Gas Temp T24 (°R)</label>
                <input
                  type="number"
                  step="0.5"
                  value={testEgt}
                  onChange={(e) => setTestEgt(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="text-gray-500 font-medium block mb-1">Core Speed Nc (rpm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={testCoreSpeed}
                  onChange={(e) => setTestCoreSpeed(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="text-gray-500 font-medium block mb-1">Fan Speed Nf (rpm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={testFanSpeed}
                  onChange={(e) => setTestFanSpeed(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                onClick={handleSimulate}
                disabled={simulating}
                className="btn-primary flex items-center gap-2 text-xs py-2 px-4 cursor-pointer"
              >
                {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Evaluate Remaining Life
              </button>

              {simResult && (
                <div className="flex items-center gap-4 bg-sky-50 border border-sky-200 px-4 py-2 rounded-lg text-xs">
                  <div>
                    <span className="text-gray-500">Predicted RUL:</span>{' '}
                    <strong className="text-sky-900 font-mono text-sm font-bold">
                      {simResult.predicted_rul_cycles} flight cycles
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>{' '}
                    <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      simResult.risk_level === 'High' ? 'bg-rose-100 text-rose-700' :
                      simResult.risk_level === 'Medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {simResult.status}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Operational Fleet Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <div className="flex gap-1.5">
                  {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setFilterRisk(r)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                        filterRisk === r
                          ? 'bg-sky-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                placeholder="Search engine ID, status, or urgency..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 w-full sm:w-64"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Turbofan ID</th>
                    <th className="py-3 px-4">Completed Cycles</th>
                    <th className="py-3 px-4">Predicted RUL</th>
                    <th className="py-3 px-4">Risk Severity</th>
                    <th className="py-3 px-4">EGT (°R)</th>
                    <th className="py-3 px-4">Core Speed</th>
                    <th className="py-3 px-4">Prescribed Maintenance Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredFleet.map((e) => (
                    <tr key={e.engine_id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        {e.engine_id}
                      </td>
                      <td className="py-3 px-4 font-mono">{e.current_cycles} cycles</td>
                      <td className="py-3 px-4 font-mono">
                        <span className={`font-bold ${
                          e.predicted_rul_cycles < 20 ? 'text-rose-600 text-sm' :
                          e.predicted_rul_cycles < 45 ? 'text-amber-600 font-semibold' :
                          'text-emerald-700'
                        }`}>
                          {e.predicted_rul_cycles} cycles
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            e.risk_level === 'High'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : e.risk_level === 'Medium'
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {e.risk_level} Risk
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{e.exhaust_gas_temp} °R</td>
                      <td className="py-3 px-4 font-mono">{e.core_speed_rpm} rpm</td>
                      <td className="py-3 px-4 font-medium text-gray-700">
                        {e.urgency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-center text-xs text-gray-500">
              Showing {filteredFleet.length} operational turbofan engines
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AeroGuardView;
