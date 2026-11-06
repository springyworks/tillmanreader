import type { LabApp } from '../app/lab-app';
import { isPointingTarget } from '../app/targets';
import { SemanticMorphEngine } from '../engines/semantic-morph-engine';
import type { Rect, SafeArena } from '../types/arena';
import { drawRoundRect } from './draw-utils';

const MONO = 'ui-monospace, monospace';

/** Draws the main arena canvas: grid, goal banner, targets, spiral, reading items, morphs, ribbon and trail. */
export class ArenaRenderer {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  renderArena(now: number): void {
    const ctx = this.app.ctx;
    const arena = this.app.layout.getSafeArenaCenter();
    ctx.clearRect(0, 0, arena.w, arena.h);

    this.drawGrid(ctx, arena);
    this.drawSafeFrame(ctx, arena);
    const elapsedTrial = this.updateGoalReveal(now);
    const banner = this.drawGoalBanner(ctx, arena, elapsedTrial);
    this.drawAudioPrompt(ctx, arena, banner);
    this.drawPointingTarget(ctx, now);
    this.drawSpiralTunnel(ctx);
    this.drawReadingArena(ctx, arena);
    this.drawMorphs(ctx, now);
    this.drawGestureRibbon(ctx);
    this.drawTrail(ctx, now);
    this.drawVisor(ctx);
  }

  /** 1. Subtle coordinate grid. */
  private drawGrid(ctx: CanvasRenderingContext2D, { w, h }: SafeArena): void {
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.38)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  /** 2. Dashed safe action field boundary frame. */
  private drawSafeFrame(
    ctx: CanvasRenderingContext2D,
    { safeLeft, safeTop, safeW, safeH }: SafeArena,
  ): void {
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(safeLeft, safeTop, safeW, safeH);
    ctx.restore();
  }

  /**
   * 3. Top goal memory fade: a cosine breath fade once the initial show window has passed and the
   * goal is not being peeked at. Returns the elapsed trial time.
   */
  private updateGoalReveal(now: number): number {
    const gm = this.app.goalMemory;
    const elapsedTrial = Math.max(0, now - this.app.trialStartTime);
    if (!gm.isHoveringTopGoal) {
      if (elapsedTrial <= gm.initialShowMs) {
        gm.revealAlpha = 1.0;
      } else {
        const fadeProg = Math.min(
          1,
          (elapsedTrial - gm.initialShowMs) / Math.max(200, gm.fadeDurationMs),
        );
        gm.revealAlpha = Math.max(0.0, 0.5 * (1 + Math.cos(Math.PI * fadeProg)));
      }
    }
    this.app.telemetry.memoryDecayAlpha = gm.revealAlpha;
    return elapsedTrial;
  }

  private goalBannerText(): string {
    const { level, l1Mode, activeReadingItem } = this.app;
    if (level === 1 && l1Mode === 'shrink') {
      return '🎯 GOAL: Drag Scoop-Visor & Lift to Drop on Shrinking Circle!';
    }
    if (level === 2) return '🎯 GOAL: Drag Scoop-Visor to Target & Lift Finger to Drop!';
    if (level === 3) return "🎯 GOAL: Steer Through the Spiral Tunnel to the Top 12 o'clock GOAL!";
    if (level === 7 && activeReadingItem) {
      return `🎯 FIND & DROP ON: "${activeReadingItem.target}"  —  ${activeReadingItem.cue}`;
    }
    return '🎯 GOAL: Tap the Green Pulse Circle!';
  }

  /** 4. Always-anchored top goal / memory sensor strip. Returns its rectangle. */
  private drawGoalBanner(
    ctx: CanvasRenderingContext2D,
    { cx, isMobile, safeW, topGoalBannerH }: SafeArena,
    elapsedTrial: number,
  ): Rect {
    const gm = this.app.goalMemory;
    const bannerW = Math.min(safeW, isMobile ? safeW - 4 : 620);
    const bannerX = cx - bannerW / 2;
    const bannerY = 8;
    const bannerH = topGoalBannerH - 6;

    ctx.save();
    ctx.fillStyle = gm.isHoveringTopGoal
      ? 'rgba(6, 78, 59, 0.94)'
      : gm.revealAlpha > 0.25
        ? 'rgba(15, 23, 42, 0.92)'
        : 'rgba(15, 23, 42, 0.55)';
    ctx.strokeStyle = gm.isHoveringTopGoal
      ? '#10b981'
      : gm.revealAlpha > 0.25
        ? '#38bdf8'
        : '#475569';
    ctx.lineWidth = 1.5;
    drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 8);
    ctx.fill();
    ctx.stroke();

