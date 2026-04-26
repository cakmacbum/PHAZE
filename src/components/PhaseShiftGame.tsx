import React, { useEffect, useRef, useState } from 'react';
import { GameEngine, GAME_WIDTH, GAME_HEIGHT, PLAYER_X, PLAYER_SIZE, PLAYER_Y, GhostAction, THEME } from '../game/engine';

const engine = new GameEngine();

// Level System
export const XP_PER_LEVEL_SCALE = 100;
export const getPlayerLevel = (totalXp: number) => Math.floor(Math.sqrt(totalXp / XP_PER_LEVEL_SCALE)) + 1;

// Theme progression
export interface ThemeValues {
    colorA: [number, number, number];
    colorB: [number, number, number];
    gridOpacity: number;
    glowBlur: number;
    lineWidth: number;
    trailAlpha: number;
}

const THEME_STOPS = [
    { level: 1,  theme: { colorA: [0, 212, 255], colorB: [157, 0, 255], gridOpacity: 0.10, glowBlur: 20, lineWidth: 2, trailAlpha: 0.3 } },
    { level: 5,  theme: { colorA: [0, 180, 220], colorB: [130, 0, 200], gridOpacity: 0.08, glowBlur: 15, lineWidth: 1.5, trailAlpha: 0.25 } },
    { level: 12, theme: { colorA: [0, 120, 150], colorB: [90, 0, 130], gridOpacity: 0.05, glowBlur: 8, lineWidth: 1, trailAlpha: 0.2 } },
    { level: 25, theme: { colorA: [200, 255, 255], colorB: [240, 200, 255], gridOpacity: 0.02, glowBlur: 2, lineWidth: 1, trailAlpha: 0.15 } },
    { level: 50, theme: { colorA: [255, 255, 255], colorB: [150, 150, 150], gridOpacity: 0, glowBlur: 0, lineWidth: 1, trailAlpha: 0.1 } },
];

const THEME_NAME_TO_LEVEL: Record<string, number> = {
    'Dark Phase': 1,
    'Soft Neon': 5,
    'Deep Void': 12,
    'Mono Shift': 25,
    'Phase Master': 50
};

function getTargetTheme(level: number): ThemeValues {
    for (let i = THEME_STOPS.length - 1; i >= 0; i--) {
        if (level >= THEME_STOPS[i].level) {
             const start = THEME_STOPS[i];
             const end = THEME_STOPS[Math.min(i + 1, THEME_STOPS.length - 1)];
             if (start === end) return { ...start.theme };
             
             const progress = (level - start.level) / (end.level - start.level);
             return {
                 colorA: [
                     start.theme.colorA[0] + (end.theme.colorA[0] - start.theme.colorA[0]) * progress,
                     start.theme.colorA[1] + (end.theme.colorA[1] - start.theme.colorA[1]) * progress,
                     start.theme.colorA[2] + (end.theme.colorA[2] - start.theme.colorA[2]) * progress
                 ],
                 colorB: [
                     start.theme.colorB[0] + (end.theme.colorB[0] - start.theme.colorB[0]) * progress,
                     start.theme.colorB[1] + (end.theme.colorB[1] - start.theme.colorB[1]) * progress,
                     start.theme.colorB[2] + (end.theme.colorB[2] - start.theme.colorB[2]) * progress
                 ],
                 gridOpacity: start.theme.gridOpacity + (end.theme.gridOpacity - start.theme.gridOpacity) * progress,
                 glowBlur: start.theme.glowBlur + (end.theme.glowBlur - start.theme.glowBlur) * progress,
                 lineWidth: start.theme.lineWidth + (end.theme.lineWidth - start.theme.lineWidth) * progress,
                 trailAlpha: start.theme.trailAlpha + (end.theme.trailAlpha - start.theme.trailAlpha) * progress,
             }
        }
    }
    return { ...THEME_STOPS[0].theme };
}

let activeTheme: ThemeValues = { ...THEME_STOPS[0].theme };

