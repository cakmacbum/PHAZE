import React from 'react';
import { DebugState } from '../hooks/useAdminMode';
import { PatternCategory } from '../game/patternSystem';

interface AdminPanelProps {
  debugState: DebugState;
  onUpdate: (updates: Partial<DebugState>) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ debugState, onUpdate }) => {
  if (!debugState.enabled) return null;

  return (
    <div 
        className="fixed top-4 right-4 z-50 bg-black/80 backdrop-blur border border-red-500/50 p-4 rounded text-white font-mono text-xs w-72 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()} // Prevent touches from bleeding into game
    >
      <div className="flex items-center justify-between mb-4 border-b border-red-500/30 pb-2">
        <h2 className="text-red-400 font-bold tracking-widest uppercase">Admin Mode</h2>
        <button onClick={() => onUpdate({ enabled: false })} className="text-gray-400 hover:text-white">✕</button>
      </div>

      <div className="space-y-4">
        {/* Aura Level */}
        <div>
          <label className="block text-gray-400 mb-1">Aura Level Override</label>
          <select 
            className="w-full bg-black border border-gray-700 rounded p-1"
            value={debugState.auraLevel || ''}
            onChange={(e) => onUpdate({ auraLevel: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Default (Calculated)</option>
            <option value="1">Level 1-5</option>
            <option value="6">Level 6-12</option>
            <option value="13">Level 13-25</option>
            <option value="26">Level 26-50</option>
            <option value="51">Level 51+</option>
          </select>
        </div>

        {/* Theme */}
        <div>
          <label className="block text-gray-400 mb-1">Theme Selection</label>
          <select 
            className="w-full bg-black border border-gray-700 rounded p-1"
            value={debugState.selectedTheme || ''}
            onChange={(e) => onUpdate({ selectedTheme: e.target.value || null })}
          >
            <option value="">Default (By Level)</option>
            <option value="Dark Phase">Dark Phase</option>
            <option value="Soft Neon">Soft Neon</option>
            <option value="Deep Void">Deep Void</option>
            <option value="Mono Shift">Mono Shift</option>
            <option value="Phase Master">Phase Master</option>
          </select>
        </div>

        {/* Speed */}
        <div>
          <label className="block text-gray-400 mb-1">Game Speed ({debugState.speedMultiplier}x)</label>
          <input 
            type="range" min="0.5" max="2" step="0.5"
            value={debugState.speedMultiplier}
            onChange={(e) => onUpdate({ speedMultiplier: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-2 pt-2 border-t border-gray-800">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
                type="checkbox" 
                checked={debugState.invincible}
                onChange={(e) => onUpdate({ invincible: e.target.checked })}
                className="accent-red-500"
            />
            Invincible Mode
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
                type="checkbox" 
                checked={debugState.showHitboxes}
                onChange={(e) => onUpdate({ showHitboxes: e.target.checked })}
                className="accent-red-500"
            />
            Show Hitboxes & Logic
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
                type="checkbox" 
                checked={debugState.showPatternName}
                onChange={(e) => onUpdate({ showPatternName: e.target.checked })}
                className="accent-red-500"
            />
            Show Pattern Names
          </label>
        </div>

        {/* Pattern Forcing */}
        <div className="pt-2 border-t border-gray-800">
          <label className="block text-gray-400 mb-1">Force Next Pattern</label>
          <select 
            className="w-full bg-black border border-gray-700 rounded p-1"
            value={debugState.forcedPattern || ''}
            onChange={(e) => onUpdate({ forcedPattern: e.target.value ? e.target.value as PatternCategory : null })}
          >
            <option value="">Random (By Logic)</option>
            <option value="BASIC">Basic</option>
            <option value="SANDWICH">Sandwich</option>
            <option value="REWARD">Reward Path</option>
            <option value="ADVANCED">Advanced/Narrow</option>
            <option value="TRAP">Trap/Fake</option>
          </select>
        </div>

      </div>
    </div>
  );
}
