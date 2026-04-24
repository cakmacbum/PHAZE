import { PatternSystem } from './patternSystem';

export type Layer = 'A' | 'B';
export type ObstacleType = 'WALL' | 'SPARK' | 'PHASE_LOCK';

export interface GameState {
  score: number;
  combo: number;
  sparks: number;
  layer: Layer;
  speed: number;
  distance: number;
  runTimeSec: number;
  gameOver: boolean;
  isStarted: boolean;
  nearMissActive: number;
  isPhaseLocked: boolean;
  gracePeriod: number;
  screenShake: number;
  timeScale: number;
  targetTimeScale: number;
  eventText: string;
  eventTimer: number;
  hasUsedRevive: boolean;
}

export interface Obstacle {
  id: number;
  x: number;
  width: number;
  type: ObstacleType;
  layer: Layer | 'BOTH';
  passed: boolean;
  collected?: boolean;
  patternName?: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface GhostAction {
  timeSec: number;
  layer: Layer;
}

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 450;
export const PLAYER_SIZE = 30;
export const PLAYER_X = 150;
export const PLAYER_Y = GAME_HEIGHT / 2 - PLAYER_SIZE / 2;

export const GLOBAL_SPEED_MULTIPLIER = 0.8;

export const THEME = {
  colorA: '#00d4ff',
  colorB: '#9d00ff',
  gridOpacity: 0.2,
  glowBlur: 20,
  lineWidth: 2,
  trailAlpha: 0.3
};

export interface DebugConfig {
  speedMultiplier: number;
  invincible: boolean;
  forcedPattern: any | null; // Typed loosely to avoid circular dependency initially, but 'string' is fine.
}

export class GameEngine {
  public state: GameState;
  public obstacles: Obstacle[] = [];
  public particles: Particle[] = [];
  private lastTime: number = 0;
  private obstacleIdCounter = 0;
  private spawnTimer = 0;
  private patternSystem: PatternSystem = new PatternSystem();
  private nextEventTime = 20 + Math.random() * 20;
  
  public debugConfig: DebugConfig = {
      speedMultiplier: 1,
      invincible: false,
      forcedPattern: null
  };
  
  public currentGhost: GhostAction[] = [];
  public recordedGhost: GhostAction[] = [];
  public ghostLayer: Layer | null = null;
  private ghostIndex = 0;
  
  public onGameOver?: (score: number, sparks: number, ghostActions: GhostAction[]) => void;
  public onScoreUpdate?: (score: number, combo: number) => void;
  
  public triggerEvent(text: string, durationSec: number) {
      this.state.eventText = text;
      this.state.eventTimer = durationSec;
  }

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): GameState {
    return {
      score: 0,
      combo: 0,
      sparks: 0,
      layer: 'A',
      speed: 400,
      distance: 0,
      runTimeSec: 0,
      gameOver: false,
      isStarted: false,
      nearMissActive: 0,
      isPhaseLocked: false,
      gracePeriod: 0,
      screenShake: 0,
      timeScale: 1,
      targetTimeScale: 1,
      eventText: '',
      eventTimer: 0,
      hasUsedRevive: false
    };
  }

  public start(loadedGhost?: GhostAction[]) {
    this.state = this.getInitialState();
    this.state.isStarted = true;
    this.obstacles = [];
    this.particles = [];
    this.recordedGhost = [{ timeSec: 0, layer: 'A' }];
    this.currentGhost = loadedGhost || [];
    this.ghostIndex = 0;
    this.ghostLayer = this.currentGhost.length > 0 ? 'A' : null;
    this.lastTime = performance.now();
    this.patternSystem = new PatternSystem();
    this.nextEventTime = 30 + Math.random() * 30;
  }

  public revive() {
    this.state.gameOver = false;
    this.state.hasUsedRevive = true;
    this.state.gracePeriod = 1.5; // 1.5 second invincibility
    this.state.timeScale = 0.2; // Starts very slow, matrix style
    this.state.targetTimeScale = 1.0;
    
    // Clear out any walls that are immediately overlapping the player to prevent visual confusion or instant death after grace
    this.obstacles = this.obstacles.filter(obs => {
       const obsRight = obs.x + obs.width;
       const obsLeft = obs.x;
       const playerRight = PLAYER_X + PLAYER_SIZE;
       const playerLeft = PLAYER_X;
       
       const inXBounds = playerRight > obsLeft - 150 && playerLeft < obsRight + 150;
       return !(inXBounds && obs.type === 'WALL');
    });

    this.triggerEvent('! SYSTEM RESTORED !', 2);
  }

