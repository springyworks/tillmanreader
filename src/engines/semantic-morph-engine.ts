import type { SemanticMorphKey } from './adaptive-reading-engine';

type Pt = readonly [x: number, y: number];

const SURPRISE_GALLERY: readonly Exclude<SemanticMorphKey, 'BALL'>[] = [
  'VELO',
  'CAT',
  'BOAT',
  'TRAIN',
  'OWL',
  'MILL',
  'RABBIT',
  'PLANE',
  'FISH',
  'SNAIL',
  'DOG',
  'ROCKET',
  'ICECREAM',
  'BOOK',
  'TREEHOUSE',
  'SUN',
];

function computeMorphAlpha(p: number): number {
  if (p < 0.24) {
    const u = p / 0.24;
    // Smooth cubic ease-out with gentle fountain-pen spring
    return 1 - Math.pow(1 - u, 3) + 0.05 * Math.sin(u * Math.PI);
  }
  if (p > 0.85) {
    const u = (p - 0.85) / 0.15;
    return Math.max(0, 1 - u * u);
  }
  return 1;
}

/**
 * Morphs a polyline continuously from a pure circle of radius `circleR` (`alpha = 0`)
 * into the target thin-ink line drawing `pts` (`alpha = 1`).
 */
function strokeMorphicInk(
  ctx: CanvasRenderingContext2D,
  pts: readonly Pt[],
  alpha: number,
  closed = false,
  circleR = 20,
  phaseOffset = 0,
): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const theta = phaseOffset + (i / (closed ? n : Math.max(1, n - 1))) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(theta) * circleR;
    const cy = Math.sin(theta) * circleR;
    const x = cx + (pts[i][0] - cx) * alpha;
    const y = cy + (pts[i][1] - cy) * alpha;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  if (closed) ctx.closePath();
  ctx.stroke();
}

function ringPoints(cx: number, cy: number, rx: number, ry: number, steps = 20, rot = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 + rot;
    const px = Math.cos(a) * rx;
    const py = Math.sin(a) * ry;
    out.push([cx + px, cy + py]);
  }
  return out;
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
  if (alpha < 0.35) return;
  ctx.beginPath();
  ctx.arc(x, y, r * alpha, 0, Math.PI * 2);
  ctx.fill();
}

function drawSparkStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
): void {
  if (alpha < 0.3) return;
  const s = size * alpha;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x + s, y);
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y + s);
  ctx.stroke();
}

/**
 * Whimsical Thin Black-on-White Fountain-Pen Morphic Line-Art Engine:
 * Keeps the exact bubble radius `r`, paints a crisp white paper medallion, and unspools a single
 * thin black ink circle (`#0f172a`) into 16+ living, animated pen-and-ink miniature cartoons!
 */
export class SemanticMorphEngine {
  static resolveSceneKey(
    semanticKey: SemanticMorphKey,
    variantSeed = 0,
  ): Exclude<SemanticMorphKey, 'BALL'> {
    if (semanticKey !== 'BALL') return semanticKey;
    const idx = Math.abs(Math.round(variantSeed)) % SURPRISE_GALLERY.length;
    return SURPRISE_GALLERY[idx];
  }

