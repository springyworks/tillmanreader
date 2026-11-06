import type { LabApp } from '../app/lab-app';
import { isPointingTarget } from '../app/targets';
import { SemanticMorphEngine } from '../engines/semantic-morph-engine';
import type { Rect, SafeArena } from '../types/arena';
import { drawRoundRect } from './draw-utils';

const MONO = 'ui-monospace, monospace';

/** Draws the main arena canvas: grid, goal banner, targets, spiral, reading items, morphs, ribbon and trail. */
export class ArenaRenderer {
  private readonly app: LabApp;
  lastBannerRect: Rect | null = null;
  lastGoalCenterRect: Rect | null = null;

  constructor(app: LabApp) {
    this.app = app;
  }

  renderArena(now: number): void {
    const ctx = this.app.ctx;
    const arena = this.app.layout.getSafeArenaCenter();
    ctx.clearRect(0, 0, arena.w, arena.h);

    this.lastGoalCenterRect = null;
    this.drawGrid(ctx, arena);
    this.drawSafeFrame(ctx, arena);
    const elapsedTrial = this.updateGoalReveal(now);
    const banner = this.drawGoalBanner(ctx, arena, elapsedTrial);
    this.lastBannerRect = banner;
    this.drawAudioPrompt(ctx, arena, banner);
    this.drawSpatialGoalDock(ctx, arena);
    this.drawPointingTarget(ctx, now);
    this.drawSpiralTunnel(ctx);
    this.drawReadingArena(ctx, arena);
    this.drawMorphs(ctx, now);
    this.drawGestureRibbon(ctx);
    this.drawTrail(ctx, now);
    this.drawVisor(ctx);
    if (this.app.guiEngine.xrayEnabled) {
      this.drawCanvasXrayTags(ctx);
    }
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
      return '🎯 DOEL: Sleep vanaf bovenaan naar de cirkel & laat los!';
    }
    if (level === 2) {
      const rem = this.app.tutor.baselineHitsRemaining;
      if (rem > 0) {
        const total = Math.max(1, this.app.tutor.baselineTotalQuota);
        const done = Math.max(0, total - rem);
        return `🎯 SCHERM-BASIS (${done + 1}/${total}): Sleep vanaf bovenaan naar het groene rondje!`;
      }
      return '🎯 DOEL: Sleep vanaf het doel-vak bovenaan naar het doelwit!';
    }
    if (level === 3) return '🎯 DOEL: Stuur door de spiraal-tunnel naar BOVENAAN!';
    if (level === 7 && activeReadingItem) {
      const remTargets = this.app.readingTargets.filter((b) => b.isTarget).length;
      if (remTargets >= 2) {
        return `🎯 DUBBEL DOEL (2x): Vang allebei de bolletjes met "${activeReadingItem.target}"!`;
      }
      if (this.app.tutor.activeVariation.politeFirstLetterScaffold) {
        const firstCh = activeReadingItem.target.replace('-', '').charAt(0);
        return `🔎 1e LETTER "${firstCh}": Kijk naar het gele streepje & zoek "${activeReadingItem.target}"!`;
      }
      return `🎯 ZOEK & SLEEP NAAR: "${activeReadingItem.target}" — ${activeReadingItem.cue}`;
    }
    return '🎯 DOEL: Tik zodra de cirkel GROEN wordt!';
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
    const bannerY = 6;
    const bannerH = topGoalBannerH - 4;
    const maxTxtW = Math.max(80, bannerW - 16);

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
      ctx.font = `bold ${isMobile ? 11.5 : 13.5}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.goalBannerText(), cx, bannerY + bannerH / 2, maxTxtW);
    } else {
      ctx.fillStyle = '#67e8f9';
      ctx.font = `bold ${isMobile ? 11 : 12}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        '👁️ BEWEEG OMHOOG (ZONDER KLIK) OM HET DOEL WEER TE ZIEN',
        cx,
        bannerY + bannerH / 2,
        maxTxtW,
      );
    }

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

  /** 4C. Compact Top Goal Center launch dock on L1B & L2 spatial pointing levels. */
  private drawSpatialGoalDock(ctx: CanvasRenderingContext2D, arena: SafeArena): void {
    const isSpatial =
      (this.app.level === 1 && this.app.l1Mode === 'shrink') || this.app.level === 2;
    if (!isSpatial || !this.app.scoopVisor.enabled) return;
    const dock = this.app.layout.getGoalCenterDock(arena);
    const cr = dock.cardRect;
    this.lastGoalCenterRect = cr;
    const gm = this.app.goalMemory;
    const rem = this.app.tutor.baselineHitsRemaining;
    const total = Math.max(1, this.app.tutor.baselineTotalQuota);
    const done = Math.max(0, total - rem);

    ctx.save();
    ctx.globalAlpha = Math.max(0.32, gm.revealAlpha);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    drawRoundRect(ctx, cr.x, cr.y, cr.w, cr.h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#bae6fd';
    ctx.font = `bold 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const txt =
      this.app.level === 2 && rem > 0 ? `🎯 START (${done + 1}/${total})` : '🎯 START DOEL';
    ctx.fillText(txt, dock.x, dock.y, cr.w - 12);
    ctx.restore();
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
    ctx.fillText('🔊 TIK HIER VOOR STEM & BACH-RHODES GELUID!', cx, pillY + pillH / 2);
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
      ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, Math.max(2.5, safeR * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#020617';
    ctx.font = `bold ${Math.round(13 * fontScale)}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.label, t.x, t.y - (t.subLabel ? 7 : 0), safeR * 1.75);
    if (t.subLabel) {
      ctx.font = `${Math.round(9.5 * fontScale)}px ${MONO}`;
      ctx.fillText(t.subLabel, t.x, t.y + 10, safeR * 1.75);
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

  /** Renders a word with a warm golden spotlight & underline bar beneath its 1st letter. */
  private drawWordWithFirstLetterSpotlight(
    ctx: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    centerY: number,
    fontPx: number,
    weight = 'bold',
  ): void {
    const first = text.charAt(0);
    const rest = text.slice(1);
    ctx.save();
    ctx.font = `${weight} ${fontPx}px ${MONO}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const wFirst = ctx.measureText(first).width;
    const wRest = ctx.measureText(rest).width;
    const totalW = wFirst + wRest;
    const startX = centerX - totalW / 2;

    // Soft golden highlight pill + underline bar under character #1
    ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
    drawRoundRect(ctx, startX - 3, centerY - fontPx * 0.56, wFirst + 6, fontPx * 1.12, 5);
    ctx.fill();

    ctx.fillStyle = '#fde047';
    ctx.fillRect(startX - 1, centerY + fontPx * 0.46, wFirst + 2, Math.max(2.5, fontPx * 0.11));
    ctx.fillText(first, startX, centerY);

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(rest, startX + wFirst, centerY);
    ctx.restore();
  }

  /** 7. Level 7 reading arena: Top Goal Center Launch Box, Dual-Target badge & First-Letter Spotlight. */
  private drawReadingArena(ctx: CanvasRenderingContext2D, arena: SafeArena): void {
    const item = this.app.activeReadingItem;
    if (this.app.level !== 7 || !item) return;
    const { cx, isMobile, safeH } = arena;
    const gm = this.app.goalMemory;
    const fontScale = this.app.reading.uiFontScale;
    const dock = this.app.layout.getGoalCenterDock(arena);
    const { x: cardX, y: cardY, w: cardW, h: cardH } = dock.cardRect;
    this.lastGoalCenterRect = dock.cardRect;
    const showFirstLetter =
      this.app.tutor.activeVariation.politeFirstLetterScaffold &&
      item.target.replace('-', '').trim().length >= 2;
    const remTargets = this.app.readingTargets.filter((b) => b.isTarget).length;

    if (gm.revealAlpha <= 0.12) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 1.5;
      drawRoundRect(ctx, cardX, cardY, cardW, cardH, 12);
      ctx.stroke();
      ctx.fillStyle = 'rgba(103, 232, 249, 0.68)';
      ctx.font = `bold 10px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👁️ DOEL (SPIEK HIER)', cx, cardY + cardH / 2, cardW - 12);
      ctx.restore();
    }

    if (gm.revealAlpha > 0.05) {
      ctx.save();
      ctx.globalAlpha = gm.revealAlpha;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
      ctx.strokeStyle = showFirstLetter ? '#fde047' : '#10b981';
      ctx.lineWidth = 2.4;
      drawRoundRect(ctx, cardX, cardY, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();

      const promptFontPx = Math.round(
        (safeH < 270 ? 22 : isMobile ? 28 : 38) * Math.min(1.25, fontScale),
      );
      if (showFirstLetter) {
        this.drawWordWithFirstLetterSpotlight(
          ctx,
          item.target,
          cx,
          cardY + cardH * 0.43,
          promptFontPx,
          '800',
        );
      } else {
        ctx.fillStyle = '#ecfdf5';
        ctx.font = `800 ${promptFontPx}px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.target, cx, cardY + cardH * 0.43, cardW - 14);
      }

      if (remTargets >= 2) {
        ctx.fillStyle = '#fbbf24';
        drawRoundRect(ctx, cardX + cardW - 44, cardY + 5, 38, 16, 6);
        ctx.fill();
        ctx.fillStyle = '#020617';
        ctx.font = `bold 10px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('2x!', cardX + cardW - 25, cardY + 13);
      }

      ctx.fillStyle = showFirstLetter ? '#fde047' : '#94a3b8';
      ctx.font = `${Math.max(10, Math.round((safeH < 270 ? 9.5 : 11) * Math.min(1.2, fontScale)))}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        showFirstLetter ? `🔎 1e letter: "${item.target.charAt(0)}"` : item.cue,
        cx,
        cardY + cardH * 0.83,
        cardW - 14,
      );
      ctx.restore();
    }

    for (const rt of this.app.readingTargets) {
      const hovered = this.app.scoopVisor.hoveredCandidate;
      const isLocked = hovered !== null && hovered.obj === rt;
      ctx.save();
      ctx.fillStyle = isLocked ? 'rgba(6, 78, 59, 0.95)' : 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = isLocked ? '#10b981' : showFirstLetter ? '#64748b' : '#475569';
      ctx.lineWidth = isLocked ? 3 : 2;
      ctx.beginPath();
      ctx.arc(rt.x, rt.y, Math.max(14, rt.r), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const bubbleFontPx = Math.round((safeH < 270 ? 15 : 18) * fontScale);
      if (showFirstLetter && rt.text.replace('-', '').trim().length >= 2) {
        this.drawWordWithFirstLetterSpotlight(ctx, rt.text, rt.x, rt.y, bubbleFontPx, 'bold');
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold ${bubbleFontPx}px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rt.text, rt.x, rt.y, rt.r * 1.85);
      }
      ctx.restore();
    }
  }

  /** 8. Celebratory thin black-on-white morphic cartoons; accumulates 60 Hz gaze dwell (M097). */
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
      SemanticMorphEngine.renderMorph(
        ctx,
        m.x,
        m.y,
        m.r,
        prog,
        m.semanticKey,
        m.label,
        m.variantSeed ?? 0,
      );

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

  /** 12. Visual X-Ray `GUI_ID` tags for Canvas sub-elements when X-Ray mode is toggled on. */
  private drawCanvasXrayTags(ctx: CanvasRenderingContext2D): void {
    const tag = (label: string, x: number, y: number) => {
      ctx.save();
      ctx.font = `bold 9px ${MONO}`;
      const w = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(88, 28, 135, 0.92)';
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 1;
      drawRoundRect(ctx, x - w / 2, y - 8, w, 15, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fae8ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y);
      ctx.restore();
    };

    if (this.lastBannerRect) {
      tag(
        'CANVAS_TOP_GOAL_BANNER',
        this.lastBannerRect.x + this.lastBannerRect.w / 2,
        this.lastBannerRect.y + 8,
      );
    }
    if (this.lastGoalCenterRect) {
      tag(
        'CANVAS_GOAL_CENTER_BOX',
        this.lastGoalCenterRect.x + this.lastGoalCenterRect.w / 2,
        this.lastGoalCenterRect.y - 6,
      );
    }
    const sv = this.app.scoopVisor;
    if (sv.enabled && !(this.app.level === 1 && this.app.l1Mode === 'zero')) {
      tag('CANVAS_SCOOP_VISOR', sv.visorX, sv.visorY - sv.visorR - 10);
      tag('CANVAS_SCOOP_THUMB_PAD', sv.handleX, sv.handleY + sv.handleR + 10);
    }
    if (this.app.level === 7) {
      for (const rt of this.app.readingTargets) {
        tag(
          rt.isTarget ? 'CANVAS_TARGET_BUBBLE' : 'CANVAS_DISTRACTOR_BUBBLE',
          rt.x,
          rt.y - rt.r - 9,
        );
      }
    }
  }
}