  public switchLayer() {
    if (this.state.gameOver || !this.state.isStarted || this.state.isPhaseLocked) return;
    const oldLayer = this.state.layer;
    this.state.layer = this.state.layer === 'A' ? 'B' : 'A';
    this.state.gracePeriod = 0.05; // 0.05 seconds grace period
    
    this.recordedGhost.push({ timeSec: this.state.runTimeSec, layer: this.state.layer });
    
    this.spawnParticles(
      PLAYER_X + PLAYER_SIZE/2, 
      PLAYER_Y + PLAYER_SIZE/2, 
      15, 
      this.state.layer === 'A' ? THEME.colorA : THEME.colorB,
      200
    );

    const closestObj = this.obstacles.find(o => o.x > PLAYER_X && o.x < PLAYER_X + 150 && o.layer === oldLayer && o.type === 'WALL');
    if (closestObj) {
      const dist = closestObj.x - (PLAYER_X + PLAYER_SIZE);
      if (dist < 80) { // Near miss!
        let pts = 3;
        if (dist < 30) {
            pts = 5;
            this.state.screenShake = 15;
            this.triggerEvent('CLUTCH SAVE', 1);
        } else {
            this.state.screenShake = 5;
            this.triggerEvent('NEAR MISS', 0.5);
        }
        
        this.state.combo++;
        this.state.score += pts * this.state.combo;
        this.state.nearMissActive = 400;
        
        this.spawnParticles(
          PLAYER_X + PLAYER_SIZE/2, 
          PLAYER_Y + PLAYER_SIZE/2, 
          35, 
          '#ffdf00',
          500
        );
        
        if (this.onScoreUpdate) {
          this.onScoreUpdate(this.state.score, this.state.combo);
        }
      }
    }
  }

