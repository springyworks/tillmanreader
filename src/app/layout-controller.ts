// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import type { LabApp } from './lab-app';

/** Canvas sizing, drawer layout, the on-screen safe action field and scoop-visor placement. */
export class LayoutController {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  setupCanvases() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ow = Math.floor(window.innerWidth * dpr);
    const oh = Math.floor(window.innerHeight * dpr);
    if (
      Math.abs((this.app.overlayCanvas._lastW || 0) - ow) >= 2 ||
      Math.abs((this.app.overlayCanvas._lastH || 0) - oh) >= 2
    ) {
      this.app.overlayCanvas._lastW = ow;
      this.app.overlayCanvas._lastH = oh;
      this.app.overlayCanvas.width = ow;
      this.app.overlayCanvas.height = oh;
      this.app.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const fit = (c) => {
      if (!c || !c.parentElement) return;
      const r = c.parentElement.getBoundingClientRect();
      const w = Math.max(240, r.width);
      const h = Math.max(100, r.height);
      const targetW = Math.floor(w * dpr);
      const targetH = Math.floor(h * dpr);
      // Guard: only mutate canvas buffer when dimensions actually change by >= 2px (prevents Android ResizeObserver loop!)
      if (Math.abs((c._lastW || 0) - targetW) < 2 && Math.abs((c._lastH || 0) - targetH) < 2) {
        return;
      }
      c._lastW = targetW;
      c._lastH = targetH;
      c.width = targetW;
      c.height = targetH;
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit(this.app.canvas);
    if (this.app.drawerState >= 1) {
      fit(this.app.s1Canvas);
      fit(this.app.s2Canvas);
      fit(this.app.s3Canvas);
    }
    this.app._cachedSafeCenter = null;
  }

  setDrawerState(state) {
    this.app.drawerState = state;
    const drawer = document.getElementById('telemetryDrawer');
    drawer.dataset.state = String(state);
    document.querySelectorAll('.dstate-btn').forEach((b) => {
      const active = parseInt(b.dataset.dstate, 10) === state;
      b.className = active ? 'dstate-btn ergo-sub-btn active' : 'dstate-btn ergo-sub-btn';
    });
    setTimeout(() => {
      this.app._cachedSafeCenter = null;
      this.setupCanvases();
      this.app.guiEngine.scanDOMElements();
      this.clampActiveTargetsToSafeView();
    }, 270);
  }

  /**
   * Computes the 100% Unobstructed Safe Action Field inside #gameArena,
   * automatically subtracting the current height of #telemetryDrawer and a 24px border frame.
   * Cached for 250ms so calling it inside the 60Hz loop never thrashes Android layout.
   */
  getSafeArenaCenter(forceRefresh = false) {
    const now = performance.now();
    if (!forceRefresh && this.app._cachedSafeCenter && now - this.app._lastSafeCacheMs < 250) {
      return this.app._cachedSafeCenter;
    }
    this.app._lastSafeCacheMs = now;

    const arenaRect = this.app.canvas.getBoundingClientRect();
    const drawer = document.getElementById('telemetryDrawer');
    const drawerRect = drawer ? drawer.getBoundingClientRect() : { top: window.innerHeight };

    const vw = Math.max(260, window.innerWidth || document.documentElement.clientWidth || 360);
    const vh = Math.max(260, window.innerHeight || document.documentElement.clientHeight || 640);
    const w = Math.max(240, Math.min(vw, this.app.canvas.clientWidth || arenaRect.width || vw));

    // Strictly intersect with physical screen bottom & top of pull-up drawer
    const visibleBottomY = Math.min(vh, arenaRect.bottom, drawerRect.top);
    const h = Math.max(150, visibleBottomY - Math.max(0, arenaRect.top));

    const isMobile = vw < 640;
    const pad = isMobile ? 12 : 20;
    const topGoalBannerH = isMobile ? 38 : 44;

    const safeLeft = pad;
    const safeTop = pad + topGoalBannerH;
    const safeRight = Math.max(safeLeft + 100, w - pad);
    const safeBottom = Math.max(safeTop + 90, h - pad);
    const safeW = safeRight - safeLeft;
    const safeH = safeBottom - safeTop;
    const diag = Math.hypot(safeW, safeH);

    this.app.telemetry.viewDiagPx = Math.round(diag);

    this.app._cachedSafeCenter = {
      w,
      h,
      isMobile,
      topGoalBannerH,
      safeLeft,
      safeTop,
      safeRight,
      safeBottom,
      safeW,
      safeH,
      diag,
      cx: Math.round(safeLeft + safeW / 2),
      cy: Math.round(safeTop + safeH * 0.42),
      topSafeY: safeTop,
    };
    return this.app._cachedSafeCenter;
  }

  /**
   * Per-frame hard boundary clamp: guarantees NO target, spiral point, or reading bubble
   * can EVER exist outside the visible screen on any phone, tablet, or split-window.
   */
  enforceOnScreenGuard() {
    const { cx, cy, safeLeft, safeTop, safeRight, safeBottom, safeW, safeH, isMobile } =
      this.getSafeArenaCenter();
    const maxR = Math.max(14, Math.min(safeW, safeH) * 0.24);

    // Adapt FFP vertical offset so both the upper Visor and lower Thumb Handle stay 100% reachable
    this.app.scoopVisor.offsetY = isMobile ? Math.min(82, Math.max(58, safeH * 0.18)) : 88;
    this.app.scoopVisor.handleR = isMobile ? 28 : 26;
    this.app.scoopVisor.visorR = isMobile ? 28 : 30;

    // Reserve bottom space for the lower thumb handle when Scoop-Visor is active on spatial targets
    const ffpBottomReserve =
      this.app.scoopVisor.enabled && !(this.app.level === 1 && this.app.l1Mode === 'zero')
        ? this.app.scoopVisor.offsetY + this.app.scoopVisor.handleR + 6
        : 0;
    const effectiveTargetBottom = Math.max(safeTop + 70, safeBottom - ffpBottomReserve);

    if (this.app.target) {
      this.app.target.r = Math.max(14, Math.min(this.app.target.r, maxR));
      if (this.app.level === 1 && this.app.l1Mode === 'zero') {
        this.app.target.x = cx;
        this.app.target.y = cy;
      } else {
        const m = this.app.target.r + 6;
        this.app.target.x = Math.max(safeLeft + m, Math.min(safeRight - m, this.app.target.x));
        this.app.target.y = Math.max(
          safeTop + m,
          Math.min(effectiveTargetBottom - m, this.app.target.y),
        );
      }
    }

    if (this.app.level === 7 && this.app.readingTargets.length > 0) {
      const promptReserveH = Math.min(
        safeH * 0.3,
        Math.round((isMobile ? 74 : 96) * this.app.reading.uiFontScale),
      );
      const minTargetY = safeTop + promptReserveH;
      const bubbleMaxR = Math.max(16, Math.min(safeW, effectiveTargetBottom - minTargetY) * 0.16);
      for (const rt of this.app.readingTargets) {
        rt.r = Math.max(16, Math.min(rt.r, bubbleMaxR));
        const m = rt.r + 6;
        rt.x = Math.max(safeLeft + m, Math.min(safeRight - m, rt.x));
        rt.y = Math.max(minTargetY + m, Math.min(effectiveTargetBottom - m, rt.y));
      }
    }

    // Keep Scoop-Visor & Handle inside screen bounds when idle
    if (!this.app.scoopVisor.isDragging) {
      this.app.scoopVisor.visorX = Math.max(
        safeLeft + 24,
        Math.min(safeRight - 24, this.app.scoopVisor.visorX),
      );
      this.app.scoopVisor.visorY = Math.max(
        safeTop + 24,
        Math.min(safeBottom - this.app.scoopVisor.offsetY - 20, this.app.scoopVisor.visorY),
      );
      this.app.scoopVisor.handleX = this.app.scoopVisor.visorX;
      this.app.scoopVisor.handleY = this.app.scoopVisor.visorY + this.app.scoopVisor.offsetY;
    }
  }

  /**
   * Guarantees that when the user resizes the window or pulls up the bottom telemetry drawer,
   * any active target, spiral, or reading bubbles are immediately clamped/rescaled into view.
   */
  clampActiveTargetsToSafeView() {
    const { cx, cy, safeW, safeH } = this.getSafeArenaCenter();
    this.enforceOnScreenGuard();
    if (this.app.level === 3) {
      this.app.spawner.buildSpiral(cx, cy, Math.min(safeW, safeH) * 0.4);
    }
  }

  /**
   * Resets or parks the Scoop-Visor Rig at a convenient starting dock below the top goal
   * (or at the user's current position) when a new trial spawns.
   */
  resetScoopVisorPosition() {
    const { cx, safeTop, safeBottom, safeH } = this.getSafeArenaCenter();
    if (!this.app.scoopVisor.isDragging) {
      // Park the visor in the lower-middle launch dock so the user drags up/across to the targets at the top
      const startVisorY = Math.min(
        safeBottom - this.app.scoopVisor.offsetY - 28,
        Math.round(safeTop + safeH * 0.56),
      );
      this.app.scoopVisor.visorX = cx;
      this.app.scoopVisor.visorY = Math.max(safeTop + 40, startVisorY);
      this.app.scoopVisor.handleX = this.app.scoopVisor.visorX;
      this.app.scoopVisor.handleY = this.app.scoopVisor.visorY + this.app.scoopVisor.offsetY;
    }
    this.app.scoopVisor.hoveredCandidate = null;
  }

  /**
   * Evaluates which target (L1B, L2, L3, or L7) is currently inside the upper Scoop Visor crosshairs
   */
  updateScoopVisorCandidate() {
    const sv = this.app.scoopVisor;
    sv.hoveredCandidate = null;
    if (!sv.enabled) return;

    if ((this.app.level === 1 || this.app.level === 2) && this.app.target) {
      const d = Math.hypot(sv.visorX - this.app.target.x, sv.visorY - this.app.target.y);
      if (d <= this.app.target.r + sv.visorR * 0.45) {
        sv.hoveredCandidate = { type: 'MAIN_TARGET', obj: this.app.target, dist: d };
      }
    } else if (this.app.level === 7 && this.app.readingTargets.length > 0) {
      let best = null;
      let bestDist = Infinity;
      for (const rt of this.app.readingTargets) {
        const d = Math.hypot(sv.visorX - rt.x, sv.visorY - rt.y);
        if (d <= rt.r + sv.visorR * 0.45 && d < bestDist) {
          bestDist = d;
          best = rt;
        }
      }
      if (best) {
        sv.hoveredCandidate = { type: 'READING_BUBBLE', obj: best, dist: bestDist };
      }
    }
  }
}