    if (gm.revealAlpha > 0.18) {
      ctx.globalAlpha = gm.revealAlpha;
      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold ${isMobile ? 12 : 14}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.goalBannerText(), cx, bannerY + bannerH / 2);
    } else {
      ctx.fillStyle = '#67e8f9';
      ctx.font = `bold ${isMobile ? 11 : 12}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        '👁️ HOVER / STEER SCOOP HERE (NO CLICK) TO RE-PEEK GOAL',
        cx,
        bannerY + bannerH / 2,
      );
    }

    // Live hold/fade countdown progress bar along the bottom edge of the banner
    if (gm.initialShowMs < 50000 && gm.revealAlpha > 0.02) {
      const totalWindow = gm.initialShowMs + gm.fadeDurationMs;
      const remRatio = Math.max(0, 1 - elapsedTrial / Math.max(1, totalWindow));
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = elapsedTrial < gm.initialShowMs ? '#38bdf8' : '#fbbf24';
      ctx.fillRect(bannerX + 4, bannerY + bannerH - 3, (bannerW - 8) * remRatio, 2.5);
    }
    ctx.restore();

    return { x: bannerX, y: bannerY, w: bannerW, h: bannerH };
  }

  /** 4B. Floating in-arena audio opt-in pill, shown only while audio is off so the voices are never missed. */
  private drawAudioPrompt(
    ctx: CanvasRenderingContext2D,
    { cx, isMobile, safeW }: SafeArena,
    banner: Rect,
  ): void {
    if (this.app.voiceEngine.enabled) {
      this.app.audioPromptRect = null;
      return;
    }
    const pillW = Math.min(safeW - 12, isMobile ? 280 : 340);
    const pillH = 26;
    const pillX = cx - pillW / 2;
    const pillY = banner.y + banner.h + 4;
    this.app.audioPromptRect = { x: pillX, y: pillY, w: pillW, h: pillH };

    ctx.save();
    ctx.fillStyle = 'rgba(136, 19, 55, 0.90)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    drawRoundRect(ctx, pillX, pillY, pillW, pillH, 13);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    ctx.font = `bold ${isMobile ? 10 : 11}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔊 TAP HERE FOR FUNNY VOICES ("kjiuueehh!" & jokes)', cx, pillY + pillH / 2);
    ctx.restore();
  }

  /** 5. Level 1 or 2 target, with its bullseye / rim-graze aim-strategy rings. */
  private drawPointingTarget(ctx: CanvasRenderingContext2D, now: number): void {
    const { level, l1Mode, goalMemory: gm, telemetry } = this.app;
    const t = this.app.target;
    if ((level !== 1 && level !== 2) || !isPointingTarget(t)) return;
    const fontScale = this.app.reading.uiFontScale;

    if (t.startX !== undefined && t.startY !== undefined) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.beginPath();
      ctx.moveTo(t.startX, t.startY);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.restore();
    }

    if (level === 1 && l1Mode === 'zero' && this.app.l1WaitState === 'WAITING') {
      const elapsed = now - this.app.l1WaitStartMs;
      const prog = Math.min(1, elapsed / Math.max(1, this.app.l1WaitAssignedMs));
      ctx.strokeStyle =
        t.fpDist === 'ISOCHRONOUS' ? 'rgba(56, 189, 248, 0.65)' : 'rgba(168, 85, 247, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const ringR =
        t.fpDist === 'ISOCHRONOUS'
          ? Math.max(8, t.r + 36 * (1 - prog))
          : Math.max(8, t.r + 18 + 8 * Math.sin(now / 140));
      ctx.arc(t.x, t.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    const safeR = Math.max(10, t.r);
    ctx.save();
    if (gm.cloakTargets && gm.revealAlpha < 0.35 && !(level === 1 && l1Mode === 'zero')) {
      ctx.globalAlpha = Math.max(0.18, gm.revealAlpha);
    }

    ctx.fillStyle = t.color;
    ctx.beginPath();
    if (level === 2 && this.app.l2Shape === 'square') {
      ctx.rect(t.x - safeR, t.y - safeR, safeR * 2, safeR * 2);
    } else {
      ctx.arc(t.x, t.y, safeR, 0, Math.PI * 2);
    }
    ctx.fill();

    // Aim-strategy rings: bullseye core below 30% R versus speed rim-graze at 70-100% R
    if (telemetry.aimStrategy === 'BULLSEYE') {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, safeR * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (telemetry.aimStrategy === 'RIM_GRAZE') {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, safeR * 0.85, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Subtle center dot so the user can tell the center from the periphery
      ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, Math.max(2.5, safeR * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#020617';
    ctx.font = `bold ${Math.round(13 * fontScale)}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.label, t.x, t.y - (t.subLabel ? 7 : 0));
    if (t.subLabel) {
      ctx.font = `${Math.round(10 * fontScale)}px ${MONO}`;
      ctx.fillText(t.subLabel, t.x, t.y + 10);
    }
    ctx.restore();
  }

  /** 6. Level 3 spiral tunnel with its START and GOAL discs. */
  private drawSpiralTunnel(ctx: CanvasRenderingContext2D): void {
    const spiral = this.app.spiral;
    const path = spiral.path;
    if (this.app.level !== 3 || path.length === 0) return;

    for (let i = 1; i < path.length; i++) {
      const p0 = path[i - 1];
      const p1 = path[i];
      ctx.strokeStyle =
        i <= spiral.progress ? 'rgba(16, 185, 129, 0.42)' : 'rgba(30, 41, 59, 0.85)';
      ctx.lineWidth = p1.w * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    const s = path[0];
    const e = path[path.length - 1];
    ctx.fillStyle = spiral.active ? '#06b6d4' : '#10b981';
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(10, s.w), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#020617';
    ctx.font = `bold 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spiral.active ? 'GO' : 'START', s.x, s.y);

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(e.x, e.y, Math.max(10, e.w), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#020617';
    ctx.fillText('GOAL', e.x, e.y);
  }

  /** 7. Level 7 reading arena: the giant focal prompt card at the top and the target bubbles below. */
  private drawReadingArena(
    ctx: CanvasRenderingContext2D,
    { cx, isMobile, safeTop, safeW }: SafeArena,
  ): void {
    const item = this.app.activeReadingItem;
    if (this.app.level !== 7 || !item) return;
    const gm = this.app.goalMemory;
    const fontScale = this.app.reading.uiFontScale;

    const cardW = Math.min(safeW - 16, Math.round((isMobile ? 210 : 260) * fontScale));
    const cardH = Math.round((isMobile ? 64 : 78) * fontScale);
    const cardX = cx - cardW / 2;
    const cardY = safeTop + (this.app.audioPromptRect ? 28 : 4);

    if (gm.revealAlpha > 0.05) {
      ctx.save();
      ctx.globalAlpha = gm.revealAlpha;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      drawRoundRect(ctx, cardX, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ecfdf5';
      ctx.font = `800 ${Math.round((isMobile ? 34 : 44) * fontScale)}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.target, cx, cardY + cardH * 0.44);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `${Math.round(11 * fontScale)}px ${MONO}`;
      ctx.fillText(item.cue, cx, cardY + cardH * 0.84);
      ctx.restore();
    }

    for (const rt of this.app.readingTargets) {
      const hovered = this.app.scoopVisor.hoveredCandidate;
      const isLocked = hovered !== null && hovered.obj === rt;
      ctx.save();
      ctx.fillStyle = isLocked ? 'rgba(6, 78, 59, 0.95)' : 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = isLocked ? '#10b981' : '#475569';
      ctx.lineWidth = isLocked ? 3 : 2;
      ctx.beginPath();
      ctx.arc(rt.x, rt.y, Math.max(14, rt.r), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold ${Math.round(18 * fontScale)}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rt.text, rt.x, rt.y);
      ctx.restore();
    }
  }

  /** 8. Celebratory circle-to-SVG morphs; also accumulates the 60 Hz gaze dwell near each (M097). */
  private drawMorphs(ctx: CanvasRenderingContext2D, now: number): void {
    const morphs = this.app.activeMorphs;
    for (let i = morphs.length - 1; i >= 0; i--) {
      const m = morphs[i];
      const elapsed = now - m.startTime;
      if (elapsed > m.durationMs) {
        morphs.splice(i, 1);
        continue;
      }
      const prog = elapsed / m.durationMs;
      SemanticMorphEngine.renderMorph(ctx, m.x, m.y, m.r, prog, m.semanticKey, m.label);

      const distToMorph = Math.hypot(this.app.cursor.x - m.x, this.app.cursor.y - m.y);
      if (distToMorph <= m.r * 1.75) {
        m.gazeDwellMs += 16.6;
        this.app.persistence.morphRewardDwellMs += 16.6;
      }
    }
  }

  /** 9. Active embodied gesture ribbon, fading out. */
  private drawGestureRibbon(ctx: CanvasRenderingContext2D): void {
    const gesture = this.app.gesture;
    if (gesture.activeRibbon.length <= 1) return;
    ctx.save();
    ctx.strokeStyle = gesture.ribbonColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < gesture.activeRibbon.length; i++) {
      const p = gesture.activeRibbon[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
      p.alpha -= 0.015;
    }
    ctx.stroke();
    ctx.restore();
    if (gesture.activeRibbon[0].alpha <= 0) gesture.activeRibbon = [];
  }

  /** 10. Kinematic cursor trail of the last 450 ms. */
  private drawTrail(ctx: CanvasRenderingContext2D, now: number): void {
    const trail = this.app.trail;
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const age = now - p1.t;
      if (age > 450) continue;
      ctx.strokeStyle = p1.speed > 950 ? 'rgba(16, 185, 129, 0.65)' : 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }

  /** 11. Anti-fat-finger offset Scoop-Visor rig on the spatial levels. */
  private drawVisor(ctx: CanvasRenderingContext2D): void {
    if (this.app.scoopVisor.enabled && !(this.app.level === 1 && this.app.l1Mode === 'zero')) {
      this.app.visorRenderer.renderScoopVisorRig(ctx);
    }
  }
}
