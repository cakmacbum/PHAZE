import { Layer, ObstacleType } from './engine';

export type PatternCategory = 'BASIC' | 'SANDWICH' | 'REWARD' | 'ADVANCED' | 'TRAP';

export interface SpawnInstruction {
  type: ObstacleType;
  layer: Layer | 'BOTH';
  width: number;
  offsetX: number;
}

export interface PatternResult {
  category: PatternCategory;
  spawns: SpawnInstruction[];
  totalWidth: number;
}

export class PatternSystem {
  private lastPatternCategory: PatternCategory | null = null;
  
  public getNextPattern(runDurationSec: number, speed: number, forcedCategory?: PatternCategory | null): PatternResult {
    let allowedCategories: PatternCategory[] = ['BASIC'];
    
    // Core Rules: Learning Phase (0-15s), Adaptation Phase (15-30s), Skill Build Phase (30-60s), Mastery Phase (60s+)
    if (runDurationSec > 15) allowedCategories.push('SANDWICH');
    if (runDurationSec > 30) allowedCategories.push('REWARD');
    if (runDurationSec > 45) allowedCategories.push('ADVANCED');
    if (runDurationSec > 60) allowedCategories.push('TRAP');
    
    // Attempt pattern chaining, avoid repeating if possible
    if (allowedCategories.length > 1 && this.lastPatternCategory) {
      allowedCategories = allowedCategories.filter(c => c !== this.lastPatternCategory || Math.random() > 0.7);
      if (allowedCategories.length === 0) allowedCategories = ['BASIC'];
    }
    
    const category = forcedCategory || this.pickRandom(allowedCategories);
    this.lastPatternCategory = category;
    
    const difficultyMultiplier = Math.min(1 + (runDurationSec / 60), 3); // Scales 1 to 3
    
    let result: { spawns: SpawnInstruction[], totalWidth: number };
    
    switch (category) {
      case 'BASIC': result = this.generateBasic(speed, difficultyMultiplier); break;
      case 'SANDWICH': result = this.generateSandwich(speed, difficultyMultiplier); break;
      case 'REWARD': result = this.generateReward(speed, difficultyMultiplier); break;
      case 'ADVANCED': result = this.generateAdvanced(speed, difficultyMultiplier); break;
      case 'TRAP': result = this.generateTrap(speed, difficultyMultiplier); break;
      default: result = this.generateBasic(speed, difficultyMultiplier); break;
    }
    
    return {
        ...result,
        category
    };
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private randomLayer(): Layer {
    return Math.random() > 0.5 ? 'A' : 'B';
  }

  private generateBasic(speed: number, diff: number): PatternResult {
    const l = this.randomLayer();
    const width = 40 + Math.random() * 40 * diff;
    
    const hasSpark = Math.random() > 0.5;
    const spawns: SpawnInstruction[] = [{ type: 'WALL', layer: l, width, offsetX: 0 }];
    
    if (hasSpark) {
      spawns.push({ type: 'SPARK', layer: l === 'A' ? 'B' : 'A', width: 20, offsetX: width / 2 - 10 });
    }
    
    return {
      spawns,
      totalWidth: width + 250 // safe breathing gap
    };
  }

  private generateSandwich(speed: number, diff: number): PatternResult {
    const l1 = this.randomLayer();
    const l2 = l1 === 'A' ? 'B' : 'A';
    const wallWidth = 40;
    
    // Middle gap must be generous enough for human reaction (readability + decision)
    // 0.35s base reaction time + safe margin.
    const minGap = speed * 0.35; 
    const maxGap = speed * Math.max(0.4, (0.8 - diff * 0.1));
    const gapSize = minGap + Math.random() * (maxGap - minGap);
    
    return {
      spawns: [
        { type: 'WALL', layer: l1, width: wallWidth, offsetX: 0 },
        { type: 'WALL', layer: l2, width: wallWidth, offsetX: wallWidth + gapSize },
        { type: 'WALL', layer: l1, width: wallWidth, offsetX: (wallWidth + gapSize) * 2 }
      ],
      totalWidth: (wallWidth + gapSize) * 2 + wallWidth + 300
    };
  }

  private generateReward(speed: number, diff: number): PatternResult {
    const l = this.randomLayer();
    const wallWidth = 80;
    const gap = speed * 0.35; // time to switch back
    
    return {
      spawns: [
        // Forces player to the opposite layer
        { type: 'WALL', layer: l, width: wallWidth, offsetX: 0 },
        // A spark perfectly hidden behind it in the SAME layer, requiring a quick switch back to get it (high risk, high reward)
        { type: 'SPARK', layer: l, width: 20, offsetX: wallWidth + gap },
        // A final wall to enforce the path
        { type: 'WALL', layer: l === 'A' ? 'B' : 'A', width: wallWidth, offsetX: wallWidth + gap * 2 }
      ],
      totalWidth: wallWidth * 2 + gap * 2 + 300
    };
  }

  private generateAdvanced(speed: number, diff: number): PatternResult {
    // Chained decisions, tight timing
    const l1 = this.randomLayer();
    const l2 = l1 === 'A' ? 'B' : 'A';
    const gap = speed * Math.max(0.25, 0.4 - diff * 0.05); // tighter gap for advanced players
    const wallWidth = 50;
    
    return {
      spawns: [
        { type: 'WALL', layer: l1, width: wallWidth, offsetX: 0 },
        { type: 'SPARK', layer: l2, width: 20, offsetX: wallWidth + gap / 2 - 10 }, // Guide player with spark
        { type: 'WALL', layer: l2, width: wallWidth, offsetX: wallWidth + gap },
        { type: 'SPARK', layer: l1, width: 20, offsetX: wallWidth * 2 + gap * 1.5 - 10 },
        { type: 'WALL', layer: l1, width: wallWidth, offsetX: wallWidth * 2 + gap * 2 }
      ],
      totalWidth: wallWidth * 3 + gap * 2 + 350
    };
  }

  private generateTrap(speed: number, diff: number): PatternResult {
    // Phase lock followed immediately by a wall
    const l = this.randomLayer();
    const zoneLength = 400 + Math.random() * 200 * diff;
    
    return {
      spawns: [
        { type: 'PHASE_LOCK', layer: 'BOTH', width: zoneLength, offsetX: 0 },
        // Wall inside the lock, player must be in correct phase before entering
        { type: 'WALL', layer: l, width: 40, offsetX: zoneLength * 0.4 }, 
        // Another wall
        { type: 'WALL', layer: l === 'A' ? 'B' : 'A', width: 40, offsetX: zoneLength * 0.8 }, 
      ],
      totalWidth: zoneLength + 200
    };
  }
}
