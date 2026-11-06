// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import type { LabApp } from '../app/lab-app';
import { SemanticMorphEngine } from '../engines/semantic-morph-engine';
import { drawRoundRect } from './draw-utils';

/** Draws the main arena canvas: grid, goal banner, targets, spiral, reading items, morphs, ribbon and trail. */
export class ArenaRenderer {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  renderArena(now) {
    const ctx = this.app.ctx;
    const {
      w,
      h,
      cx,
      isMobile,
      topGoalBannerH,
      safeLeft,
      safeTop,
      safeRight,
      safeBottom,
      safeW,
      safeH,
    } = this.app.layout.getSafeArenaCenter();
    ctx.clearRect(0, 0, w, h);

    // 1. Subtle Coordinate Grid
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

    // 2. Dashed Safe Action Field Boundary Frame
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(safeLeft, safeTop, safeW, safeH);
    ctx.restore();

    // 3. Compute Top Goal Memory Fade Alpha (Cosine Breath Fade when unlocked & not hovered)
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

    // 4. Always-Anchored Top Goal / Memory Sensor Strip
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

    let goalBannerText = '🎯 GOAL: Tap the Green Pulse Circle!';
    if (this.app.level === 1 && this.app.l1Mode === 'shrink') {
      goalBannerText = '🎯 GOAL: Drag Scoop-Visor & Lift to Drop on Shrinking Circle!';
    } else if (this.app.level === 2) {
      goalBannerText = '🎯 GOAL: Drag Scoop-Visor to Target & Lift Finger to Drop!';
    } else if (this.app.level === 3) {
      goalBannerText = "🎯 GOAL: Steer Through the Spiral Tunnel to the Top 12 o'clock GOAL!";
    } else if (this.app.level === 7 && this.app.activeReadingItem) {
      goalBannerText = `🎯 FIND & DROP ON: "${this.app.activeReadingItem.target}"  —  ${this.app.activeReadingItem.cue}`;
    }

    if (gm.revealAlpha > 0.18) {
      ctx.globalAlpha = gm.revealAlpha;
      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold ${isMobile ? 12 : 14}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(goalBannerText, cx, bannerY + bannerH / 2);
    } else {
      ctx.fillStyle = '#67e8f9';
      ctx.font = `bold ${isMobile ? 11 : 12}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        '👁️ HOVER / STEER SCOOP HERE (NO CLICK) TO RE-PEEK GOAL',
        cx,
        bannerY + bannerH / 2,
      );
    }

    // Live Hold/Fade Countdown Progress Bar along bottom edge of Top Goal Banner
    if (gm.initialShowMs < 50000 && gm.revealAlpha > 0.02) {
      const totalWindow = gm.initialShowMs + gm.fadeDurationMs;
      const remRatio = Math.max(0, 1 - elapsedTrial / Math.max(1, totalWindow));
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = elapsedTrial < gm.initialShowMs ? '#38bdf8' : '#fbbf24';
      ctx.fillRect(bannerX + 4, bannerY + bannerH - 3, (bannerW - 8) * remRatio, 2.5);
    }
    ctx.restore();

    // 4B. Floating In-Arena Audio Opt-In Pill (only when Audio is OFF so user never misses "kjiuueehh!" voices)
    if (!this.app.voiceEngine.enabled) {
      const pillW = Math.min(safeW - 12, isMobile ? 280 : 340);
      const pillH = 26;
      const pillX = cx - pillW / 2;
      const pillY = bannerY + bannerH + 4;
      this.app.audioPromptRect = { x: pillX, y: pillY, w: pillW, h: pillH };

      ctx.save();
      ctx.fillStyle = 'rgba(136, 19, 55, 0.90)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      drawRoundRect(ctx, pillX, pillY, pillW, pillH, 13);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fef3c7';
      ctx.font = `bold ${isMobile ? 10 : 11}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔊 TAP HERE FOR FUNNY VOICES ("kjiuueehh!" & jokes)', cx, pillY + pillH / 2);
      ctx.restore();
    } else {
      this.app.audioPromptRect = null;
    }

