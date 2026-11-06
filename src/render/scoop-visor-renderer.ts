// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import type { LabApp } from '../app/lab-app';

/** Draws the Anti-Fat-Finger offset scoop-visor drag-and-drop rig. */
export class ScoopVisorRenderer {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  /**
   * Renders the Anti-Fat-Finger (FFP) Offset Scoop-Visor Drag-and-Drop Rig
   */
  renderScoopVisorRig(ctx, now) {
    const sv = this.app.scoopVisor;
    const vr = sv.visorR;
    const locked = Boolean(sv.hoveredCandidate);

    ctx.save();

    // 0. Expanding Drop Ripples on pointerup
    for (let i = sv.dropRipples.length - 1; i >= 0; i--) {
      const rp = sv.dropRipples[i];
      ctx.strokeStyle = `rgba(16, 185, 129, ${rp.alpha.toFixed(2)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.stroke();
      rp.r += 2.2;
      rp.alpha -= 0.06;
      if (rp.alpha <= 0) sv.dropRipples.splice(i, 1);
    }

    // 1. Dual Carbon-Cyan Offset Struts connecting Lower Thumb Pad to Upper Optical Scoop Visor
    ctx.strokeStyle = locked ? 'rgba(16, 185, 129, 0.85)' : 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sv.handleX - 10, sv.handleY - sv.handleR * 0.7);
    ctx.lineTo(sv.visorX - 12, sv.visorY + vr * 0.7);
    ctx.moveTo(sv.handleX + 10, sv.handleY - sv.handleR * 0.7);
    ctx.lineTo(sv.visorX + 12, sv.visorY + vr * 0.7);
    ctx.stroke();

    // 2. UPPER TRANSPARENT OPTICAL SCOOP VISOR (Unobstructed view of target)
    ctx.fillStyle = locked ? 'rgba(16, 185, 129, 0.16)' : 'rgba(56, 189, 248, 0.08)';
    ctx.strokeStyle = locked ? '#10b981' : '#38bdf8';
    ctx.lineWidth = locked ? 3.2 : 2.2;
    ctx.beginPath();
    ctx.arc(sv.visorX, sv.visorY, vr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Precision Crosshairs inside Upper Scoop Visor
    ctx.strokeStyle = locked ? 'rgba(16, 185, 129, 0.8)' : 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sv.visorX - vr - 5, sv.visorY);
    ctx.lineTo(sv.visorX - vr * 0.35, sv.visorY);
    ctx.moveTo(sv.visorX + vr * 0.35, sv.visorY);
    ctx.lineTo(sv.visorX + vr + 5, sv.visorY);
    ctx.moveTo(sv.visorX, sv.visorY - vr - 5);
    ctx.lineTo(sv.visorX, sv.visorY - vr * 0.35);
    ctx.moveTo(sv.visorX, sv.visorY + vr * 0.35);
    ctx.lineTo(sv.visorX, sv.visorY + vr + 5);
    ctx.stroke();

    if (
      this.app.level === 7 &&
      this.app.activeReadingItem &&
      this.app.goalMemory.revealAlpha > 0.15
    ) {
      ctx.save();
      ctx.globalAlpha = this.app.goalMemory.revealAlpha;
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.app.activeReadingItem.target, sv.visorX, sv.visorY - vr - 13);
      ctx.restore();
    } else if (locked) {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LIFT TO DROP!', sv.visorX, sv.visorY - vr - 10);
    }

    // 3. LOWER TACTILE THUMB / FINGER HANDLE PAD (Where the fat finger rests)
    const hr = sv.handleR;
    ctx.fillStyle = sv.isDragging ? 'rgba(14, 165, 233, 0.92)' : 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = locked ? '#10b981' : '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sv.handleX, sv.handleY, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tactile grip ridges on the lower thumb pad
    ctx.fillStyle = sv.isDragging ? '#020617' : '#e2e8f0';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sv.isDragging ? 'DRAGGING' : 'HOLD & DRAG', sv.handleX, sv.handleY - 4);
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText(locked ? '⬆ RELEASE!' : '🔭 SCOOP PAD', sv.handleX, sv.handleY + 7);

    ctx.restore();
  }
}
