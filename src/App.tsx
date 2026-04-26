/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import PhaseShiftGame from './components/PhaseShiftGame';

export default function App() {
  return (
    <div className="w-full h-full bg-[#000] flex items-center justify-center m-0 p-0 overflow-hidden relative">
      <PhaseShiftGame />
      
      {/* Portrait warning overlay */}
      <div className="portrait-warning fixed inset-0 z-[100] bg-black text-white flex-col items-center justify-center p-8 text-center">
        <svg className="w-20 h-20 mb-6 animate-[bounce_2s_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12V8a2 2 0 012-2h12a2 2 0 012 2v4M4 12v4a2 2 0 002 2h12a2 2 0 002-2v-4M4 12h16" />
          <path d="M12 2v4M12 22v-4M2 12h4M22 12h-4" />
          <path d="M15 15l3 3M6 6l3 3" />
        </svg>
        <h2 className="text-3xl font-black tracking-widest uppercase mb-4 text-[#00d4ff]">Rotate Device</h2>
        <p className="text-white/60 text-lg uppercase tracking-wider">Please rotate your device horizontally to play.</p>
      </div>
    </div>
  );
}