export default function PhaseShiftGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState({
    score: 0,
    sparks: 0,
    combo: 0,
    gameOver: false,
    isStarted: false,
    eventText: '',
  });
  
  const [reviveCountdown, setReviveCountdown] = useState(0);
  const [isAdPlaying, setIsAdPlaying] = useState(false);

  const requestRef = useRef<number>(0);
  
  // Player Data System
  const PLAYER_DATA_KEY = 'phazePlayerData';
  
  const DEFAULT_PLAYER_DATA = {
    auraLevel: 1,
    xp: 0,
    sparks: 0,
    bestDistance: 0,
    combo: 0,
    unlockedThemes: ['Dark Phase']
  };

  const BEST_GHOST_KEY = 'phaseShiftBestGhost';
  
  const [totalXp, setTotalXp] = useState(DEFAULT_PLAYER_DATA.xp);
  const [playerLevel, setPlayerLevel] = useState(DEFAULT_PLAYER_DATA.auraLevel);
  const [totalSparks, setTotalSparks] = useState(DEFAULT_PLAYER_DATA.sparks);
  const [bestDistance, setBestDistance] = useState(DEFAULT_PLAYER_DATA.bestDistance);

  useEffect(() => {
     let data = { ...DEFAULT_PLAYER_DATA };
     try {
         const stored = localStorage.getItem(PLAYER_DATA_KEY);
         if (stored) {
             data = { ...DEFAULT_PLAYER_DATA, ...JSON.parse(stored) };
         } else {
             // Handle migration from old keys if any exist, then clear them
             const oldXp = localStorage.getItem('phaseShiftTotalXp');
             const oldBest = localStorage.getItem('phaseShiftBestScore');
             if (oldXp || oldBest) {
                 data.xp = parseInt(oldXp || '0', 10);
                 data.bestDistance = parseInt(oldBest || '0', 10);
                 localStorage.removeItem('phaseShiftTotalXp');
                 localStorage.removeItem('phaseShiftBestScore');
             }
             localStorage.setItem(PLAYER_DATA_KEY, JSON.stringify(data));
         }
     } catch(e) {
         console.error('Failed to load player data', e);
     }
     
     setTotalXp(data.xp);
     setPlayerLevel(getPlayerLevel(data.xp));
     setTotalSparks(data.sparks || 0);
     setBestDistance(data.bestDistance || 0);
  }, []);

  useEffect(() => {
    engine.onGameOver = (score, sparks, ghostActions) => {
      setGameState(prev => ({ ...prev, gameOver: true }));
      setReviveCountdown(5);
      
      let data = { ...DEFAULT_PLAYER_DATA };
      try {
          const stored = localStorage.getItem(PLAYER_DATA_KEY);
          if (stored) {
              data = { ...DEFAULT_PLAYER_DATA, ...JSON.parse(stored) };
          }
      } catch(e) {}

      let isNewBest = false;
      if (score > data.bestDistance) {
          data.bestDistance = score;
          isNewBest = true;
          try {
             localStorage.setItem(BEST_GHOST_KEY, JSON.stringify(ghostActions));
          } catch(e) {}
      }
      
      data.sparks = (data.sparks || 0) + sparks;
      data.xp += score;
      data.auraLevel = getPlayerLevel(data.xp);
      
      try {
          localStorage.setItem(PLAYER_DATA_KEY, JSON.stringify(data));
      } catch(e) {}
      
      setTotalXp(data.xp);
      setPlayerLevel(data.auraLevel);
      setTotalSparks(data.sparks);
      setBestDistance(data.bestDistance);
    };
    engine.onScoreUpdate = (score, combo) => {
      setGameState(prev => ({ ...prev, score, combo }));
    };

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (time: number) => {
      engine.update(time);
      
      // Apply screen shake to canvas, NOT container (so UI remains perfectly stable)
      if (canvasRef.current) {
          if (engine.state.screenShake > 0) {
              const dx = (Math.random() - 0.5) * engine.state.screenShake;
              const dy = (Math.random() - 0.5) * engine.state.screenShake;
              canvasRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
          } else {
              canvasRef.current.style.transform = 'translate(0px, 0px)';
          }
      }

      // Level theme lerping
      if (!engine.state.gameOver) {
          const effectiveLevel = playerLevel;
          const targetTheme = getTargetTheme(effectiveLevel);
          const lerpSpeed = 0.05; // Quick enough to reach target, slow enough to be smooth
          activeTheme.colorA = activeTheme.colorA.map((c, i) => c + (targetTheme.colorA[i] - c) * lerpSpeed) as [number, number, number];
          activeTheme.colorB = activeTheme.colorB.map((c, i) => c + (targetTheme.colorB[i] - c) * lerpSpeed) as [number, number, number];
          activeTheme.gridOpacity += (targetTheme.gridOpacity - activeTheme.gridOpacity) * lerpSpeed;
          activeTheme.glowBlur += (targetTheme.glowBlur - activeTheme.glowBlur) * lerpSpeed;
          activeTheme.lineWidth += (targetTheme.lineWidth - activeTheme.lineWidth) * lerpSpeed;
          activeTheme.trailAlpha += (targetTheme.trailAlpha - activeTheme.trailAlpha) * lerpSpeed;
          
          THEME.colorA = `rgb(${activeTheme.colorA.map(Math.round).join(',')})`;
          THEME.colorB = `rgb(${activeTheme.colorB.map(Math.round).join(',')})`;
      }

      draw(ctx);
      requestRef.current = requestAnimationFrame(render);
      
      if (engine.state.isStarted && !engine.state.gameOver) {
          setGameState({
              score: engine.state.score,
              sparks: engine.state.sparks,
              combo: engine.state.combo,
              gameOver: engine.state.gameOver,
              isStarted: engine.state.isStarted,
              eventText: engine.state.eventTimer > 0 ? engine.state.eventText : '',
          });
      }
    };
    
    requestRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const draw = (ctx: CanvasRenderingContext2D) => {
    // Clear background transparent to show grid behind
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw moving perspective grid effect conceptually
    if (activeTheme.gridOpacity > 0 && !engine.state.gameOver) {
        // Create subtle fade towards the edges
        const gradient = ctx.createLinearGradient(0, 0, GAME_WIDTH, 0);
        const r = 200, g = 220, b = 255; // Slightly blue/cyan tinted white
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        gradient.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, ${activeTheme.gridOpacity})`);
        gradient.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, ${activeTheme.gridOpacity})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1; // Grid lines always physically thin
        
        ctx.beginPath();
        const offset = -(engine.state.distance % 40);
        for (let i = 0; i < GAME_WIDTH + 40; i += 40) {
          ctx.moveTo(i + offset, 0);
          ctx.lineTo(i + offset, GAME_HEIGHT);
        }
        ctx.stroke();

        // Draw Horizontal Lines
        const hGradient = ctx.createLinearGradient(0, 0, GAME_WIDTH, 0);
        const hOpacity = Math.max(0, activeTheme.gridOpacity - 0.02);
        hGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        hGradient.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, ${hOpacity})`);
        hGradient.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, ${hOpacity})`);
        hGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        
        ctx.strokeStyle = hGradient;
        ctx.beginPath();
        const hOffset = Math.floor(GAME_HEIGHT / 2); // Center line
        const distanceFl = Math.floor(engine.state.distance * 0.1); // subtle horizontal sway? Not requested, let's keep it static perspective lines
        for (let i = 0; i <= GAME_HEIGHT; i += 40) {
          ctx.moveTo(0, i);
          ctx.lineTo(GAME_WIDTH, i);
        }
        ctx.stroke();
    }

    if (!engine.state.isStarted) return;

    // Draw Obstacles
    engine.obstacles.forEach(obs => {
      ctx.save();
      
      if (obs.type === 'SPARK') {
        ctx.shadowBlur = activeTheme.glowBlur;
        if (!obs.collected) {
           ctx.shadowColor = obs.layer === 'A' ? THEME.colorA : THEME.colorB;
           ctx.fillStyle = ctx.shadowColor;
           ctx.save();
           ctx.translate(obs.x + obs.width/2, GAME_HEIGHT/2);
           ctx.rotate(Math.PI / 4 + engine.state.distance * 0.01); // Spin effect for flavor
           ctx.fillRect(-10, -10, 20, 20);
           ctx.strokeStyle = '#ffffff';
           ctx.lineWidth = 1;
           ctx.strokeRect(-10, -10, 20, 20);
           ctx.restore();
        }
      } else if (obs.type === 'PHASE_LOCK') {
         ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
         ctx.fillRect(obs.x, 0, obs.width, GAME_HEIGHT);
         
         ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
         ctx.lineWidth = 4;
         ctx.setLineDash([10, 10]);
         ctx.beginPath();
         ctx.moveTo(obs.x, 0);
         ctx.lineTo(obs.x, GAME_HEIGHT);
         ctx.moveTo(obs.x + obs.width, 0);
         ctx.lineTo(obs.x + obs.width, GAME_HEIGHT);
         ctx.stroke();
         
         ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
         ctx.font = '14px JetBrains Mono, monospace';
         ctx.fillText('PHASE LOCK', obs.x + obs.width / 2, GAME_HEIGHT - 20);
      } else {
        ctx.shadowBlur = activeTheme.glowBlur;
        if (obs.layer === 'A') {
          ctx.shadowColor = THEME.colorA;
          ctx.fillStyle = engine.state.layer === 'A' ? THEME.colorA : 'rgba(0, 243, 255, 0.2)';
          ctx.strokeStyle = THEME.colorA;
        } else if (obs.layer === 'B') {
          ctx.shadowColor = THEME.colorB;
          ctx.fillStyle = engine.state.layer === 'B' ? THEME.colorB : 'rgba(208, 0, 255, 0.2)';
          ctx.strokeStyle = THEME.colorB;
        } else {
          ctx.shadowColor = '#fff';
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#fff';
        }
        
        ctx.lineWidth = activeTheme.lineWidth;
        ctx.fillRect(obs.x, 0, obs.width, GAME_HEIGHT);
        if (obs.layer !== 'BOTH' && obs.layer !== engine.state.layer) {
             ctx.strokeRect(obs.x, 0, obs.width, GAME_HEIGHT);
        }
      }
      ctx.restore();
    });

    // Draw ghost
    if (engine.ghostLayer && !engine.state.gameOver) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = engine.ghostLayer === 'A' ? THEME.colorA : THEME.colorB;
        ctx.fillRect(PLAYER_X, PLAYER_Y, PLAYER_SIZE, PLAYER_SIZE);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = activeTheme.lineWidth;
        ctx.strokeRect(PLAYER_X, PLAYER_Y, PLAYER_SIZE, PLAYER_SIZE);
        ctx.restore();
    }

    // Draw player
    if (!engine.state.gameOver) {
        ctx.save();
        ctx.shadowBlur = activeTheme.glowBlur;
        
        if (engine.state.isPhaseLocked) {
           ctx.shadowColor = '#ffff00';
           ctx.fillStyle = '#ffff00';
        } else {
           ctx.shadowColor = engine.state.layer === 'A' ? THEME.colorA : THEME.colorB;
           ctx.fillStyle = ctx.shadowColor;
        }

        ctx.fillRect(PLAYER_X, PLAYER_Y, PLAYER_SIZE, PLAYER_SIZE);
        
        // Trail effect
        const trailAlphaBase = engine.state.combo > 5 ? activeTheme.trailAlpha * 2 : activeTheme.trailAlpha;
        ctx.globalAlpha = trailAlphaBase;
        ctx.fillRect(PLAYER_X - 15, PLAYER_Y + 5, 15, PLAYER_SIZE - 10);
        ctx.globalAlpha = trailAlphaBase / 2;
        ctx.fillRect(PLAYER_X - 30, PLAYER_Y + 10, 15, PLAYER_SIZE - 20);
        
        if (engine.state.isPhaseLocked) {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(PLAYER_X + 5, PLAYER_Y + 5);
            ctx.lineTo(PLAYER_X + PLAYER_SIZE - 5, PLAYER_Y + PLAYER_SIZE - 5);
            ctx.moveTo(PLAYER_X + PLAYER_SIZE - 5, PLAYER_Y + 5);
            ctx.lineTo(PLAYER_X + 5, PLAYER_Y + PLAYER_SIZE - 5);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    // Draw Particles
    ctx.save();
    engine.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fillRect(p.x, p.y, Math.min(8, Math.max(2, p.life / 100)), Math.min(8, Math.max(2, p.life / 100)));
    });
    ctx.restore();
    
    // Draw Near Miss text
    if (engine.state.nearMissActive > 0) {
        ctx.save();
        ctx.fillStyle = '#ffdf00';
        ctx.font = 'bold 24px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffdf00';
        ctx.fillText('NEAR MISS!', PLAYER_X + PLAYER_SIZE/2, PLAYER_Y - 30);
        ctx.restore();
    }
  };

  const handlePointerDown = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
     e.preventDefault();
     if (!engine.state.isStarted || engine.state.gameOver) {
         startGame();
     } else {
         engine.switchLayer();
     }
  };

  useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
         if (e.code === 'Space') {
             e.preventDefault();
             if (!engine.state.isStarted || engine.state.gameOver) {
                 startGame();
             } else {
                 engine.switchLayer();
             }
         }
     }
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
      if (gameState.gameOver && reviveCountdown > 0 && !isAdPlaying) {
          const timeout = setTimeout(() => {
              setReviveCountdown(c => c - 1);
          }, 1000);
          return () => clearTimeout(timeout);
      }
  }, [gameState.gameOver, reviveCountdown, isAdPlaying]);

  const playAdAndRevive = () => {
      setIsAdPlaying(true);
      setTimeout(() => {
          setIsAdPlaying(false);
          engine.revive();
          setGameState(prev => ({ ...prev, gameOver: false }));
      }, 2500); // 2.5 second simulated ad
  };

  const startGame = () => {
    const rawGhost = localStorage.getItem(BEST_GHOST_KEY);
    let ghost: GhostAction[] | undefined = undefined;
    if (rawGhost) {
        try {
            ghost = JSON.parse(rawGhost);
        } catch(e) {}
    }

    engine.start(ghost);
    setGameState({
      score: 0,
      sparks: 0,
      combo: 0,
      gameOver: false,
      isStarted: true,
      eventText: ''
    });
  };

  return (
    <div 
      className="w-full h-full flex items-center justify-center p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)] touch-none select-none"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
    >
      <div 
        ref={containerRef}
        className="relative bg-[#050505] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden lg:border-8 border-[#1a1a1a] flex-shrink-0"
        style={{ 
          width: '100%', 
          height: '100%', 
          maxHeight: '100dvh', 
          maxWidth: 'min(100%, calc(100dvh * 2))', 
          aspectRatio: '2 / 1' 
        }}
      >
      
      {/* Grid Background Overlay */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{ 
          backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }}
      ></div>

      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="w-full h-full block cursor-pointer relative z-10"
        style={{ imageRendering: 'pixelated' }}
      />
      
      {/* Event Overlay */}
      {gameState.eventText && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="text-[clamp(1.5rem,5vw,2.25rem)] font-black text-white italic tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-[ping_0.5s_cubic-bezier(0,0,0.2,1)_reverse]">
                  {gameState.eventText}
              </div>
          </div>
      )}
      
      {/* HUD */}
      {gameState.isStarted && (
          <div className="absolute top-0 w-full p-8 flex justify-between items-start pointer-events-none z-20 font-mono">
              <div className="space-y-1">
                  <div className="text-[clamp(10px,1.5vw,14px)] text-[var(--colorA)] tracking-[0.2em] uppercase font-bold" style={{color: THEME.colorA}}>Current Distance</div>
                  <div className="text-[clamp(1.5rem,5vw,2.25rem)] font-black text-white tabular-nums leading-none">{gameState.score}<span className="text-[clamp(1rem,2.5vw,1.25rem)] opacity-40 uppercase ml-2">m</span></div>
              </div>
              
              <div className="flex flex-col items-center">
                  <div className="text-[clamp(10px,1.5vw,14px)] tracking-[0.3em] font-bold text-white/50 uppercase">Aura Lvl</div>
                  <div className="text-[clamp(1.2rem,4vw,1.5rem)] font-black text-white tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                      {playerLevel}
                  </div>
                  {gameState.combo > 1 && (
                      <div className="mt-2 bg-[#00d4ff]/10 border border-[#00d4ff] px-4 py-1 rounded-full">
                          <div className="text-[clamp(1rem,2.5vw,1.25rem)] font-black text-[#00d4ff] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] italic uppercase tracking-tighter">Combo x{gameState.combo}</div>
                      </div>
                  )}
              </div>
              
              <div className="text-right space-y-1">
                  <div className="text-[clamp(10px,1.5vw,14px)] text-[var(--colorB)] tracking-[0.2em] uppercase font-bold" style={{color: THEME.colorB}}>Sparks Collected</div>
                  <div className="flex items-center justify-end gap-2">
                      <div className="text-[clamp(1.5rem,5vw,2.25rem)] font-black text-white tabular-nums leading-none">{gameState.sparks}</div>
                      <div className="w-4 h-4 rotate-45 border border-white" style={{backgroundColor: THEME.colorB}}></div>
                  </div>
              </div>
          </div>
      )}

      {/* Start Overlay */}
      {(!gameState.isStarted) && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center pointer-events-auto z-30 backdrop-blur-sm p-8">
            {/* Logo Component Area */}
            <div className="flex flex-col items-center mb-6">
                <h1 className="text-[clamp(2.5rem,8vw,3.75rem)] font-black uppercase tracking-[0.3em] pl-[0.3em] flex items-center justify-center gap-1 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                    <span style={{ color: THEME.colorA }}>P</span>
                    <span className="text-white">H</span>
                    <span className="text-[1.1em] text-white">Λ</span>
                    <span className="text-white">Z</span>
                    <span style={{ color: THEME.colorB }}>E</span>
                </h1>
            </div>
            
            <div className="mb-6 flex flex-col items-center">
                <div className="text-[clamp(10px,1.5vw,14px)] tracking-[0.3em] font-bold text-white/50 uppercase mb-1">Aura Level</div>
                <div className="text-[clamp(1.5rem,5vw,2.25rem)] font-black text-white tabular-nums">
                    {playerLevel}
                </div>
                <div className="text-[clamp(10px,1.5vw,14px)] text-white/40 uppercase mt-1">XP: {totalXp}</div>
            </div>
            
            <div className="text-white/60 mb-8 max-w-md text-center text-[clamp(0.75rem,2vw,0.875rem)] leading-relaxed tracking-wider">
                 Navigate parallel realities. <br/>
                 <span style={{color: THEME.colorA}} className="font-bold">Color A</span> destroys <span style={{color: THEME.colorA}} className="font-bold">Color A</span>. <br/>
                 <span style={{color: THEME.colorB}} className="font-bold">Color B</span> destroys <span style={{color: THEME.colorB}} className="font-bold">Color B</span>.<br/>
                 <br/>
                 <span className="text-[clamp(10px,1.5vw,14px)] tracking-[0.3em] opacity-80 uppercase">Tap or Space to Shift</span>
             </div>

            <div className="text-center flex flex-col items-center group mt-4">
                <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center mb-2 bg-white/5 relative">
                    <div className="absolute inset-0 rounded-full border border-white animate-ping opacity-20"></div>
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                </div>
                <div className="text-[10px] tracking-[0.4em] uppercase text-white opacity-80">Initialize</div>
            </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState.isStarted && gameState.gameOver && !isAdPlaying && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center pointer-events-auto z-30 backdrop-blur-sm p-8">
            <h1 className="text-[clamp(2.5rem,8vw,3.75rem)] font-black mb-2 uppercase tracking-widest text-red-500">
                You Crashed
            </h1>
            <div className="text-white/60 mb-8 max-w-md text-center text-[clamp(1rem,2.5vw,1.25rem)] italic tracking-wider">
               {gameState.score > 2000 ? "Almost there!" : "One more try?"}
            </div>
            
            <div className="text-center mb-10 flex gap-12">
                <div>
                    <div className="text-[clamp(10px,1.5vw,14px)] tracking-[0.2em] text-[#00d4ff] uppercase">Final Distance</div>
                    <div className="text-[clamp(1.5rem,5vw,2.25rem)] font-black text-white tabular-nums">{gameState.score}<span className="text-[clamp(1rem,2.5vw,1.25rem)] opacity-40 uppercase ml-1">m</span></div>
                </div>
                <div>
                    <div className="text-[clamp(10px,1.5vw,14px)] tracking-[0.2em] text-[#9d00ff] uppercase">Sparks</div>
                    <div className="text-[clamp(1.5rem,5vw,2.25rem)] font-black text-white tabular-nums">{gameState.sparks}</div>
                </div>
            </div>

            <div className="flex gap-6 w-full max-w-lg justify-center items-stretch h-[clamp(60px,15vh,100px)]">
                <button 
                  onPointerDown={(e) => { e.stopPropagation(); startGame(); }}
                  className="flex-1 border-2 border-white/20 bg-black/50 hover:bg-white/10 active:bg-white/20 flex items-center justify-center text-white uppercase tracking-widest font-bold transition-colors cursor-pointer"
                >
                    Try Again
                </button>
                
                {reviveCountdown > 0 && !engine.state.hasUsedRevive && (
                  <button 
                    onPointerDown={(e) => { e.stopPropagation(); playAdAndRevive(); }}
                    className="flex-1 bg-white text-black hover:bg-gray-200 active:bg-gray-300 flex flex-col items-center justify-center uppercase tracking-widest transition-transform transform hover:scale-[1.02] shadow-[0_0_30px_rgba(255,255,255,0.4)] relative cursor-pointer overflow-hidden"
                  >
                      <div className="font-black text-[clamp(1rem,2.5vw,1.25rem)] mb-1 flex items-center gap-2">
                        Continue <span className="text-[clamp(0.75rem,2vw,0.875rem)]">▶</span>
                      </div>
                      <div className="text-[clamp(10px,1.5vw,14px)] font-bold opacity-60">Watch Ad</div>
                      
                      {/* Timer progress bar at bottom */}
                      <div className="absolute bottom-0 left-0 h-[6px] bg-black/20 w-full">
                         <div className="h-full bg-red-500 transition-all duration-1000 ease-linear" style={{ width: `${(reviveCountdown / 5) * 100}%` }}></div>
                      </div>
                  </button>
                )}
            </div>
        </div>
      )}

      {/* Simulated Ad Overlay */}
      {isAdPlaying && (
         <div className="absolute inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center text-white font-mono pointer-events-auto">
            <div className="animate-pulse mb-8 text-[#00d4ff] border border-[#00d4ff] px-6 py-2 uppercase tracking-widest text-[clamp(10px,1.5vw,14px)] font-bold shadow-[0_0_15px_#00d4ff]">External Sponsor</div>
            <div className="text-[clamp(1.2rem,4vw,1.5rem)] font-black mb-2 opacity-50 italic">Playing Rewarded Ad...</div>
            <div className="mt-8 text-[clamp(10px,1.5vw,14px)] tracking-widest uppercase opacity-40">Please wait 3 seconds</div>
         </div>
      )}

      {/* Visual Effects Layers */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] z-40"></div>
      <div className="absolute top-0 left-0 w-full h-[2px] bg-white opacity-10 animate-scanline z-50 pointer-events-none"></div>
    </div>
    </div>
  );
}
