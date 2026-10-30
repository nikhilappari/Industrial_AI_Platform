import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  User as UserIcon, 
  LogIn, 
  LogOut, 
  ChevronDown, 
  Settings
} from 'lucide-react';
import { modelsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const Header = () => {
  const { user, logout } = useAuth();
  const [modelReady, setModelReady] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    modelsApi
      .getStatus()
      .then((res) => setModelReady(res.data.is_ready))
      .catch(() => setModelReady(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setShowUserDropdown(false);
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-slate-900 text-white h-16 flex items-center justify-between px-6 shadow-md z-20 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <Shield className="text-cyan-400 w-8 h-8" />
        <div>
          <h1 className="text-lg font-bold tracking-wide flex items-center gap-2">
            Industrial AI & Operations Platform
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-cyan-800">
              Unified Multi-Module Suite
            </span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Model Status indicator */}
        <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/60">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              modelReady ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-xs text-slate-300 font-medium">
            {modelReady ? 'YOLOv8 AI Ready' : 'Model Offline'}
          </span>
        </div>

        {/* User profile & Auth Controls */}
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2.5 border-l border-slate-700 pl-4 py-1 hover:opacity-90 transition-opacity cursor-pointer focus:outline-none"
            >
              <div className="bg-slate-800 p-2 rounded-full border border-slate-700 text-cyan-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="text-xs font-medium block text-slate-200">
                  {user.username}
                </span>
                <span className="text-[10px] text-slate-400 capitalize block">
                  {user.role?.replace('_', ' ') || 'admin'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-sm">
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="text-xs text-slate-400">Signed in as</p>
                  <p className="text-sm font-semibold text-white truncate">{user.username}</p>
                  <p className="text-[11px] text-cyan-400 font-medium capitalize mt-0.5">
                    {user.role?.replace('_', ' ') || 'admin'}
                  </p>
                </div>

                <div className="py-1">
                  {user.role === 'admin' && (
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        navigate('/admin');
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>Administration</span>
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border-l border-slate-700 pl-4">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-sm shadow-cyan-900/50"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
