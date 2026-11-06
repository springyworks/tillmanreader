import type { DrawerState, ReadingTarget, Rect, SafeArena } from '../types/arena';
import { byId, get2d, maybeById } from '../util/dom';
import type { LabApp } from './lab-app';

export interface GoalCenterDock {
  readonly x: number;
  readonly y: number;
  readonly cardRect: Rect;
}

/** Narrows a plain number (from a data attribute or arithmetic) to a valid drawer position. */
export function toDrawerState(n: number): DrawerState {
  return n <= 0 ? 0 : n >= 2 ? 2 : 1;
}

/** Canvas sizing, drawer layout, the on-screen safe action field and scoop-visor placement. */
export class LayoutController {
  private readonly app: LabApp;
  /** Cached for 250ms so the 60Hz loop never makes Android re-run layout. */
  private safeCache: SafeArena | null = null;
  private lastSafeCacheMs = 0;
  private resizeTimer: number | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private readonly bufferSizes = new WeakMap<HTMLCanvasElement, { w: number; h: number }>();

  constructor(app: LabApp) {
    this.app = app;
  }

  /** Drops the cached safe-area geometry so the next read re-measures the DOM. */
  invalidateSafeCache() {
    this.safeCache = null;
  }

  /** Debounced ResizeObserver with a dimension-delta guard so Android Chrome never enters a resize loop. */
  observeResize(container: HTMLElement) {
    if (!window.ResizeObserver) return;
    let lastObsW = 0;
    let lastObsH = 0;
    this.resizeObserver = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) {
        if (Math.abs(cr.width - lastObsW) < 3 && Math.abs(cr.height - lastObsH) < 3) {
          return;
        }
        lastObsW = cr.width;
        lastObsH = cr.height;
      }
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        this.safeCache = null;
        this.setupCanvases();
        this.app.guiEngine.scanDOMElements();
        this.clampActiveTargetsToSafeView();
      }, 80);
    });
    this.resizeObserver.observe(container);
  }

  setupCanvases() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ow = Math.floor(window.innerWidth * dpr);
    const oh = Math.floor(window.innerHeight * dpr);
    const overlay = this.app.overlayCanvas;
    const overlayLast = this.bufferSizes.get(overlay) ?? { w: 0, h: 0 };
    if (Math.abs(overlayLast.w - ow) >= 2 || Math.abs(overlayLast.h - oh) >= 2) {
      this.bufferSizes.set(overlay, { w: ow, h: oh });
      overlay.width = ow;
      overlay.height = oh;
      this.app.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const fit = (c: HTMLCanvasElement) => {
      if (!c.parentElement) return;
      const r = c.parentElement.getBoundingClientRect();
      const w = Math.max(240, r.width);
      const h = Math.max(100, r.height);
      const targetW = Math.floor(w * dpr);
      const targetH = Math.floor(h * dpr);
      // Guard: only mutate canvas buffer when dimensions actually change by >= 2px (prevents Android ResizeObserver loop!)
      const last = this.bufferSizes.get(c) ?? { w: 0, h: 0 };
      if (Math.abs(last.w - targetW) < 2 && Math.abs(last.h - targetH) < 2) {
        return;
      }
      this.bufferSizes.set(c, { w: targetW, h: targetH });
      c.width = targetW;
      c.height = targetH;
      get2d(c).setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit(this.app.canvas);
    if (this.app.drawerState >= 1) {
      fit(this.app.s1Canvas);
      fit(this.app.s2Canvas);
      fit(this.app.s3Canvas);
    }
    this.safeCache = null;
  }

  setDrawerState(state: DrawerState) {
    this.app.drawerState = state;
    const drawer = byId('telemetryDrawer');
    drawer.dataset.state = String(state);
    document.querySelectorAll<HTMLElement>('.dstate-btn').forEach((b) => {
      const active = parseInt(b.dataset.dstate ?? '', 10) === state;
      b.className = active ? 'dstate-btn ergo-sub-btn active' : 'dstate-btn ergo-sub-btn';
    });
    setTimeout(() => {
      this.safeCache = null;
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
  getSafeArenaCenter(forceRefresh = false): SafeArena {
    const now = performance.now();
    if (!forceRefresh && this.safeCache && now - this.lastSafeCacheMs < 250) {
      return this.safeCache;
    }
    this.lastSafeCacheMs = now;

    const arenaRect = this.app.canvas.getBoundingClientRect();
    const drawer = maybeById('telemetryDrawer');
    const drawerRect = drawer ? drawer.getBoundingClientRect() : { top: window.innerHeight };

    const vw = Math.max(260, window.innerWidth || document.documentElement.clientWidth || 360);
    const vh = Math.max(260, window.innerHeight || document.documentElement.clientHeight || 640);
    const w = Math.max(240, Math.min(vw, this.app.canvas.clientWidth || arenaRect.width || vw));

    // Strictly intersect with physical screen bottom & top of pull-up drawer
    const visibleBottomY = Math.min(vh, arenaRect.bottom, drawerRect.top);
    const h = Math.max(150, visibleBottomY - Math.max(0, arenaRect.top));

    const isMobile = vw < 640 || vh < 500;
    const pad = isMobile ? 10 : 20;
    const topGoalBannerH = isMobile ? 36 : 44;

    const safeLeft = pad;
    const safeTop = pad + topGoalBannerH;
    const safeRight = Math.max(safeLeft + 100, w - pad);
    const safeBottom = Math.max(safeTop + 90, h - pad);
    const safeW = safeRight - safeLeft;
    const safeH = safeBottom - safeTop;
    const diag = Math.hypot(safeW, safeH);

    this.app.telemetry.viewDiagPx = Math.round(diag);

    const arena: SafeArena = {
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
      cy: Math.round(safeTop + safeH * 0.46),
      topSafeY: safeTop,
    };
    this.safeCache = arena;
    return arena;
  }

  /**
   * Computes the Top Goal Center Launch Box near `safeTop` (the fading prompt card from which
   * the Scoop-Visor starts each trial so the learner drags smoothly outward without jumping).
   */
  getGoalCenterDock(arena = this.getSafeArenaCenter()): GoalCenterDock {
    const { cx, safeTop, safeW, safeH, isMobile } = arena;
    const audioOffset = this.app.voiceEngine.enabled ? 0 : 28;
    const compactVertical = safeH < 300;
    const scale = compactVertical
      ? Math.min(1.0, this.app.reading.uiFontScale)
      : this.app.reading.uiFontScale;

    if (this.app.level === 7) {
      const baseH = safeH < 260 ? 44 : isMobile ? 56 : 68;
      const cardH = Math.round(baseH * scale);
      const cardW = Math.min(safeW - 16, Math.round((isMobile ? 196 : 244) * scale));
      const cardX = Math.round(cx - cardW / 2);
      const cardY = Math.round(safeTop + 4 + audioOffset);
      return {
        x: cx,
        y: Math.round(cardY + cardH * 0.52),
        cardRect: { x: cardX, y: cardY, w: cardW, h: cardH },
      };
    }

    // Compact Goal Launch Dock near top for L1B / L2 spatial trials
    const cardW = Math.min(safeW - 20, isMobile ? 156 : 184);
    const cardH = compactVertical ? 32 : 38;
    const cardX = Math.round(cx - cardW / 2);
    const cardY = Math.round(safeTop + 4 + audioOffset);
    return {
      x: cx,
      y: Math.round(cardY + cardH * 0.5),
      cardRect: { x: cardX, y: cardY, w: cardW, h: cardH },
    };
  }

  /** True if a candidate circle `(x, y, r)` overlaps the Top Goal Center card or docked Scoop-Visor. */
  overlapsGoalDock(x: number, y: number, r: number, arena = this.getSafeArenaCenter()): boolean {
    const dock = this.getGoalCenterDock(arena);
    const cr = dock.cardRect;
    const pad = r + 10;
    if (x >= cr.x - pad && x <= cr.x + cr.w + pad && y >= cr.y - pad && y <= cr.y + cr.h + pad) {
      return true;
    }
    if (this.app.scoopVisor.enabled && !(this.app.level === 1 && this.app.l1Mode === 'zero')) {
      const sv = this.app.scoopVisor;
      const dockHandleY = dock.y + sv.offsetY;
      if (Math.hypot(x - dock.x, y - dockHandleY) < r + sv.handleR + 10) {
        return true;
      }
    }
    return false;
  }

  /**
   * Per-frame hard boundary clamp: guarantees NO target, spiral point, or reading bubble
   * can EVER exist outside the visible screen or overlap the Goal Center on any phone or split-window.
   */
  enforceOnScreenGuard() {
    const arena = this.getSafeArenaCenter();
    const { cx, cy, safeLeft, safeTop, safeRight, safeBottom, safeW, safeH, isMobile } = arena;
    const maxR = Math.max(14, Math.min(safeW, safeH) * 0.22);
    const compact = isMobile || safeH < 340;

    // Adapt FFP vertical offset so both the upper Visor and lower Thumb Handle stay 100% reachable
    this.app.scoopVisor.offsetY = compact
      ? Math.round(Math.min(76, Math.max(46, safeH * 0.19)))
      : 84;
    this.app.scoopVisor.handleR = safeH < 280 ? 24 : isMobile ? 28 : 26;
    this.app.scoopVisor.visorR = safeH < 280 ? 24 : isMobile ? 28 : 30;

    // Decay gentle grab-nudge ring animation
    if (this.app.scoopVisor.nudgePulse > 0) {
      this.app.scoopVisor.nudgePulse = Math.max(0, this.app.scoopVisor.nudgePulse - 0.035);
    }

    // Reserve bottom space for the lower thumb handle when Scoop-Visor is active on spatial targets
    const ffpBottomReserve =
      this.app.scoopVisor.enabled && !(this.app.level === 1 && this.app.l1Mode === 'zero')
        ? this.app.scoopVisor.offsetY + this.app.scoopVisor.handleR + 6
        : 0;
    const effectiveTargetBottom = Math.max(safeTop + 70, safeBottom - ffpBottomReserve);
    const dock = this.getGoalCenterDock(arena);

    if (this.app.target) {
      this.app.target.r = Math.max(14, Math.min(this.app.target.r, maxR));
      if (this.app.level === 1 && this.app.l1Mode === 'zero') {
        this.app.target.x = cx;
        this.app.target.y = cy;
      } else if (this.app.level === 1 || this.app.level === 2) {
        const m = this.app.target.r + 6;
        this.app.target.x = Math.max(safeLeft + m, Math.min(safeRight - m, this.app.target.x));
        this.app.target.y = Math.max(
          safeTop + m,
          Math.min(effectiveTargetBottom - m, this.app.target.y),
        );
        if (this.overlapsGoalDock(this.app.target.x, this.app.target.y, this.app.target.r, arena)) {
          const clearBelowY =
            dock.cardRect.y + dock.cardRect.h + this.app.scoopVisor.offsetY + this.app.target.r + 8;
          if (effectiveTargetBottom - m >= clearBelowY) {
            this.app.target.y = clearBelowY;
          } else {
            this.app.target.x =
              this.app.target.x < cx
                ? Math.max(safeLeft + m, dock.cardRect.x - this.app.target.r - 14)
                : Math.min(
                    safeRight - m,
                    dock.cardRect.x + dock.cardRect.w + this.app.target.r + 14,
                  );
          }
        }
      }
    }

    if (this.app.level === 7 && this.app.readingTargets.length > 0) {
      const cr = dock.cardRect;
      const belowDockTop = cr.y + cr.h + 10;
      const bubbleMaxR = Math.max(
        16,
        Math.min(safeW * 0.14, Math.max(22, (effectiveTargetBottom - safeTop) * 0.16)),
      );
      for (const rt of this.app.readingTargets) {
        rt.r = Math.max(16, Math.min(rt.r, bubbleMaxR));
        const m = rt.r + 6;
        rt.x = Math.max(safeLeft + m, Math.min(safeRight - m, rt.x));
        rt.y = Math.max(safeTop + m, Math.min(effectiveTargetBottom - m, rt.y));

        // Prevent overlap with the Top Goal Center card
        const inCardX = rt.x >= cr.x - rt.r - 6 && rt.x <= cr.x + cr.w + rt.r + 6;
        const inCardY = rt.y <= belowDockTop + rt.r;
        if (inCardX && inCardY) {
          if (effectiveTargetBottom - belowDockTop >= rt.r * 2 + 16) {
            rt.y = Math.min(effectiveTargetBottom - m, Math.max(rt.y, belowDockTop + rt.r + 4));
          } else {
            // Landscape / short viewport: push cleanly to left or right wing outside Goal Center
            rt.x =
              rt.x < cx
                ? Math.max(safeLeft + m, cr.x - rt.r - 10)
                : Math.min(safeRight - m, cr.x + cr.w + rt.r + 10);
          }
        }
      }
    }

    // Keep Scoop-Visor & Handle inside screen bounds when idle (allowing top Goal Center dock!)
    if (!this.app.scoopVisor.isDragging) {
      this.app.scoopVisor.visorX = Math.max(
        safeLeft + 24,
        Math.min(safeRight - 24, this.app.scoopVisor.visorX),
      );
      this.app.scoopVisor.visorY = Math.max(
        18,
        Math.min(safeBottom - this.app.scoopVisor.offsetY - 12, this.app.scoopVisor.visorY),
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
    const { cx, cy, safeW, safeH } = this.getSafeArenaCenter(true);
    this.enforceOnScreenGuard();
    if (this.app.level === 3) {
      this.app.spawner.buildSpiral(cx, cy, Math.min(safeW, safeH) * 0.4);
    }
  }

  /**
   * Parks the Scoop-Visor Rig at the Top Goal Center Launch Box (or Spiral START on L3)
   * when a new trial spawns so every drag begins smoothly from the Goal Center near the top!
   */
  resetScoopVisorPosition() {
    const arena = this.getSafeArenaCenter();
    if (!this.app.scoopVisor.isDragging) {
      if (this.app.level === 3 && this.app.spiral.path.length > 0) {
        const startPt = this.app.spiral.path[0];
        this.app.scoopVisor.visorX = startPt.x;
        this.app.scoopVisor.visorY = Math.min(
          arena.safeBottom - this.app.scoopVisor.offsetY - 14,
          startPt.y,
        );
      } else {
        const dock = this.getGoalCenterDock(arena);
        this.app.scoopVisor.visorX = dock.x;
        this.app.scoopVisor.visorY = Math.min(
          arena.safeBottom - this.app.scoopVisor.offsetY - 14,
          dock.y,
        );
      }
      this.app.scoopVisor.handleX = this.app.scoopVisor.visorX;
      this.app.scoopVisor.handleY = this.app.scoopVisor.visorY + this.app.scoopVisor.offsetY;
      this.app.scoopVisor.grabOffsetX = 0;
      this.app.scoopVisor.grabOffsetY = 0;
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
      let best: ReadingTarget | null = null;
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