  static renderMorph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    progress: number,
    semanticKey: SemanticMorphKey,
    labelText: string,
    variantSeed = 0,
  ): void {
    const p = Math.max(0, Math.min(1, progress));
    // Keep the exact comfortable target size (only a gentle 6% breathing pulse!)
    const rad = Math.max(18, r * (1 + 0.06 * Math.sin(p * Math.PI)));
    const fadeTail = p > 0.9 ? Math.max(0, (1 - p) / 0.1) : 1;
    const morphAlpha = computeMorphAlpha(p);
    const t = p * Math.PI * 4; // 2 smooth animation cycles across the reward window
    const scene = SemanticMorphEngine.resolveSceneKey(semanticKey, variantSeed);

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = fadeTail;

    // 1. Crisp Paper-White Medallion (`#ffffff`) + Thin Fountain-Pen Rim (`#0f172a`)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Clip strictly inside the medallion so thin black ink lines never spill outside radius `rad`
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(4, rad - 1.6), 0, Math.PI * 2);
    ctx.clip();

    const unit = rad / 30;
    ctx.scale(unit, unit);
    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = '#0f172a';
    ctx.lineWidth = 1.55;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    SemanticMorphEngine.drawInkScene(ctx, scene, morphAlpha, t, p);
    ctx.restore();

    // 3. Clean caption pill right beneath the white medallion
    if (labelText) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 0, rad + 13);
    }
    ctx.restore();
  }

  private static drawInkScene(
    ctx: CanvasRenderingContext2D,
    scene: Exclude<SemanticMorphKey, 'BALL'>,
    a: number,
    t: number,
    p: number,
  ): void {
    switch (scene) {
      case 'CAT': {
        // Winking ink cat + curling sine tail + figure-8 fluttering butterfly!
        const earTwitch = Math.sin(t * 2) * 1.8;
        const head: Pt[] = [
          [-14, -4],
          [-17, -19 + earTwitch],
          [-6, -12],
          [6, -12],
          [17, -19 - earTwitch],
          [14, -4],
          [15, 7],
          [8, 15],
          [-8, 15],
          [-15, 7],
        ];
        strokeMorphicInk(ctx, head, a, true, 20);
        // Whiskers & smile
        const wag = Math.sin(t * 2.2) * 5;
        strokeMorphicInk(
          ctx,
          [
            [12, 13],
            [20, 10 + wag * 0.4],
            [22, 1 - wag * 0.5],
            [18, -5],
          ],
          a,
          false,
          16,
          1,
        );
        if (a > 0.45) {
          dot(ctx, -5.5, -1.5, 1.8, a);
          // Cheeky wink on right eye!
          if (Math.sin(t * 1.5) > 0.2) {
            ctx.beginPath();
            ctx.arc(5.5, -1, 2.4, Math.PI * 1.1, Math.PI * 1.9);
            ctx.stroke();
          } else {
            dot(ctx, 5.5, -1.5, 1.8, a);
          }
          // Nose + w-smile + whiskers
          strokeMorphicInk(
            ctx,
            [
              [-4, 5],
              [0, 3],
              [4, 5],
            ],
            1,
            false,
            4,
          );
          strokeMorphicInk(
            ctx,
            [
              [-22, 1],
              [-11, 2],
            ],
            1,
            false,
            8,
          );
          strokeMorphicInk(
            ctx,
            [
              [11, 2],
              [22, 1],
            ],
            1,
            false,
            8,
          );
          // Tiny orbiting butterfly
          const bx = Math.sin(t * 1.6) * 9;
          const by = -18 + Math.cos(t * 3.2) * 2.5;
          const wing = 2.6 + Math.abs(Math.sin(t * 5)) * 1.8;
          ctx.beginPath();
          ctx.ellipse(bx - 2, by, wing, 1.6, -0.4, 0, Math.PI * 2);
          ctx.ellipse(bx + 2, by, wing, 1.6, 0.4, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }

      case 'VELO': {
        // Pedaling stick-acrobat on bicycle with spinning spokes & fluttering scarf!
        const spin = t * 2.4;
        strokeMorphicInk(ctx, ringPoints(-12, 9, 7.5, 7.5, 16, spin), a, true, 19);
        strokeMorphicInk(ctx, ringPoints(12, 9, 7.5, 7.5, 16, spin), a, true, 19, 2);
        // Frame + handlebars + rider
        const frame: Pt[] = [
          [-12, 9],
          [-2, 9],
          [6, -2],
          [-6, -2],
          [-12, 9],
        ];
        strokeMorphicInk(ctx, frame, a, false, 15, 0.6);
        strokeMorphicInk(
          ctx,
          [
            [12, 9],
            [6, -6],
            [10, -8],
          ],
          a,
          false,
          14,
          1.5,
        );
        // Rider head + pedaling knee + waving scarf!
        strokeMorphicInk(ctx, ringPoints(0, -14, 3.6, 3.6, 12), a, true, 8);
        const pedalX = -2 + Math.cos(spin) * 3.5;
        const pedalY = 9 + Math.sin(spin) * 3.5;
        strokeMorphicInk(
          ctx,
          [
            [-1, -10],
            [-4, -2],
            [pedalX, pedalY],
          ],
          a,
          false,
          10,
        );
        strokeMorphicInk(
          ctx,
          [
            [-1, -9],
            [7, -6],
          ],
          a,
          false,
          9,
        );
        // Fluttering sinusoidal scarf
        const scarf: Pt[] = [];
        for (let i = 0; i < 7; i++) {
          scarf.push([-2 - i * 3.1, -12 + Math.sin(t * 3.5 - i * 0.9) * 2.4]);
        }
        strokeMorphicInk(ctx, scarf, a, false, 14, 3);
        break;
      }

      case 'BOAT': {
        // Origami paper boat rocking on 3 waves + leaping tiny fish!
        const rock = Math.sin(t * 1.8) * 0.12;
        ctx.save();
        ctx.rotate(rock);
        const hull: Pt[] = [
          [-17, 4],
          [17, 4],
          [11, 12],
          [-11, 12],
        ];
        strokeMorphicInk(ctx, hull, a, true, 20);
        const sail: Pt[] = [
          [0, 4],
          [0, -17],
          [12, 1],
          [0, 4],
          [-10, 1],
          [0, -14],
        ];
        strokeMorphicInk(ctx, sail, a, false, 18, 1);
        ctx.restore();
        // Rolling ink waves
        for (let w = 0; w < 2; w++) {
          const wave: Pt[] = [];
          const wy = 15 + w * 4.5;
          for (let i = -22; i <= 22; i += 4) {
            wave.push([i, wy + Math.sin(i * 0.35 + t * 2.5 + w) * 1.8]);
          }
          strokeMorphicInk(ctx, wave, a, false, 20, w);
        }
        // Tiny parabolic leaping fish arc!
        if (a > 0.5) {
          const u = (p * 1.6) % 1;
          const fx = -16 + u * 32;
          const fy = -6 - Math.sin(u * Math.PI) * 12;
          ctx.beginPath();
          ctx.ellipse(fx, fy, 3.2, 1.5, (u - 0.5) * 0.9, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }

      case 'TRAIN': {
        // Chugging steam locomotive + Fibonacci spiral smoke puffs!
        const body: Pt[] = [
          [-18, 8],
          [-18, -6],
          [-7, -6],
          [-7, 0],
          [11, 0],
          [11, -9],
          [15, -9],
          [15, 0],
          [18, 4],
          [18, 8],
        ];
        strokeMorphicInk(ctx, body, a, true, 20);
        const rot = t * 3;
        strokeMorphicInk(ctx, ringPoints(-11, 11, 4.5, 4.5, 12, rot), a, true, 14);
        strokeMorphicInk(ctx, ringPoints(0, 11, 4.5, 4.5, 12, rot), a, true, 14, 1);
        strokeMorphicInk(ctx, ringPoints(11, 11, 4.5, 4.5, 12, rot), a, true, 14, 2);
        // Connecting piston rod
        const px = Math.cos(rot) * 2.5;
        const py = Math.sin(rot) * 2.5;
        strokeMorphicInk(
          ctx,
          [
            [-11 + px, 11 + py],
            [11 + px, 11 + py],
          ],
          a,
          false,
          12,
        );
        // Rising spiral smoke curls
        for (let k = 0; k < 3; k++) {
          const drift = (p * 2 + k * 0.33) % 1;
          const sx = 13 - drift * 18;
          const sy = -12 - drift * 10;
          strokeMorphicInk(
            ctx,
            ringPoints(sx, sy, 2 + drift * 3.2, 2 + drift * 3.2, 10),
            a,
            true,
            9,
          );
        }
        break;
      }

      case 'OWL': {
        // Blinking owl perched on a twig with crescent moon!
        const body: Pt[] = [
          [-11, -12],
          [-14, -18],
          [-6, -14],
          [6, -14],
          [14, -18],
          [11, -12],
          [13, 2],
          [8, 14],
          [-8, 14],
          [-13, 2],
        ];
        strokeMorphicInk(ctx, body, a, true, 20);
        // Branch
        strokeMorphicInk(
          ctx,
          [
            [-22, 15],
            [22, 13],
          ],
          a,
          false,
          20,
          2,
        );
        // Big double-ring owl eyes (alternating blink)
        const blink = Math.sin(t * 2) > 0.78 ? 0.2 : 1;
        strokeMorphicInk(ctx, ringPoints(-5, -5, 4.4, 4.4 * blink, 14), a, true, 10);
        strokeMorphicInk(ctx, ringPoints(5, -5, 4.4, 4.4, 14), a, true, 10, 1);
        dot(ctx, -5, -5, 1.5 * blink, a);
        dot(ctx, 5, -5, 1.5, a);
        // Beak + scalloped belly feathers
        strokeMorphicInk(
          ctx,
          [
            [-2, -2],
            [0, 2],
            [2, -2],
          ],
          a,
          true,
          5,
        );
        const flap = Math.sin(t * 2.8) * 2.5;
        strokeMorphicInk(
          ctx,
          [
            [-12, -2],
            [-18 - flap, 5],
            [-11, 9],
          ],
          a,
          false,
          15,
        );
        strokeMorphicInk(
          ctx,
          [
            [12, -2],
            [18 + flap, 5],
            [11, 9],
          ],
          a,
          false,
          15,
          2,
        );
        break;
      }

      case 'RABBIT': {
        // Magician's top hat with two popping wiggling bunny ears & twinkling stars!
        const hat: Pt[] = [
          [-18, 6],
          [18, 6],
          [11, 6],
          [10, 18],
          [-10, 18],
          [-11, 6],
        ];
        strokeMorphicInk(ctx, hat, a, false, 20);
        const pop = Math.min(1, p * 2.4);
        const wig = Math.sin(t * 2.6) * 2.5;
        const leftEar: Pt[] = [
          [-4, 5],
          [-9 + wig, -18 * pop],
          [-3 + wig * 0.5, -19 * pop],
          [-1, 5],
        ];
        const rightEar: Pt[] = [
          [1, 5],
          [3 - wig * 0.5, -19 * pop],
          [9 - wig, -18 * pop],
          [4, 5],
        ];
        strokeMorphicInk(ctx, leftEar, a, false, 16, 1);
        strokeMorphicInk(ctx, rightEar, a, false, 16, 2);
        drawSparkStar(ctx, -16, -9, 3, a * Math.abs(Math.sin(t * 2)));
        drawSparkStar(ctx, 16, -6, 2.8, a * Math.abs(Math.cos(t * 2)));
        break;
      }

      case 'PLANE': {
        // Looping biplane with whirling nose propeller & dotted loop-the-loop trail!
        const angle = t * 0.85;
        const px = Math.cos(angle) * 7;
        const py = Math.sin(angle * 2) * 6 - 2;
        const loopPts: Pt[] = [];
        for (let i = 0; i <= 18; i++) {
          const u = (i / 18) * Math.PI * 2;
          loopPts.push([Math.cos(u) * 14, Math.sin(u * 2) * 9 + 4]);
        }
        ctx.save();
        ctx.setLineDash([2.2, 2.8]);
        strokeMorphicInk(ctx, loopPts, a, false, 20);
        ctx.restore();

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.sin(angle) * 0.22);
        const plane: Pt[] = [
          [-13, 0],
          [11, -2],
          [14, 0],
          [11, 3],
          [-12, 3],
          [-15, -5],
          [-10, 0],
        ];
        strokeMorphicInk(ctx, plane, a, true, 14);
        strokeMorphicInk(
          ctx,
          [
            [-4, -6],
            [7, -6],
            [5, 5],
            [-5, 5],
          ],
          a,
          true,
          10,
        );
        // Spinning nose propeller
        const propH = 5.5 * Math.sin(t * 7);
        strokeMorphicInk(
          ctx,
          [
            [15, -propH],
            [15, propH],
          ],
          a,
          false,
          6,
        );
        ctx.restore();
        break;
      }

      case 'TREEHOUSE':
      case 'FOREST': {
        // Branching treehouse with swinging pendulum tire-swing & little bird!
        const trunk: Pt[] = [
          [-6, 19],
          [-4, 3],
          [-14, -3],
          [-5, 0],
          [0, -8],
          [6, 0],
          [15, -3],
          [4, 3],
          [6, 19],
        ];
        strokeMorphicInk(ctx, trunk, a, false, 20);
        strokeMorphicInk(ctx, ringPoints(0, -9, 17, 10, 20), a, true, 21, 1);
        // Little house cabin nestled in branches
        strokeMorphicInk(
          ctx,
          [
            [-7, 2],
            [-7, -6],
            [0, -12],
            [7, -6],
            [7, 2],
          ],
          a,
          true,
          12,
        );
        // Swinging pendulum tire-swing on the right branch!
        const sw = Math.sin(t * 2.4) * 4.5;
        strokeMorphicInk(
          ctx,
          [
            [11, 0],
            [11 + sw, 11],
          ],
          a,
          false,
          12,
        );
        strokeMorphicInk(ctx, ringPoints(11 + sw, 13.5, 2.6, 2.6, 10), a, true, 6);
        break;
      }

      case 'FISH': {
        // Plump swimming ink fish blowing eighth-note bubbles!
        const swish = Math.sin(t * 3.2) * 3.5;
        const fish: Pt[] = [
          [14, 0],
          [5, -10],
          [-8, -8],
          [-15, 0],
          [-22, -8 + swish],
          [-19, 0],
          [-22, 8 + swish],
          [-15, 0],
          [-8, 8],
          [5, 10],
        ];
        strokeMorphicInk(ctx, fish, a, true, 20);
        dot(ctx, 7, -2.5, 1.7, a);
        strokeMorphicInk(
          ctx,
          [
            [2, -4],
            [0, 0],
            [2, 4],
          ],
          a,
          false,
          6,
        );
        // Rising bubbles -> tiny musical notes!
        for (let b = 0; b < 3; b++) {
          const lift = (p * 2.2 + b * 0.31) % 1;
          const bx = 17 + Math.sin(lift * 6 + b) * 2.5;
          const by = -2 - lift * 17;
          strokeMorphicInk(ctx, ringPoints(bx, by, 2, 1.6, 10), a, true, 5);
          if (a > 0.5 && b === 1) {
            strokeMorphicInk(
              ctx,
              [
                [bx + 1.8, by],
                [bx + 1.8, by - 5.5],
                [bx + 4.2, by - 4],
              ],
              1,
              false,
              4,
            );
          }
        }
        break;
      }

      case 'SUN': {
        // Rotating ink sun with alternating wavy rays & sliding cool sunglasses!
        strokeMorphicInk(ctx, ringPoints(0, 0, 11, 11, 20, t * 0.3), a, true, 16);
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + t * 0.45;
          const r1 = 13.5;
          const r2 = i % 2 === 0 ? 21 : 17.5;
          strokeMorphicInk(
            ctx,
            [
              [Math.cos(ang) * r1, Math.sin(ang) * r1],
              [Math.cos(ang) * r2, Math.sin(ang) * r2],
            ],
            a,
            false,
            20,
          );
        }
        if (a > 0.45) {
          // Cool little shades + grin!
          strokeMorphicInk(
            ctx,
            [
              [-7, -2],
              [-1, -2],
              [-2, 1.5],
              [-6, 1.5],
            ],
            1,
            true,
            5,
          );
          strokeMorphicInk(
            ctx,
            [
              [1, -2],
              [7, -2],
              [6, 1.5],
              [2, 1.5],
            ],
            1,
            true,
            5,
          );
          strokeMorphicInk(
            ctx,
            [
              [-1, -1.5],
              [1, -1.5],
            ],
            1,
            false,
            3,
          );
          ctx.beginPath();
          ctx.arc(0, 2.5, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        }
        break;
      }

      case 'DOG': {
        // Happy puppy with floppy bouncing ears, wagging tail & spinning bone!
        const bounce = Math.abs(Math.sin(t * 2.5)) * 2;
        const pup: Pt[] = [
          [-12, 12],
          [-12, -2 - bounce],
          [-18, 4],
          [-15, -10 - bounce],
          [-6, -12 - bounce],
          [4, -10 - bounce],
          [12, -5 - bounce],
          [12, 1 - bounce],
          [5, 3],
          [7, 12],
          [-12, 12],
        ];
        strokeMorphicInk(ctx, pup, a, false, 20);
        dot(ctx, 3, -6 - bounce, 1.6, a);
        dot(ctx, 11, -4 - bounce, 2, a);
        const wag = Math.sin(t * 6) * 5;
        strokeMorphicInk(
          ctx,
          [
            [-12, 6],
            [-20, -1 + wag],
          ],
          a,
          false,
          15,
        );
        // Little arc of sound waves ("woef!")
        if (a > 0.5) {
          ctx.beginPath();
          ctx.arc(16, -6 - bounce, 4 + (t % 3), -0.6, 0.6);
          ctx.stroke();
        }
        break;
      }

      case 'ICECREAM': {
        // Tap-dancing waffle cone twirling a tiny cocktail umbrella!
        const tilt = Math.sin(t * 2.5) * 0.1;
        ctx.save();
        ctx.rotate(tilt);
        strokeMorphicInk(
          ctx,
          [
            [-9, -1],
            [9, -1],
            [0, 17],
          ],
          a,
          true,
          18,
        );
        strokeMorphicInk(ctx, ringPoints(0, -6, 9.5, 8, 16), a, true, 16, 1);
        // Tiny umbrella on top
        strokeMorphicInk(
          ctx,
          [
            [2, -13],
            [6, -21],
          ],
          a,
          false,
          12,
        );
        strokeMorphicInk(
          ctx,
          [
            [0, -19],
            [6, -22],
            [11, -17],
          ],
          a,
          true,
          12,
        );
        ctx.restore();
        // Tap-dancing stick feet!
        const step = Math.sin(t * 4) * 3;
        strokeMorphicInk(
          ctx,
          [
            [-3, 15],
            [-6, 20 - Math.max(0, step)],
            [-9, 20 - Math.max(0, step)],
          ],
          a,
          false,
          14,
        );
        strokeMorphicInk(
          ctx,
          [
            [3, 15],
            [6, 20 - Math.max(0, -step)],
            [9, 20 - Math.max(0, -step)],
          ],
          a,
          false,
          14,
        );
        break;
      }

      case 'BOOK': {
        // Fluttering open storybook releasing flying ink birds & stars!
        const flap = Math.sin(t * 2.2) * 2.5;
        const leftPage: Pt[] = [
          [0, 12],
          [-18, 9 - flap],
          [-16, -8 - flap],
          [0, -5],
          [0, 12],
        ];
        const rightPage: Pt[] = [
          [0, 12],
          [18, 9 - flap],
          [16, -8 - flap],
          [0, -5],
          [0, 12],
        ];
        strokeMorphicInk(ctx, leftPage, a, false, 19);
        strokeMorphicInk(ctx, rightPage, a, false, 19, 2);
        // Tiny V-birds rising out of the open pages
        for (let b = 0; b < 2; b++) {
          const rise = (p * 1.8 + b * 0.45) % 1;
          const bx = (b === 0 ? -5 : 6) + Math.sin(rise * 5) * 3;
          const by = -6 - rise * 14;
          const w = 2 + Math.sin(t * 5 + b) * 1.2;
          strokeMorphicInk(
            ctx,
            [
              [bx - 3.5, by - w],
              [bx, by],
              [bx + 3.5, by - w],
            ],
            a,
            false,
            8,
          );
        }
        break;
      }

      case 'MILL': {
        // Classic spinning Dutch windmill + blooming ink tulip!
        const tower: Pt[] = [
          [-8, 17],
          [-5, -5],
          [5, -5],
          [8, 17],
        ];
        strokeMorphicInk(ctx, tower, a, true, 18);
        // 4 rotating windmill sails
        const spin = t * 1.1;
        for (let s = 0; s < 4; s++) {
          const ang = spin + (s * Math.PI) / 2;
          const ex = Math.cos(ang) * 19;
          const ey = -4 + Math.sin(ang) * 19;
          const px = -Math.sin(ang) * 3.2;
          const py = Math.cos(ang) * 3.2;
          strokeMorphicInk(
            ctx,
            [
              [0, -4],
              [ex, ey],
              [ex + px, ey + py],
              [Math.cos(ang) * 5 + px, -4 + Math.sin(ang) * 5 + py],
            ],
            a,
            true,
            19,
          );
        }
        // Little tulip on the right
        strokeMorphicInk(
          ctx,
          [
            [15, 17],
            [15, 9],
          ],
          a,
          false,
          14,
        );
        strokeMorphicInk(
          ctx,
          [
            [12, 9],
            [12, 5],
            [15, 7],
            [18, 5],
            [18, 9],
          ],
          a,
          true,
          14,
        );
        break;
      }

      case 'SNAIL': {
        // Rolling spiral-shell musical snail with bobbing antennae!
        const spiral: Pt[] = [];
        for (let i = 0; i <= 28; i++) {
          const ang = (i / 28) * Math.PI * 5 + t * 0.4;
          const radS = (i / 28) * 11.5;
          spiral.push([-3 + Math.cos(ang) * radS, -1 + Math.sin(ang) * radS]);
        }
        strokeMorphicInk(ctx, spiral, a, false, 18);
        // Foot & head + bobbing eye-stalks
        const bob = Math.sin(t * 3) * 1.8;
        strokeMorphicInk(
          ctx,
          [
            [-17, 11],
            [13, 11],
            [16, 4],
            [11, 3],
          ],
          a,
          false,
          19,
        );
        strokeMorphicInk(
          ctx,
          [
            [13, 4],
            [15, -5 + bob],
          ],
          a,
          false,
          12,
        );
        strokeMorphicInk(
          ctx,
          [
            [15, 5],
            [19, -3 - bob],
          ],
          a,
          false,
          12,
        );
        dot(ctx, 15, -6 + bob, 1.4, a);
        dot(ctx, 19, -4 - bob, 1.4, a);
        break;
      }

      case 'ROCKET': {
        // Sleek Tintin-style ink rocket banking past a ringed planet!
        ctx.save();
        ctx.rotate(-0.45 + Math.sin(t * 1.8) * 0.08);
        const hull: Pt[] = [
          [0, -18],
          [6, -6],
          [5, 8],
          [10, 14],
          [4, 11],
          [-4, 11],
          [-10, 14],
          [-5, 8],
          [-6, -6],
        ];
        strokeMorphicInk(ctx, hull, a, true, 19);
        strokeMorphicInk(ctx, ringPoints(0, -4, 2.8, 2.8, 12), a, true, 6);
        // Flickering zigzag exhaust flame
        const fl = 15 + Math.abs(Math.sin(t * 6)) * 5;
        strokeMorphicInk(
          ctx,
          [
            [-3, 12],
            [0, fl],
            [3, 12],
          ],
          a,
          false,
          12,
        );
        ctx.restore();
        // Tiny ringed Saturn in upper-left
        strokeMorphicInk(ctx, ringPoints(-14, -12, 3.2, 3.2, 12), a, true, 10);
        strokeMorphicInk(ctx, ringPoints(-14, -12, 7, 2, 14, -0.35), a, true, 10);
        break;
      }

      case 'HOUSE':
      default: {
        // Cozy cottage with curling chimney heart-smoke & opening door!
        const walls: Pt[] = [
          [-14, 15],
          [-14, -2],
          [-18, -2],
          [0, -17],
          [18, -2],
          [14, -2],
          [14, 15],
        ];
        strokeMorphicInk(ctx, walls, a, true, 20);
        strokeMorphicInk(
          ctx,
          [
            [-4, 15],
            [-4, 4],
            [4, 4],
            [4, 15],
          ],
          a,
          false,
          10,
        );
        // Puffing chimney smoke curl
        const puff: Pt[] = [];
        for (let i = 0; i < 8; i++) {
          puff.push([9 + Math.sin(t * 2.5 + i * 0.7) * 2.5, -10 - i * 1.9]);
        }
        strokeMorphicInk(ctx, puff, a, false, 14);
        break;
      }
    }
  }
}
