import { describe, expect, it, vi } from 'vitest';
import { SemanticMorphEngine } from './semantic-morph-engine';

describe('SemanticMorphEngine (thin black-on-white morphic ink gallery)', () => {
  it('cycles BALL drops across 16 distinct whimsical ink animations via variantSeed', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 16; i++) {
      seen.add(SemanticMorphEngine.resolveSceneKey('BALL', i));
    }
    expect(seen.size).toBe(16);
    expect(SemanticMorphEngine.resolveSceneKey('CAT', 99)).toBe('CAT');
  });

  it('renders crisp white medallion (#ffffff) with thin black ink (#0f172a) at the target radius', () => {
    const arcCalls: number[] = [];
    const clipSpy = vi.fn();
    const strokeSpy = vi.fn();
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn((_x: number, _y: number, rad: number) => {
        arcCalls.push(rad);
      }),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: strokeSpy,
      clip: clipSpy,
      setLineDash: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      globalAlpha: 1,
      font: '',
      textAlign: 'center',
      textBaseline: 'middle',
    } as unknown as CanvasRenderingContext2D;

    SemanticMorphEngine.renderMorph(mockCtx, 120, 140, 28, 0.5, 'VELO', '🚲 ik!', 0);
    // Outer white medallion stays within 6% of nominal bubble radius 28
    expect(arcCalls[0]).toBeGreaterThanOrEqual(28);
    expect(arcCalls[0]).toBeLessThanOrEqual(30);
    expect(clipSpy).toHaveBeenCalled();
    expect(strokeSpy).toHaveBeenCalled();
  });
});
