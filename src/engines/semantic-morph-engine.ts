import type { SemanticMorphKey } from './adaptive-reading-engine';

export class SemanticMorphEngine {
  /**
   * Renders a clean Circle morphing smoothly (p in [0..1]) into a vector SVG illustration
   * of what the word/letter means (house, book, ice cream, nose, forest, cat, sun, fish, rabbit, plane, dog, etc.)
   */
  static renderMorph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    progress: number,
    semanticKey: SemanticMorphKey,
    labelText: string,
  ): void {
    const p = Math.max(0, Math.min(1, progress));
    // Smooth elastic pop scale during morph
    const popScale = 1 + 0.24 * Math.sin(p * Math.PI);
    const rad = Math.max(18, r * popScale);

    ctx.save();
    ctx.translate(x, y);

    // 1. Morphing outer circle halo (fades gently into a glowing reward badge)
    ctx.fillStyle = `rgba(16, 185, 129, ${(0.28 * (1 - p * 0.4)).toFixed(2)})`;
    ctx.strokeStyle = p < 0.85 ? '#34d399' : '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, rad * (1.12 - 0.1 * p), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. Vector Semantic Illustration (scales & draws in as circle morphs)
    ctx.save();
    const iconScale = (0.35 + 0.65 * Math.sin(p * Math.PI * 0.5)) * (rad / 38);
    ctx.scale(iconScale, iconScale);
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (semanticKey) {
      case 'HOUSE': // ui (huis)
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#f59e0b';
        ctx.fillRect(-20, -4, 40, 28);
        ctx.strokeRect(-20, -4, 40, 28);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(-26, -4);
        ctx.lineTo(0, -28);
        ctx.lineTo(26, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-6, 8, 12, 16);
        break;

      case 'TREEHOUSE': // boom-hut
      case 'FOREST': // bos
        ctx.fillStyle = '#92400e';
        ctx.fillRect(-6, 6, 12, 20);
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(0, -8, 22, 0, Math.PI * 2);
        ctx.arc(-14, 0, 15, 0, Math.PI * 2);
        ctx.arc(14, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'CAT': // kat
        ctx.fillStyle = '#fb923c';
        ctx.strokeStyle = '#fff7ed';
        ctx.beginPath();
        ctx.moveTo(-18, -6);
        ctx.lineTo(-22, -26);
        ctx.lineTo(-6, -16);
        ctx.moveTo(18, -6);
        ctx.lineTo(22, -26);
        ctx.lineTo(6, -16);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Eyes & whiskers
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(-7, -3, 3, 0, Math.PI * 2);
        ctx.arc(7, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-26, 2);
        ctx.lineTo(-10, 4);
        ctx.moveTo(26, 2);
        ctx.lineTo(10, 4);
        ctx.stroke();
        break;

      case 'SUN': // zon / O
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#fde047';
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + p * 0.8;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
          ctx.lineTo(Math.cos(a) * 29, Math.sin(a) * 29);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'FISH': // vis
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.quadraticCurveTo(0, -18, -16, 0);
        ctx.quadraticCurveTo(0, 18, 16, 0);
        ctx.moveTo(-14, 0);
        ctx.lineTo(-27, -12);
        ctx.lineTo(-27, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(8, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'RABBIT': // ko-nijn
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#f472b6';
        ctx.beginPath();
        ctx.ellipse(-7, -20, 5, 14, -0.1, 0, Math.PI * 2);
        ctx.ellipse(7, -20, 5, 14, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 2, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(0, 4, 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'PLANE': // vlieg-tuig
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(24, 0);
        ctx.lineTo(-20, -18);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-20, 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'ICECREAM': // ij (ijs) / smelt
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(12, 0);
        ctx.lineTo(0, 26);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(0, -6, 14, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'BOOK': // oe (boek)
        ctx.fillStyle = '#60a5fa';
        ctx.strokeStyle = '#eff6ff';
        ctx.fillRect(-22, -14, 21, 28);
        ctx.fillRect(1, -14, 21, 28);
        ctx.strokeRect(-22, -14, 21, 28);
        ctx.strokeRect(1, -14, 21, 28);
        break;

      case 'BALL': // rond / b / d / p / q
      default:
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#fef08a';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const aOuter = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const aInner = aOuter + Math.PI / 5;
          if (i === 0) ctx.moveTo(Math.cos(aOuter) * 24, Math.sin(aOuter) * 24);
          else ctx.lineTo(Math.cos(aOuter) * 24, Math.sin(aOuter) * 24);
          ctx.lineTo(Math.cos(aInner) * 10, Math.sin(aInner) * 10);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }
    ctx.restore();

    // 3. Semantic Word Caption below the morphed SVG
    ctx.fillStyle = '#ecfdf5';
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, 0, rad + 14);
    ctx.restore();
  }
}