  public update(time: number) {
    if (!this.state.isStarted || this.state.gameOver) {
      this.lastTime = time;
      return;
    }

    const unscaledDt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    
    // Lerp timescale
    this.state.timeScale += (this.state.targetTimeScale - this.state.timeScale) * unscaledDt * 2;
    const dt = unscaledDt * this.state.timeScale * this.debugConfig.speedMultiplier * GLOBAL_SPEED_MULTIPLIER;

    this.state.distance += this.state.speed * dt;
    this.state.runTimeSec += dt;
    this.state.score = Math.floor(this.state.distance / 100) + (this.state.sparks * 10);
    this.state.speed += dt * 3; // Gradual speed up
    this.state.speed = Math.min(this.state.speed, 1400); // Higher Max speed cap

    // Handle Random run events
    if (this.state.runTimeSec > this.nextEventTime) {
        this.nextEventTime += 30 + Math.random() * 30; // 30-60s per event
        const r = Math.random();
        if (r < 0.33) {
            this.triggerEvent('! SLOW MOTION EVENT !', 4);
            this.state.targetTimeScale = 0.5;
            setTimeout(() => this.state.targetTimeScale = 1, 4000);
        } else if (r < 0.66) {
            this.triggerEvent('! PHASE STORM !', 3);
            this.state.targetTimeScale = 1.3;
            // Spawn rapid walls
            for(let i = 0; i < 5; i++) {
                this.obstacles.push({
                    id: ++this.obstacleIdCounter,
                    x: GAME_WIDTH + 800 + i * 200,
                    width: 50,
                    type: 'WALL',
                    layer: Math.random() > 0.5 ? 'A' : 'B',
                    passed: false
                });
            }
            setTimeout(() => this.state.targetTimeScale = 1, 3000);
        } else {
            this.triggerEvent('! SPARK BURST !', 3);
            for(let i = 0; i < 10; i++) {
                this.obstacles.push({
                    id: ++this.obstacleIdCounter,
                    x: GAME_WIDTH + 800 + i * 80,
                    width: 20,
                    type: 'SPARK',
                    layer: Math.random() > 0.5 ? 'A' : 'B',
                    passed: false
                });
            }
        }
    }

    if (this.state.nearMissActive > 0) {
      this.state.nearMissActive -= unscaledDt * 1000;
    }
    
    if (this.state.gracePeriod > 0) {
      this.state.gracePeriod -= dt;
    }
    
    if (this.state.screenShake > 0) {
        this.state.screenShake -= unscaledDt * 60;
        if (this.state.screenShake < 0) this.state.screenShake = 0;
    }
    
    if (this.state.eventTimer > 0) {
        this.state.eventTimer -= unscaledDt;
    }
    
    // Ghost Logic
    if (this.currentGhost.length > 0 && this.ghostIndex < this.currentGhost.length) {
        let action = this.currentGhost[this.ghostIndex];
        while (action && this.state.runTimeSec >= action.timeSec) {
            this.ghostLayer = action.layer;
            this.ghostIndex++;
            action = this.currentGhost[this.ghostIndex];
        }
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnPattern();
    }

    let currentlyLocked = false;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.state.speed * dt;

      const obsRight = obs.x + obs.width;
      const obsLeft = obs.x;
      const playerRight = PLAYER_X + PLAYER_SIZE;
      const playerLeft = PLAYER_X;
      
      const inXBounds = playerRight > obsLeft && playerLeft < obsRight;

      if (inXBounds) {
          if (obs.type === 'PHASE_LOCK') {
              currentlyLocked = true;
          } else if (!obs.passed && !obs.collected) {
              if (obs.type === 'SPARK') {
                if (obs.layer === this.state.layer || obs.layer === 'BOTH') {
                  obs.collected = true;
                  this.state.sparks++;
                  this.spawnParticles(PLAYER_X + PLAYER_SIZE, PLAYER_Y + PLAYER_SIZE/2, 10, '#ffffff', 300);
                }
              } else if (obs.type === 'WALL') {
                if ((obs.layer === this.state.layer || obs.layer === 'BOTH') && this.state.gracePeriod <= 0) {
                  this.handleCollision();
                }
              }
          }
      }

      if (obsRight < playerLeft && !obs.passed && obs.type !== 'SPARK' && obs.type !== 'PHASE_LOCK') {
         obs.passed = true;
      }

      if (obsRight < -100) {
        this.obstacles.splice(i, 1);
      }
    }
    
    this.state.isPhaseLocked = currentlyLocked;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= unscaledDt * 1000; // particles always run at real time
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private handleCollision() {
    if (this.debugConfig.invincible) return;
    this.state.gameOver = true;
    this.state.combo = 0;
    this.state.screenShake = 30; // Huge shake on death
    this.spawnParticles(PLAYER_X + PLAYER_SIZE/2, PLAYER_Y + PLAYER_SIZE/2, 100, '#ff0000', 1000);
    this.triggerEvent('SYSTEM FAILURE', 2);
    if (this.onGameOver) {
      this.onGameOver(this.state.score, this.state.sparks, this.recordedGhost);
    }
  }

  private spawnPattern() {
    const pattern = this.patternSystem.getNextPattern(this.state.runTimeSec, this.state.speed, this.debugConfig.forcedPattern);
    
    for (let i = 0; i < pattern.spawns.length; i++) {
      const spawn = pattern.spawns[i];
      this.obstacles.push({
        id: ++this.obstacleIdCounter,
        x: GAME_WIDTH + 100 + spawn.offsetX,
        width: spawn.width,
        type: spawn.type,
        layer: spawn.layer,
        passed: false,
        patternName: i === 0 ? pattern.category : undefined
      });
    }

    this.spawnTimer = (pattern.totalWidth / this.state.speed);
  }

  private spawnParticles(x: number, y: number, count: number, color: string, life: number) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 200 + 50;
        this.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: life * (0.5 + Math.random()),
            maxLife: life,
            color
        });
    }
  }

  public get combo() { return this.state.combo; }
  public set combo(value: number) { this.state.combo = value; }
}