    // 5. Render Level 1 or Level 2 Target (With Bullseye / Rim-Graze Affordance Rings)
    if ((this.app.level === 1 || this.app.level === 2) && this.app.target) {
      const t = this.app.target;
      if (t.startX !== undefined) {
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.beginPath();
        ctx.moveTo(t.startX, t.startY);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.restore();
      }

      if (
        this.app.level === 1 &&
        this.app.l1Mode === 'zero' &&
        this.app.l1WaitState === 'WAITING'
      ) {
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
      if (
        gm.cloakTargets &&
        gm.revealAlpha < 0.35 &&
        !(this.app.level === 1 && this.app.l1Mode === 'zero')
      ) {
        ctx.globalAlpha = Math.max(0.18, gm.revealAlpha);
      }

      ctx.fillStyle = t.color;
      ctx.beginPath();
      if (this.app.level === 2 && this.app.l2Shape === 'square') {
        ctx.rect(t.x - safeR, t.y - safeR, safeR * 2, safeR * 2);
      } else {
        ctx.arc(t.x, t.y, safeR, 0, Math.PI * 2);
      }
      ctx.fill();

      // Aim-Strategy Visual Rings (Bullseye Core <30% R vs Speed Rim-Graze 70-100% R)
      if (this.app.telemetry.aimStrategy === 'BULLSEYE') {
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, safeR * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (this.app.telemetry.aimStrategy === 'RIM_GRAZE') {
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(t.x, t.y, safeR * 0.85, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Subtle center bullseye dot so user can see center vs periphery
        ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
        ctx.beginPath();
        ctx.arc(t.x, t.y, Math.max(2.5, safeR * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#020617';
      ctx.font = `bold ${Math.round(13 * this.app.reading.uiFontScale)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.label || '', t.x, t.y - (t.subLabel ? 7 : 0));
      if (t.subLabel) {
        ctx.font = `${Math.round(10 * this.app.reading.uiFontScale)}px ui-monospace, monospace`;
        ctx.fillText(t.subLabel, t.x, t.y + 10);
      }
      ctx.restore();
    }

    // 6. Render Level 3 Spiral Tunnel
    if (this.app.level === 3 && this.app.spiral.path.length > 0) {
      const path = this.app.spiral.path;
      for (let i = 1; i < path.length; i++) {
        const p0 = path[i - 1],
          p1 = path[i];
        ctx.strokeStyle =
          i <= this.app.spiral.progress ? 'rgba(16, 185, 129, 0.42)' : 'rgba(30, 41, 59, 0.85)';
        ctx.lineWidth = p1.w * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      const s = path[0],
        e = path[path.length - 1];
      ctx.fillStyle = this.app.spiral.active ? '#06b6d4' : '#10b981';
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(10, s.w), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#020617';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.app.spiral.active ? 'GO' : 'START', s.x, s.y);

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(e.x, e.y, Math.max(10, e.w), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#020617';
      ctx.fillText('GOAL', e.x, e.y);
    }

    // 7. Render Level 7 Adaptive Reading Arena (Giant Single-Letter Focal Badge at Top + Target Bubbles Below)
    if (this.app.level === 7 && this.app.activeReadingItem) {
      const cardW = Math.min(
        safeW - 16,
        Math.round((isMobile ? 210 : 260) * this.app.reading.uiFontScale),
      );
      const cardH = Math.round((isMobile ? 64 : 78) * this.app.reading.uiFontScale);
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
        ctx.font = `800 ${Math.round((isMobile ? 34 : 44) * this.app.reading.uiFontScale)}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.app.activeReadingItem.target, cx, cardY + cardH * 0.44);

        ctx.fillStyle = '#94a3b8';
        ctx.font = `${Math.round(11 * this.app.reading.uiFontScale)}px ui-monospace, monospace`;
        ctx.fillText(this.app.activeReadingItem.cue, cx, cardY + cardH * 0.84);
        ctx.restore();
      }

      for (const rt of this.app.readingTargets) {
        const isLocked =
          this.app.scoopVisor.hoveredCandidate && this.app.scoopVisor.hoveredCandidate.obj === rt;
        ctx.save();
        ctx.fillStyle = isLocked ? 'rgba(6, 78, 59, 0.95)' : 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = isLocked ? '#10b981' : '#475569';
        ctx.lineWidth = isLocked ? 3 : 2;
        ctx.beginPath();
        ctx.arc(rt.x, rt.y, Math.max(14, rt.r), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold ${Math.round(18 * this.app.reading.uiFontScale)}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rt.text, rt.x, rt.y);
        ctx.restore();
      }
    }

    // 8. Render Celebratory Clean Circle -> Semantic SVG Morphs & Track 60Hz Gaze Dwell (M097)
    for (let i = this.app.activeMorphs.length - 1; i >= 0; i--) {
      const m = this.app.activeMorphs[i];
      const elapsed = now - m.startTime;
      if (elapsed > m.durationMs) {
        this.app.activeMorphs.splice(i, 1);
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

    // 9. Render Active Embodied Gesture Ribbon
    if (this.app.gesture.activeRibbon.length > 1) {
      ctx.save();
      ctx.strokeStyle = this.app.gesture.ribbonColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < this.app.gesture.activeRibbon.length; i++) {
        const p = this.app.gesture.activeRibbon[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        p.alpha -= 0.015;
      }
      ctx.stroke();
      ctx.restore();
      if (this.app.gesture.activeRibbon[0].alpha <= 0) this.app.gesture.activeRibbon = [];
    }

    // 10. Render Kinematic Cursor Trail
    for (let i = 1; i < this.app.trail.length; i++) {
      const p0 = this.app.trail[i - 1],
        p1 = this.app.trail[i];
      const age = now - p1.t;
      if (age > 450) continue;
      ctx.strokeStyle = p1.speed > 950 ? 'rgba(16, 185, 129, 0.65)' : 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // 11. Render Anti-Fat-Finger (FFP) Offset Scoop-Visor Rig on Spatial Levels
    if (this.app.scoopVisor.enabled && !(this.app.level === 1 && this.app.l1Mode === 'zero')) {
      this.app.visorRenderer.renderScoopVisorRig(ctx, now);
    }
  }
}
