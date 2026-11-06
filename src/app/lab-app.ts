// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import { GIT_CHECKPOINT_META } from './build-info';
import { VocalTractFormantEngine } from '../audio/vocal-tract-formant-engine';
import { RuntimeWatchdog } from '../diagnostics/runtime-watchdog';
import { AdaptiveReadingEngine } from '../engines/adaptive-reading-engine';
import { ForeperiodHazardEngine } from '../engines/foreperiod-hazard-engine';
import { GestureDecoder } from '../engines/gesture-decoder';
import { GuiAffordanceDoodleEngine } from '../engines/gui-affordance-doodle-engine';
import { LongitudinalPersistenceEngine } from '../engines/longitudinal-persistence-engine';
import { SemanticMorphEngine } from '../engines/semantic-morph-engine';
import { Signature100Engine } from '../engines/signature-100-engine';
import { TelemetryEngine } from '../engines/telemetry-engine';
import { SimpleZipPackager } from '../export/simple-zip-packager';
import { VSCodeProjectScaffold } from '../export/vscode-project-scaffold';
import { drawRoundRect } from '../render/draw-utils';
import { TimeStampUtil } from '../util/timestamp';

/*************************************************************************
 * 9. MAIN LAB CONTROLLER, VIEW-SIZE SAFE ACTION FIELD & GUI DOODLING LOOP
 *************************************************************************/
export class LabApp {
  constructor() {
    this.canvas = document.getElementById('gameArena');
    this.ctx = this.canvas.getContext('2d');
    this.overlayCanvas = document.getElementById('guiDoodleOverlay');
    this.overlayCtx = this.overlayCanvas.getContext('2d');
    this.s1Canvas = document.getElementById('canvasScope1');
    this.s1Ctx = this.s1Canvas.getContext('2d');
    this.s2Canvas = document.getElementById('canvasScope2');
    this.s2Ctx = this.s2Canvas.getContext('2d');
    this.s3Canvas = document.getElementById('canvasScope3');
    this.s3Ctx = this.s3Canvas.getContext('2d');

    this.telemetry = new TelemetryEngine();
    this.fpEngine = new ForeperiodHazardEngine();
    this.reading = new AdaptiveReadingEngine();
    this.reading.uiFontScale = 1.15;
    this.sig100 = new Signature100Engine();
    this.persistence = new LongitudinalPersistenceEngine();
    this.voiceEngine = new VocalTractFormantEngine(); // Strictly DEFAULT OFF until user taps Hero Audio Button!
    this.gesture = new GestureDecoder((type, info) => this.handleEmbodiedGesture(type, info));
    this.guiEngine = new GuiAffordanceDoodleEngine((type, gui, meta) =>
      this.handleGuiDoodle(type, gui, meta),
    );

    // Cached layout geometry so 60Hz rAF loop never triggers Android DOM reflow loops
    this._cachedSafeCenter = null;
    this._lastSafeCacheMs = 0;
    this._lastGuiScanMs = 0;
    this._resizeTimer = null;

    // Semantic Circle -> SVG Morphing State (Celebrates hits & measures whether it's rewarding or distracting!)
    this.semanticMorphEnabled = true;
    this.activeMorphs = []; // { x, y, r, startTime, durationMs, semanticKey, label, gazeDwellMs }

    /**
     * ANTI-FAT-FINGER (FFP) OFFSET SCOOP-VISOR DRAG & DROP RIG:
     * - Solves touchscreen hover blindness & Fat-Finger occlusion:
     * - The user touches/drags the lower Handle Pad (handleX, handleY).
     * - Connected by a rigid carbon-cyan strut above the finger is the transparent
     *   Optical Scoop Visor (visorX, visorY = handleY - offsetPx), carrying the goal payload!
     * - Lifting the finger (`pointerup`) drops the Scoop Visor onto the target under the crosshairs.
     */
    this.scoopVisor = {
      enabled: true, // Default ON so touch & mouse both generate continuous drag kinematics!
      isDragging: false,
      pointerId: null,
      offsetY: 86, // Vertical separation (px) between lower finger pad and upper optical scoop visor
      handleX: 450,
      handleY: 380,
      visorX: 450,
      visorY: 294,
      handleR: 28,
      visorR: 30,
      dragStartTime: 0,
      dragPathLen: 0,
      hoveredCandidate: null, // Target currently inside the upper Scoop Visor crosshairs
      dropRipples: [], // Visual feedback on lift-to-drop
    };

    this.levelSteps = [
      {
        step: 0,
        level: 1,
        l1Mode: 'zero',
        badge: 'Phase 1/5 • Pulse Tap (RT0 Grounding)',
        quota: 3,
      },
      {
        step: 1,
        level: 1,
        l1Mode: 'shrink',
        badge: 'Phase 2/5 • Shrinking Circle (We Grounding)',
        quota: 4,
      },
      {
        step: 2,
        level: 2,
        l1Mode: 'zero',
        badge: 'Phase 3/5 • Tillmann Target Shoot (Slope b)',
        quota: 5,
      },
      {
        step: 3,
        level: 3,
        l1Mode: 'zero',
        badge: 'Phase 4/5 • Spiral Tunnel Flight (Steering)',
        quota: 1,
      },
      {
        step: 4,
        level: 7,
        l1Mode: 'zero',
        badge: 'Tillmann Reader • Drag Scoop & Drop on Letter!',
        quota: 6,
      },
    ];
    // INSTANT PLAYABLE TILLMANN READER ON URL OPEN (Step 4 = Level 7 Reading):
    // Children never have to sit through calibration dots first—Tillmann motor grounding happens
    // automatically inside every letter-scoop trajectory!
    this.currentStepIdx = 4;
    this.level = 7;
    this.l1Mode = 'zero';
    this.l2Shape = 'circle';
    this.firstTouchUnlocked = false;
    this.voiceEngine.enabled = true; // Armed by default: unlocks WebAudio on very first touch in arena!

    // Smart Envelope-Flying Tutor State
    this.autoScenarioEnabled = true;
    this.phaseProgress = 0;
    this.groundingComplete = true;

    this.scope3Mode = 'BULLSEYE_MAP'; // 'BULLSEYE_MAP' | 'FITTS' | 'PUT_HAZARD'
    this.drawerState = 0; // Default hidden (State 0) so the play arena is 100% unobstructed on launch
    this.cursor = { x: 450, y: 260 };
    this.winCursor = { x: 450, y: 340 };
    this.trail = [];

    this.target = null;
    this.l1WaitState = 'IDLE';
    this.l1GreenTimestamp = 0;
    this.l1WaitStartMs = 0;
    this.l1WaitAssignedMs = 1100;
    this.l1WaitTimer = null;
    this.shrinkRadius = 78;

    this.trialStartTime = 0;
    this.trialStartPos = { x: 450, y: 260 };
    this.moveOnsetTime = 0;
    this.peakVelTime = 0;
    this.trialPeakSpeed = 0;
    this.decelOnsetTime = 0;
    this.dockEnterTime = 0;
    this.currentTrialDockMs = 0;
    this.currentTrialGesture = null;

    // Parameterized Top-Goal Hover-to-Reveal & Working-Memory State (Defaults to AUTO_PROG)
    this.goalMemory = {
      mode: 'AUTO_PROG', // 'ALWAYS' | 'PEEK_1200' | 'MEM_500' | 'AUTO_PROG'
      initialShowMs: 900,
      fadeDurationMs: 1100, // Responsive 1.1s cosine fade-away duration
      RequiredBaselineHits: 1, // Adult-adaptive: 1 fast hit unlocks goal-hiding immediately!
      cloakTargets: false,
      isHoveringTopGoal: false,
      hoverEnterTime: 0,
      trialPeekCount: 0,
      trialHoverMs: 0,
      autoStreak: 0,
      stageUnfadedStreak: 0,
      calmFadeUnlocked: false,
      revealAlpha: 1.0,
    };

    this.spiral = {
      active: false,
      progress: 0,
      startTime: 0,
      insideSamples: 0,
      totalSamples: 0,
      path: [],
    };
    this.readingTargets = [];
    this.activeReadingItem = null;

    this.setupCanvases();
    this.guiEngine.scanDOMElements();
    this.buildGuiRegistryDOM();
    this.build100MetricDOM();
    this.bindEvents();

    // Check Browser LocalStorage first so returning child/PUT picks up right where they left off!
    const restoredFromSave = this.persistence.loadFromBrowser(this);
    if (!restoredFromSave) {
      this.telemetry.loadPreset66(this.fpEngine, this.reading);
      // Start new learners at Stage 1 (or Stage 2/3 if adult) immediately in Level 7 Tillmann Reader!
      this.currentStepIdx = 4;
      this.level = 7;
      this.reading.stage = 1;
      this.persistence.saveToBrowser(this);
      this.persistence.commitCheckpoint(this);
    } else {
      // Even when restoring a session, if URL is opened directly by a child, jump straight into Tillmann Reader (Step 4) unless manually in another game
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mode') !== 'lab') {
        this.currentStepIdx = 4;
      }
      const cfg = this.levelSteps[this.currentStepIdx] || this.levelSteps[4];
      this.level = cfg.level;
      this.l1Mode = cfg.l1Mode;
    }

    // Guarantee state is auto-saved when switching tabs, locking iPad screen, or closing window
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.persistence.saveToBrowser(this);
      }
    });
    window.addEventListener('beforeunload', () => {
      this.persistence.saveToBrowser(this);
    });

    this.setDrawerState(0);
    this.syncStageUI();
    this.spawnForCurrentLevel();
    this.sig100.computeAll(
      this.telemetry,
      this.gesture,
      this.reading,
      this.drawerState,
      this.fpEngine,
      this.guiEngine,
    );
    this.update100MetricDOM();
    this.updateGuiRegistryDOM();

    // Debounced ResizeObserver with dimension-delta guard so Android Chrome never enters a resize loop
    if (window.ResizeObserver) {
      let lastObsW = 0,
        lastObsH = 0;
      this.resizeObs = new ResizeObserver((entries) => {
        const cr = entries[0] && entries[0].contentRect;
        if (cr) {
          if (Math.abs(cr.width - lastObsW) < 3 && Math.abs(cr.height - lastObsH) < 3) {
            return;
          }
          lastObsW = cr.width;
          lastObsH = cr.height;
        }
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => {
          this._cachedSafeCenter = null;
          this.setupCanvases();
          this.guiEngine.scanDOMElements();
          this.clampActiveTargetsToSafeView();
        }, 80);
      });
      this.resizeObs.observe(document.getElementById('arenaContainer'));
    }

    RuntimeWatchdog.runSelfTests(this);

    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Builds the Self-Referential GUI-Element ID Registry cards inside #guiElementsGrid
   */
  buildGuiRegistryDOM() {
    const grid = document.getElementById('guiElementsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const g of this.guiEngine.registry.values()) {
      const card = document.createElement('div');
      card.id = `guicard-${g.id}`;
      card.className =
        'bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col justify-between transition';
      card.innerHTML = `
            <div class="flex items-center justify-between text-xs mono">
              <span class="font-bold text-purple-300 truncate">${g.id}</span>
              <span id="guiid-di-${g.id}" class="text-cyan-300 font-bold">0.0b</span>
            </div>
            <div class="text-xs text-slate-300 truncate my-1" title="${g.label}">${g.label}</div>
            <div class="flex items-center justify-between text-xs mono text-slate-400">
              <span>Gaze:<b id="guiid-dwell-${g.id}" class="text-emerald-300">0ms</b></span>
              <span>Strug:<b id="guiid-strug-${g.id}" class="text-amber-300">1.0x</b></span>
              <span>⭕:<b id="guiid-dood-${g.id}" class="text-rose-300">0</b></span>
            </div>
          `;
      grid.appendChild(card);
    }
  }

  /**
   * Updates live Shannon ID, Eye-Proxy Gaze Dwell, Struggle Ratio & Doodles in #guiElementsGrid
   */
  updateGuiRegistryDOM() {
    const focusEl = document.getElementById('guiTableFocus');
    const doodleEl = document.getElementById('guiTableLastDoodle');
    if (focusEl) focusEl.textContent = this.guiEngine.activeFocusId;
    if (doodleEl) doodleEl.textContent = this.guiEngine.lastDoodleSummary;

    for (const g of this.guiEngine.registry.values()) {
      const diEl = document.getElementById(`guiid-di-${g.id}`);
      const dwEl = document.getElementById(`guiid-dwell-${g.id}`);
      const stEl = document.getElementById(`guiid-strug-${g.id}`);
      const doEl = document.getElementById(`guiid-dood-${g.id}`);
      if (diEl) diEl.textContent = `${g.liveID.toFixed(1)}b`;
      if (dwEl) dwEl.textContent = `${Math.round(g.dwellMs)}ms`;
      if (stEl) stEl.textContent = `${g.struggleRatio}x`;
      if (doEl) doEl.textContent = String(g.doodles);
    }
  }

  /**
   * Builds the 100 Deterministic Mathematical Metrics cards inside #metrics100Grid
   */
  build100MetricDOM() {
    const grid = document.getElementById('metrics100Grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const m of this.sig100.metrics) {
      const card = document.createElement('div');
      card.id = `mcard-${m.id}`;
      card.dataset.cat = m.cat;
      card.className =
        'bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col justify-between transition';
      card.innerHTML = `
            <div class="flex items-center justify-between text-xs mono text-slate-400">
              <span>M${String(m.id).padStart(3, '0')}</span>
              <span class="px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300 font-bold">${m.cat}</span>
            </div>
            <div class="text-xs font-semibold text-slate-200 truncate my-1" title="${m.name}">${m.name}</div>
            <div class="text-sm font-bold mono text-emerald-300">
              <span id="mval-${m.id}">${m.value}</span> <span class="text-xs font-normal text-slate-400">${m.unit}</span>
            </div>
          `;
      grid.appendChild(card);
    }
  }

  /**
   * Updates all 100 Metric card values in #metrics100Grid
   */
  update100MetricDOM() {
    for (const m of this.sig100.metrics) {
      const el = document.getElementById(`mval-${m.id}`);
      if (el) el.textContent = m.value;
    }
  }

  /**
   * Filters the 100-Metric Grid by Category (ALL, A, B, C, D, E, F)
   */
  filter100Category(cat) {
    this.sig100.activeCategory = cat;
    document.querySelectorAll('.cat-pill').forEach((b) => {
      b.classList.toggle('active', b.dataset.cat === cat);
    });
    for (const m of this.sig100.metrics) {
      const card = document.getElementById(`mcard-${m.id}`);
      if (card) {
        card.style.display = cat === 'ALL' || m.cat === cat ? 'flex' : 'none';
      }
    }
  }

  /**
   * Computes the 100% Unobstructed Safe Action Field inside #gameArena,
   * automatically subtracting the current height of #telemetryDrawer and a 24px border frame.
   * Cached for 250ms so calling it inside the 60Hz loop never thrashes Android layout.
   */
  getSafeArenaCenter(forceRefresh = false) {
    const now = performance.now();
    if (!forceRefresh && this._cachedSafeCenter && now - this._lastSafeCacheMs < 250) {
      return this._cachedSafeCenter;
    }
    this._lastSafeCacheMs = now;

    const arenaRect = this.canvas.getBoundingClientRect();
    const drawer = document.getElementById('telemetryDrawer');
    const drawerRect = drawer ? drawer.getBoundingClientRect() : { top: window.innerHeight };

    const vw = Math.max(260, window.innerWidth || document.documentElement.clientWidth || 360);
    const vh = Math.max(260, window.innerHeight || document.documentElement.clientHeight || 640);
    const w = Math.max(240, Math.min(vw, this.canvas.clientWidth || arenaRect.width || vw));

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

    this.telemetry.viewDiagPx = Math.round(diag);

    this._cachedSafeCenter = {
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
    return this._cachedSafeCenter;
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
    this.scoopVisor.offsetY = isMobile ? Math.min(82, Math.max(58, safeH * 0.18)) : 88;
    this.scoopVisor.handleR = isMobile ? 28 : 26;
    this.scoopVisor.visorR = isMobile ? 28 : 30;

    // Reserve bottom space for the lower thumb handle when Scoop-Visor is active on spatial targets
    const ffpBottomReserve =
      this.scoopVisor.enabled && !(this.level === 1 && this.l1Mode === 'zero')
        ? this.scoopVisor.offsetY + this.scoopVisor.handleR + 6
        : 0;
    const effectiveTargetBottom = Math.max(safeTop + 70, safeBottom - ffpBottomReserve);

    if (this.target) {
      this.target.r = Math.max(14, Math.min(this.target.r, maxR));
      if (this.level === 1 && this.l1Mode === 'zero') {
        this.target.x = cx;
        this.target.y = cy;
      } else {
        const m = this.target.r + 6;
        this.target.x = Math.max(safeLeft + m, Math.min(safeRight - m, this.target.x));
        this.target.y = Math.max(safeTop + m, Math.min(effectiveTargetBottom - m, this.target.y));
      }
    }

    if (this.level === 7 && this.readingTargets.length > 0) {
      const promptReserveH = Math.min(
        safeH * 0.3,
        Math.round((isMobile ? 74 : 96) * this.reading.uiFontScale),
      );
      const minTargetY = safeTop + promptReserveH;
      const bubbleMaxR = Math.max(16, Math.min(safeW, effectiveTargetBottom - minTargetY) * 0.16);
      for (const rt of this.readingTargets) {
        rt.r = Math.max(16, Math.min(rt.r, bubbleMaxR));
        const m = rt.r + 6;
        rt.x = Math.max(safeLeft + m, Math.min(safeRight - m, rt.x));
        rt.y = Math.max(minTargetY + m, Math.min(effectiveTargetBottom - m, rt.y));
      }
    }

    // Keep Scoop-Visor & Handle inside screen bounds when idle
    if (!this.scoopVisor.isDragging) {
      this.scoopVisor.visorX = Math.max(
        safeLeft + 24,
        Math.min(safeRight - 24, this.scoopVisor.visorX),
      );
      this.scoopVisor.visorY = Math.max(
        safeTop + 24,
        Math.min(safeBottom - this.scoopVisor.offsetY - 20, this.scoopVisor.visorY),
      );
      this.scoopVisor.handleX = this.scoopVisor.visorX;
      this.scoopVisor.handleY = this.scoopVisor.visorY + this.scoopVisor.offsetY;
    }
  }

  /**
   * Resets or parks the Scoop-Visor Rig at a convenient starting dock below the top goal
   * (or at the user's current position) when a new trial spawns.
   */
  resetScoopVisorPosition() {
    const { cx, safeTop, safeBottom, safeH } = this.getSafeArenaCenter();
    if (!this.scoopVisor.isDragging) {
      // Park the visor in the lower-middle launch dock so the user drags up/across to the targets at the top
      const startVisorY = Math.min(
        safeBottom - this.scoopVisor.offsetY - 28,
        Math.round(safeTop + safeH * 0.56),
      );
      this.scoopVisor.visorX = cx;
      this.scoopVisor.visorY = Math.max(safeTop + 40, startVisorY);
      this.scoopVisor.handleX = this.scoopVisor.visorX;
      this.scoopVisor.handleY = this.scoopVisor.visorY + this.scoopVisor.offsetY;
    }
    this.scoopVisor.hoveredCandidate = null;
  }

  /**
   * Evaluates which target (L1B, L2, L3, or L7) is currently inside the upper Scoop Visor crosshairs
   */
  updateScoopVisorCandidate() {
    const sv = this.scoopVisor;
    sv.hoveredCandidate = null;
    if (!sv.enabled) return;

    if ((this.level === 1 || this.level === 2) && this.target) {
      const d = Math.hypot(sv.visorX - this.target.x, sv.visorY - this.target.y);
      if (d <= this.target.r + sv.visorR * 0.45) {
        sv.hoveredCandidate = { type: 'MAIN_TARGET', obj: this.target, dist: d };
      }
    } else if (this.level === 7 && this.readingTargets.length > 0) {
      let best = null;
      let bestDist = Infinity;
      for (const rt of this.readingTargets) {
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

  /**
   * Guarantees that when the user resizes the window or pulls up the bottom telemetry drawer,
   * any active target, spiral, or reading bubbles are immediately clamped/rescaled into view.
   */
  clampActiveTargetsToSafeView() {
    const { cx, cy, safeW, safeH } = this.getSafeArenaCenter();
    this.enforceOnScreenGuard();
    if (this.level === 3) {
      this.buildSpiral(cx, cy, Math.min(safeW, safeH) * 0.4);
    }
  }

  setDrawerState(state) {
    this.drawerState = state;
    const drawer = document.getElementById('telemetryDrawer');
    drawer.dataset.state = String(state);
    document.querySelectorAll('.dstate-btn').forEach((b) => {
      const active = parseInt(b.dataset.dstate, 10) === state;
      b.className = active ? 'dstate-btn ergo-sub-btn active' : 'dstate-btn ergo-sub-btn';
    });
    setTimeout(() => {
      this._cachedSafeCenter = null;
      this.setupCanvases();
      this.guiEngine.scanDOMElements();
      this.clampActiveTargetsToSafeView();
    }, 270);
  }

  /**
   * Smart Envelope-Flying Tutor:
   * Counts successful trials in the current Tillmann grounding phase and automatically advances
   * from Pulse Tap (1A) -> Shrinking Circle (1B) -> Tillmann Pointing (L2) -> Spiral Flight (L3) -> Adaptive Reading (L7).
   * Once in Reading or when doing well, Auto-Fade memory progressively engages!
   */
  advanceEnvelopeTutor() {
    this.phaseProgress++;
    const cfg = this.levelSteps[this.currentStepIdx];
    const quota = cfg ? cfg.quota : 4;

    if (this.autoScenarioEnabled && this.phaseProgress >= quota) {
      if (this.currentStepIdx < 4) {
        this.phaseProgress = 0;
        this.currentStepIdx++;
        if (this.currentStepIdx === 4) {
          this.groundingComplete = true;
          this.showToast(
            '🎓 GROUNDING COMPLETE → READING FLIGHT!',
            `Calibrated RT0=${Math.round(this.telemetry.rt0BaselineMs)}ms & We=${Math.round(this.telemetry.effectiveWidthRatio * 100)}%W. Auto-Fade Memory active!`,
            'border-emerald-400',
          );
        } else {
          const nextCfg = this.levelSteps[this.currentStepIdx];
          this.showToast(
            `✈️ ENVELOPE NEXT: ${nextCfg.badge.split('•')[1].trim()}`,
            'Smart Tutor advancing your Tillmann grounding scenario...',
            'border-cyan-400',
          );
        }
        this.applyStepIndex(this.currentStepIdx, true);
        return true;
      } else {
        // In Phase 5 (Reading): keep flying within the ZPD & memory envelope!
        this.phaseProgress = 0;
      }
    }
    this.syncStageUI();
    return false;
  }

  setupCanvases() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ow = Math.floor(window.innerWidth * dpr);
    const oh = Math.floor(window.innerHeight * dpr);
    if (
      Math.abs((this.overlayCanvas._lastW || 0) - ow) >= 2 ||
      Math.abs((this.overlayCanvas._lastH || 0) - oh) >= 2
    ) {
      this.overlayCanvas._lastW = ow;
      this.overlayCanvas._lastH = oh;
      this.overlayCanvas.width = ow;
      this.overlayCanvas.height = oh;
      this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    fit(this.canvas);
    if (this.drawerState >= 1) {
      fit(this.s1Canvas);
      fit(this.s2Canvas);
      fit(this.s3Canvas);
    }
    this._cachedSafeCenter = null;
  }

  stepLevel(delta) {
    if (this.currentStepIdx === 4) {
      if (delta > 0 && this.reading.stage < 6) {
        this.reading.stage++;
        this.goalMemory.stageUnfadedStreak = 0;
        this.goalMemory.calmFadeUnlocked = false;
        this.syncStageUI();
        this.spawnForCurrentLevel();
        return;
      } else if (delta < 0 && this.reading.stage > 1) {
        this.reading.stage--;
        this.goalMemory.stageUnfadedStreak = 0;
        this.goalMemory.calmFadeUnlocked = false;
        this.syncStageUI();
        this.spawnForCurrentLevel();
        return;
      }
    }
    const total = this.levelSteps.length;
    this.currentStepIdx = (this.currentStepIdx + delta + total) % total;
    this.applyStepIndex(this.currentStepIdx, false);
  }

  applyStepIndex(idx, fromAutoTutor = false) {
    this.currentStepIdx = Math.max(0, Math.min(this.levelSteps.length - 1, idx));
    if (!fromAutoTutor) {
      this.phaseProgress = 0;
    }
    // Reset per-stage unfaded baseline check whenever entering a new game phase
    this.goalMemory.stageUnfadedStreak = 0;
    this.goalMemory.calmFadeUnlocked = false;
    const cfg = this.levelSteps[this.currentStepIdx];
    this.level = cfg.level;
    this.l1Mode = cfg.l1Mode;
    this.scope3Mode = this.level === 1 && this.l1Mode === 'zero' ? 'PUT_HAZARD' : 'BULLSEYE_MAP';
    this.syncStageUI();
    this.spawnForCurrentLevel();
    this.persistence.saveToBrowser(this);
  }

  syncStageUI() {
    const cfg = this.levelSteps[this.currentStepIdx];
    const quota = cfg ? cfg.quota : 4;
    const stageBadge = document.getElementById('activeStageBadge');
    if (stageBadge) {
      stageBadge.textContent =
        this.level === 7
          ? `Phase 5/5 • Reading Stage ${this.reading.stage}/6 (${this.reading.getCurrentStageConfig().name.split(':')[1].trim()})`
          : cfg.badge;
    }

    const envPill = document.getElementById('envelopePhasePill');
    if (envPill) {
      const reqHits = this.goalMemory.RequiredBaselineHits || 1;
      let memTag = '👁️ STEADY (NO FADE)';
      if (this.goalMemory.mode !== 'ALWAYS') {
        if (this.goalMemory.calmFadeUnlocked) {
          memTag = `🌅 FADE ACTIVE (${(this.goalMemory.initialShowMs / 1000).toFixed(2)}s hold → ${(this.goalMemory.fadeDurationMs / 1000).toFixed(1)}s fade)`;
        } else {
          memTag = `👁️ BASELINE CHECK (${this.goalMemory.stageUnfadedStreak}/${reqHits} unfaded)`;
        }
      }
      envPill.textContent = this.autoScenarioEnabled
        ? `STEP ${this.currentStepIdx + 1}/5 (${this.phaseProgress}/${quota}) • ${memTag}`
        : `MANUAL MODE • ${memTag}`;
    }

    document.querySelectorAll('.lvl-btn').forEach((b) => {
      b.classList.toggle('active', parseInt(b.dataset.step, 10) === this.currentStepIdx);
    });
    document.getElementById('navReadBadge').textContent = `S${this.reading.stage}`;
    document.getElementById('l7StageName').textContent = this.reading.getCurrentStageConfig().name;

    const btnZero = document.getElementById('btnL1Zero');
    const btnShrink = document.getElementById('btnL1Shrink');
    if (this.l1Mode === 'zero') {
      btnZero.className = 'ergo-sub-btn active';
      btnShrink.className = 'ergo-sub-btn';
    } else {
      btnShrink.className = 'ergo-sub-btn active';
      btnZero.className = 'ergo-sub-btn';
    }
    this.updateHUDText();
    setTimeout(() => {
      this.guiEngine.scanDOMElements();
      this.clampActiveTargetsToSafeView();
    }, 60);
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.setupCanvases();
      this.guiEngine.scanDOMElements();
      this.clampActiveTargetsToSafeView();
    });

    // Global window pointermove for Self-Referential GUI-ID Shannon DI, Eye-Proxy Gaze & Doodling
    window.addEventListener('pointermove', (e) => {
      const now = performance.now();
      this.winCursor = { x: e.clientX, y: e.clientY };
      this.guiEngine.pushWindowPointer(
        e.clientX,
        e.clientY,
        now,
        this.telemetry.rt0BaselineMs,
        this.telemetry.regMotor.b,
      );
    });

    // Track clicks on any [data-gui-id] element
    window.addEventListener('pointerdown', (e) => {
      const guiEl = e.target.closest('[data-gui-id]');
      if (guiEl) {
        this.guiEngine.recordGuiClick(guiEl.dataset.guiId);
      }
    });

    // Hero Prev / Next Level Buttons
    document.getElementById('btnPrevLevel').addEventListener('click', () => this.stepLevel(-1));
    document.getElementById('btnNextLevel').addEventListener('click', () => this.stepLevel(1));

    // Giant Top Fullscreen & Borderless Breakout Button
    const btnFullscreen = document.getElementById('btnFullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleTrueFullscreenOrBreakout();
      });
    }
    const btnPopoutNow = document.getElementById('btnPopoutBorderlessNow');
    if (btnPopoutNow) {
      btnPopoutNow.addEventListener('click', () => {
        this.popoutBorderlessWindow();
      });
    }
    document.addEventListener('fullscreenchange', () => {
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      const fsTxt = document.getElementById('fsText');
      if (fsTxt) fsTxt.textContent = isFs ? 'EXIT FULL' : 'FULLSCREEN';
      setTimeout(() => {
        this._cachedSafeCenter = null;
        this.setupCanvases();
        this.clampActiveTargetsToSafeView();
      }, 120);
    });

    // Big Top Hero Audio Button (Default OFF -> Toggles Parametric Human Vocal-Tract & Animal Imitation Synthesizer)
    const btnHeroAudio = document.getElementById('btnHeroAudio');
    if (btnHeroAudio) {
      btnHeroAudio.addEventListener('click', () => {
        const isOn = this.voiceEngine.toggleAudio();
        btnHeroAudio.classList.toggle('audio-on', isOn);
        document.getElementById('heroAudioIcon').textContent = isOn ? '🔊' : '🔇';
        document.getElementById('heroAudioText').textContent = isOn
          ? 'VOICE & FX: ON'
          : 'AUDIO: OFF (TAP FOR VOICE!)';
        this.showToast(
          isOn ? '🔊 HUMAN VOCAL-TRACT SYNTH: ON!' : '🔇 AUDIO MUTED (OFF)',
          isOn
            ? 'Formant glissandos, asking prosody, tok-tok chicken, frog skeee & grrr active!'
            : 'Audio returned to silent default.',
          isOn ? 'border-amber-400' : 'border-rose-500',
        );
      });
    }

    // Vocal-Tract Soundboard Test Buttons inside Lab Drawer
    document.querySelectorAll('.vfx-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.voiceEngine.enabled) {
          this.voiceEngine.enabled = true;
          const heroBtn = document.getElementById('btnHeroAudio');
          if (heroBtn) heroBtn.classList.add('audio-on');
          document.getElementById('heroAudioIcon').textContent = '🔊';
          document.getElementById('heroAudioText').textContent = 'VOICE & FX: ON';
        }
        const preset = btn.dataset.vfx;
        this.voiceEngine.playPreset(preset);
        this.showToast(
          `🗣️ VOCAL TRACT: ${preset}`,
          'Synthesized via 3-Formant (F1/F2/F3) glottal + buccal filter bank (Zero WAVs).',
          'border-amber-400',
        );
      });
    });

    // Funny Phonetic Letter & Word Audition Buttons (Q -> kjiuueehh!, b -> buh-boing!, etc.)
    document.querySelectorAll('.phon-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.voiceEngine.enabled) {
          this.voiceEngine.enabled = true;
          const heroBtn = document.getElementById('btnHeroAudio');
          if (heroBtn) heroBtn.classList.add('audio-on');
          document.getElementById('heroAudioIcon').textContent = '🔊';
          document.getElementById('heroAudioText').textContent = 'VOICE & FX: ON';
        }
        const phon = btn.dataset.phon;
        const jokeCaption = this.voiceEngine.speakGraphemeOrWord(phon, 'CELEBRATE');
        this.showToast(
          `🤪 PHONETIC JOKE: "${phon}"`,
          jokeCaption || `Articulated "${phon}"`,
          'border-amber-400',
        );
      });
    });

    // Top Header `💾 SAVED • 📋 COPY JSON` Button & Collapsed Handle Bar `📋 COPY JSON` Button
    const btnTopSavedJson = document.getElementById('btnTopSavedJson');
    if (btnTopSavedJson) {
      btnTopSavedJson.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openJsonInspectorModal(true);
      });
    }
    const btnDownloadVsCodeZip = document.getElementById('btnDownloadVsCodeZip');
    if (btnDownloadVsCodeZip) {
      btnDownloadVsCodeZip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exportVsCodeZipProject();
      });
    }
    const btnDrawerZip = document.getElementById('btnDrawerZip');
    if (btnDrawerZip) {
      btnDrawerZip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exportVsCodeZipProject();
      });
    }
    const btnCloudDownloadZip = document.getElementById('btnCloudDownloadZip');
    if (btnCloudDownloadZip) {
      btnCloudDownloadZip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exportVsCodeZipProject();
      });
    }
    const btnStandaloneExport = document.getElementById('btnStandaloneExport');
    if (btnStandaloneExport) {
      btnStandaloneExport.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exportStandaloneHTMLApp();
      });
    }
    const btnCloudShareGuide = document.getElementById('btnCloudShareGuide');
    if (btnCloudShareGuide) {
      btnCloudShareGuide.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('cloudShareModal').classList.remove('hidden');
      });
    }
    const btnCloseCloudModal = document.getElementById('btnCloseCloudModal');
    if (btnCloseCloudModal) {
      btnCloseCloudModal.addEventListener('click', () => {
        document.getElementById('cloudShareModal').classList.add('hidden');
      });
    }
    const btnCloudDownloadHtml = document.getElementById('btnCloudDownloadHtml');
    if (btnCloudDownloadHtml) {
      btnCloudDownloadHtml.addEventListener('click', () => {
        this.exportStandaloneHTMLApp();
      });
    }
    const btnCopyFullHtmlSource = document.getElementById('btnCopyFullHtmlSource');
    if (btnCopyFullHtmlSource) {
      btnCopyFullHtmlSource.addEventListener('click', () => {
        const fullHtml = this.buildCleanStandaloneHtmlString();
        const ta = document.createElement('textarea');
        ta.value = fullHtml;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch (_) {}
        document.body.removeChild(ta);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(fullHtml).catch(() => {});
        }
        btnCopyFullHtmlSource.textContent = `✅ COPIED (${Math.round(fullHtml.length / 1024)} KB)! PASTE INTO GOOGLE SITES EMBED`;
        setTimeout(() => {
          btnCopyFullHtmlSource.textContent = '📋 COPY FULL HTML FOR GOOGLE SITES';
        }, 3500);
        this.showToast(
          '📋 FULL HTML COPIED FOR GOOGLE SITES!',
          'Open sites.google.com → Insert → Embed → Embed Code → Paste!',
          'border-emerald-400',
        );
      });
    }
    const btnHandleCopyJson = document.getElementById('btnHandleCopyJson');
    if (btnHandleCopyJson) {
      btnHandleCopyJson.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openJsonInspectorModal(true);
      });
    }

    // JSON Inspector Modal Controls
    const btnModalCopy = document.getElementById('btnModalCopy');
    if (btnModalCopy) {
      btnModalCopy.addEventListener('click', () => {
        this.copyJSONToClipboard(true);
      });
    }
    const btnModalDownloadHtml = document.getElementById('btnModalDownloadHtml');
    if (btnModalDownloadHtml) {
      btnModalDownloadHtml.addEventListener('click', () => {
        this.exportStandaloneHTMLApp();
      });
    }
    const btnModalDownload = document.getElementById('btnModalDownload');
    if (btnModalDownload) {
      btnModalDownload.addEventListener('click', () => {
        this.exportJSON();
      });
    }
    const btnModalClose = document.getElementById('btnModalClose');
    if (btnModalClose) {
      btnModalClose.addEventListener('click', () => {
        document.getElementById('jsonInspectorModal').classList.add('hidden');
      });
    }

    // Auto-Scenario Envelope Tutor Toggle (inside drawer)
    const btnAutoScen = document.getElementById('btnAutoScenario');
    if (btnAutoScen) {
      btnAutoScen.addEventListener('click', (e) => {
        this.autoScenarioEnabled = !this.autoScenarioEnabled;
        e.currentTarget.classList.toggle('active', this.autoScenarioEnabled);
        e.currentTarget.textContent = `🚀 Auto-Scenario: ${this.autoScenarioEnabled ? 'ON (Grounding → Reading)' : 'OFF (Manual)'}`;
        this.syncStageUI();
      });
    }

    // Explicit UI / Target Scale Buttons (- / +)
    document.getElementById('btnScaleDown').addEventListener('click', () => {
      this.reading.uiFontScale = Math.max(
        0.75,
        Number((this.reading.uiFontScale - 0.15).toFixed(2)),
      );
      document.getElementById('lblUiScale').textContent =
        `Scale: ${Math.round(this.reading.uiFontScale * 100)}%`;
      this.spawnForCurrentLevel();
    });
    document.getElementById('btnScaleUp').addEventListener('click', () => {
      this.reading.uiFontScale = Math.min(
        2.0,
        Number((this.reading.uiFontScale + 0.15).toFixed(2)),
      );
      document.getElementById('lblUiScale').textContent =
        `Scale: ${Math.round(this.reading.uiFontScale * 100)}%`;
      this.spawnForCurrentLevel();
    });

    // Aiming Strategy Selector (Natural vs Bullseye Core vs Speed Rim-Graze)
    document.querySelectorAll('.aim-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.aim-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.telemetry.aimStrategy = btn.dataset.aim;
        this.scope3Mode = 'BULLSEYE_MAP';
        const modeDesc = {
          NATURAL:
            '🎯 Natural Aiming: Click naturally while we measure your radial center bias (r/R) & Effective Width (We).',
          BULLSEYE:
            '⊕ Bullseye Core Mode: Aim inside the inner 30% center ring to maximize precision (high ID_eff).',
          RIM_GRAZE:
            '⚡ Speed Rim-Graze Mode: Tap as soon as your cursor crosses the outer 70–100% boundary ring—zero homing needed!',
        };
        const coach = document.getElementById('insightText');
        if (coach) coach.textContent = modeDesc[this.telemetry.aimStrategy] || modeDesc.NATURAL;
        this.showToast(
          `AIM STRATEGY: ${this.telemetry.aimStrategy}`,
          modeDesc[this.telemetry.aimStrategy],
          'border-amber-400',
        );
      });
    });

    // Toggle Anti-Fat-Finger (FFP) Offset Scoop-Visor Drag & Drop Mode
    const btnScoop = document.getElementById('btnToggleScoop');
    if (btnScoop) {
      btnScoop.addEventListener('click', (e) => {
        this.scoopVisor.enabled = !this.scoopVisor.enabled;
        e.currentTarget.classList.toggle('active', this.scoopVisor.enabled);
        e.currentTarget.textContent = `🔭 Scoop-Visor: ${this.scoopVisor.enabled ? 'ON (FFP Offset)' : 'OFF (Direct Tap)'}`;
        this.enforceOnScreenGuard();
        this.showToast(
          this.scoopVisor.enabled ? '🔭 ANTI-FFP SCOOP-VISOR: ON' : '👆 DIRECT TAP MODE: ON',
          this.scoopVisor.enabled
            ? 'Grab the lower thumb pad, steer the unobstructed upper Visor over the target, and lift finger to drop!'
            : 'Switched to standard direct tap/click.',
          'border-cyan-400',
        );
      });
    }

    // Parameterized Goal Memory & Hover-to-Reveal Mode Buttons
    document.querySelectorAll('.gmem-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.gmem-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.gmem;
        this.goalMemory.mode = mode;
        this.telemetry.goalMemoryMode = mode;
        this.goalMemory.autoStreak = 0;
        this.configureGoalMemoryParameters();
        this.trialStartTime = performance.now();
        const descMap = {
          ALWAYS: '👁️ Always Visible: Top Goal & targets stay 100% visible (Baseline).',
          PEEK_1200:
            '⏳ 1.2s Peek + Hover Recall: Top goal fades after 1.2s! Move mouse to top banner (no click) to reveal it again.',
          MEM_500:
            '🧠 0.5s Spatial Working Memory: Goal & target flash for 0.5s then cloak! Hover top sensor bar to re-peek anytime.',
          AUTO_PROG:
            '🔄 Auto-Fade Progression: Starts Always-On for 3 hits, then progressively shortens peek window to test working memory!',
        };
        const coach = document.getElementById('insightText');
        if (coach) coach.textContent = descMap[mode] || descMap.ALWAYS;
        this.showToast(`GOAL MEMORY: ${mode}`, descMap[mode], 'border-cyan-400');
      });
    });

    // L7 Stage Controls
    document.getElementById('btnStagePrev').addEventListener('click', () => {
      this.reading.stage = Math.max(1, this.reading.stage - 1);
      this.syncStageUI();
      this.spawnForCurrentLevel();
    });
    document.getElementById('btnStageNext').addEventListener('click', () => {
      this.reading.stage = Math.min(6, this.reading.stage + 1);
      this.syncStageUI();
      this.spawnForCurrentLevel();
    });
    document.getElementById('btnAutoZPD').addEventListener('click', (e) => {
      this.reading.autoZPD = !this.reading.autoZPD;
      e.currentTarget.textContent = `Auto-ZPD: ${this.reading.autoZPD ? 'ON' : 'OFF'}`;
    });

    // Keyboard shortcuts [ and ] or PageUp / PageDown for Prev / Next Level
    window.addEventListener('keydown', (e) => {
      if (e.key === '[' || e.key === 'PageUp') {
        e.preventDefault();
        this.stepLevel(-1);
      } else if (e.key === ']' || e.key === 'PageDown') {
        e.preventDefault();
        this.stepLevel(1);
      }
    });

    // Direct Step Jump Pills
    document.querySelectorAll('.lvl-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.applyStepIndex(parseInt(btn.dataset.step, 10));
      });
    });

    // L1 Subcontrols
    document.getElementById('btnL1Zero').addEventListener('click', () => {
      this.applyStepIndex(0);
    });
    document.getElementById('btnL1Shrink').addEventListener('click', () => {
      this.shrinkRadius = 78;
      this.applyStepIndex(1);
    });

    // L1 Foreperiod Distribution Selector
    document.querySelectorAll('.fp-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fp-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.fpEngine.setMode(btn.dataset.fp);
        this.scope3Mode = 'PUT_HAZARD';
        if (this.level === 1 && this.l1Mode === 'zero') {
          this.spawnForCurrentLevel();
        }
      });
    });

    // L2 Subcontrols
    document.getElementById('btnShapeCircle').addEventListener('click', () => {
      this.l2Shape = 'circle';
      document.getElementById('btnShapeCircle').className = 'ergo-sub-btn active';
      document.getElementById('btnShapeSquare').className = 'ergo-sub-btn';
      this.spawnForCurrentLevel();
    });
    document.getElementById('btnShapeSquare').addEventListener('click', () => {
      this.l2Shape = 'square';
      document.getElementById('btnShapeSquare').className = 'ergo-sub-btn active';
      document.getElementById('btnShapeCircle').className = 'ergo-sub-btn';
      this.spawnForCurrentLevel();
    });

    // Toggle X-Ray Overlay
    document.getElementById('btnToggleXray').addEventListener('click', (e) => {
      this.guiEngine.xrayEnabled = !this.guiEngine.xrayEnabled;
      e.currentTarget.textContent = `🔍 X-Ray: ${this.guiEngine.xrayEnabled ? 'ON' : 'OFF'}`;
    });

    // Cycle Scope 3 Mode (3-way: BULLSEYE_MAP -> FITTS -> PUT_HAZARD)
    document.getElementById('btnToggleScope3').addEventListener('click', () => {
      const order = ['BULLSEYE_MAP', 'FITTS', 'PUT_HAZARD'];
      const idx = (order.indexOf(this.scope3Mode) + 1) % order.length;
      this.scope3Mode = order[idx];
    });

    // Watchdog Self-Test Button
    document.getElementById('btnWatchdog').addEventListener('click', () => {
      const ok = RuntimeWatchdog.runSelfTests(this);
      this.showToast(
        ok ? '✅ 12/12 DIAGNOSTIC SELF-TESTS PASSED' : '⚠️ DIAGNOSTIC WARNING',
        'Verified 2x Ergonomic GUI, Unobstructed Safe Action Field, View-Normalized Tillman Law & 48-Trial Log.',
        ok ? 'border-emerald-500' : 'border-rose-500',
      );
    });

    // Drawer State Buttons & Handle Drag/Click
    document.querySelectorAll('.dstate-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setDrawerState(parseInt(btn.dataset.dstate, 10));
      });
    });

    const drawer = document.getElementById('telemetryDrawer');
    const header = document.getElementById('topHeader');
    const handle = document.getElementById('drawerHandle');
    let dragStartY = null;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#drawerStateBtns')) return;
      dragStartY = e.clientY;
    });
    window.addEventListener('pointerup', (e) => {
      this.telemetry.recordUp(this.cursor.x, this.cursor.y, performance.now());
      if (dragStartY !== null) {
        const dy = dragStartY - e.clientY;
        if (Math.abs(dy) < 12) {
          this.setDrawerState((this.drawerState + 1) % 3);
        } else if (dy > 30) {
          this.setDrawerState(Math.min(2, this.drawerState + 1));
        } else if (dy < -30) {
          this.setDrawerState(Math.max(0, this.drawerState - 1));
        }
        dragStartY = null;
      }
    });

    // Category Filter Pills
    document.querySelectorAll('.cat-pill').forEach((btn) => {
      btn.addEventListener('click', () => this.filter100Category(btn.dataset.cat));
    });

    // Track Inspection Time on Drawer or Top Bar
    [drawer, header].forEach((el) => {
      if (!el) return;
      el.addEventListener('pointerenter', () => {
        this.dockEnterTime = performance.now();
      });
      el.addEventListener('pointerleave', () => {
        if (this.dockEnterTime > 0) {
          const dt = performance.now() - this.dockEnterTime;
          this.currentTrialDockMs += dt;
          if (dt > 500) this.gesture.counts.inspect++;
          this.dockEnterTime = 0;
        }
      });
    });

    // Preset Loaders (66-Log, 48-Log, 25-Fitts)
    const btn66 = document.getElementById('btnLoad66');
    if (btn66) {
      btn66.addEventListener('click', () => {
        this.telemetry.loadPreset66(this.fpEngine, this.reading);
        this.scope3Mode = 'BULLSEYE_MAP';
        this.syncStageUI();
        this.persistence.saveToBrowser(this);
        this.showToast(
          '🎯 66-TRIAL BULLSEYE LOG LOADED',
          'Loaded 66 trials & 49 PUT records.',
          'border-emerald-400',
        );
      });
    }
    const btn48 = document.getElementById('btnLoad48');
    if (btn48) {
      btn48.addEventListener('click', () => {
        this.telemetry.loadPresetPut32(this.fpEngine);
        this.scope3Mode = 'PUT_HAZARD';
        this.syncStageUI();
        this.persistence.saveToBrowser(this);
        this.showToast(
          '⚡ 48-TRIAL LOG LOADED',
          'Loaded 48 trials & PUT hazard records.',
          'border-cyan-400',
        );
      });
    }
    const btn25 = document.getElementById('btnLoad25');
    if (btn25) {
      btn25.addEventListener('click', () => {
        this.telemetry.loadPreset25(this.fpEngine);
        this.scope3Mode = 'FITTS';
        this.syncStageUI();
        this.persistence.saveToBrowser(this);
        this.showToast(
          '📊 25-FITTS LOG LOADED',
          'Loaded 25 Fitts pointing & outlier trials.',
          'border-amber-400',
        );
      });
    }

    // Clear Storage / New Kid Profile
    const btnClear = document.getElementById('btnClearStorage');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.persistence.clearBrowserSave();
        this.telemetry.trials = [];
        this.fpEngine.records = [];
        this.reading.stage = 1;
        this.currentStepIdx = 0;
        this.phaseProgress = 0;
        this.applyStepIndex(0, false);
        this.showToast(
          '👶 NEW KID PROFILE STARTED',
          'Cleared localStorage & reset to Phase 1/5.',
          'border-rose-500',
        );
      });
    }

    // Git-Style Checkpoint Commit & Revert Buttons
    const btnCommit = document.getElementById('btnCommitCheckpoint');
    if (btnCommit) {
      btnCommit.addEventListener('click', () => {
        this.persistence.commitCheckpoint(this);
        this.showToast(
          '📌 CHECKPOINT COMMITTED',
          `Saved snapshot (${GIT_CHECKPOINT_META.tag}) to localStorage.`,
          'border-amber-400',
        );
      });
    }
    const btnRevert = document.getElementById('btnRevertCheckpoint');
    if (btnRevert) {
      btnRevert.addEventListener('click', () => {
        const tag = this.persistence.revertToCheckpoint(this);
        this.showToast(
          '⏪ REVERTED TO CHECKPOINT',
          `Restored ${tag || GIT_CHECKPOINT_META.tag}.`,
          'border-purple-400',
        );
      });
    }

    // Semantic SVG Morph Toggle
    const btnMorph = document.getElementById('btnToggleMorph');
    if (btnMorph) {
      btnMorph.addEventListener('click', (e) => {
        this.semanticMorphEnabled = !this.semanticMorphEnabled;
        e.currentTarget.classList.toggle('active', this.semanticMorphEnabled);
        e.currentTarget.textContent = `🎨 Morph: ${this.semanticMorphEnabled ? 'ON' : 'OFF'}`;
        this.persistence.saveToBrowser(this);
      });
    }

    // Drawer Copy JSON & Export JSON Buttons
    const btnCopy = document.getElementById('btnCopyJson');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => this.openJsonInspectorModal(true));
    }
    const btnExp = document.getElementById('btnExport');
    if (btnExp) {
      btnExp.addEventListener('click', () => this.exportJSON());
    }

    // Arena Pointer Telemetry (With Distance-Gated Ballistic Surge Latch & Anti-FFP Scoop-Visor Drag)
    this.canvas.addEventListener('pointermove', (e) => {
      const now = performance.now();
      const sv = this.scoopVisor;

      // Update Anti-FFP Scoop-Visor coordinates if dragging (or following mouse when button is down)
      if (sv.enabled && sv.isDragging) {
        const { safeLeft, safeTop, safeRight, safeBottom } = this.getSafeArenaCenter();
        const prevVx = sv.visorX,
          prevVy = sv.visorY;
        sv.handleX = Math.max(safeLeft + 16, Math.min(safeRight - 16, e.offsetX));
        sv.handleY = Math.max(safeTop + sv.offsetY + 14, Math.min(safeBottom - 10, e.offsetY));
        sv.visorX = sv.handleX;
        sv.visorY = sv.handleY - sv.offsetY;
        sv.dragPathLen += Math.hypot(sv.visorX - prevVx, sv.visorY - prevVy);
        this.updateScoopVisorCandidate();
      }

      // Use the upper Scoop Visor as the active aiming coordinate when dragging so Fitts/Tillman & L3 Spiral track the unobstructed visor!
      const aimX = sv.enabled && sv.isDragging ? sv.visorX : e.offsetX;
      const aimY = sv.enabled && sv.isDragging ? sv.visorY : e.offsetY;

      this.cursor = { x: aimX, y: aimY };
      this.telemetry.recordPointerMove(e, now);
      this.gesture.pushSample(aimX, aimY, now);

      const { h } = this.getSafeArenaCenter();
      const nearBottom = h - e.offsetY < 48 && this.telemetry.instSpeed < 380;
      drawer.classList.toggle('proximity-glow', nearBottom);

      // HOVER-TO-REVEAL TOP GOAL SENSOR DETECTOR:
      // Triggered either by cursor OR by steering the upper Scoop Visor into the top goal zone!
      this.updateTopGoalHoverSensor(aimX, aimY, now);

      this.trail.push({ x: aimX, y: aimY, t: now, speed: this.telemetry.instSpeed });
      if (this.trail.length > 75) this.trail.shift();

      if (this.trialStartTime > 0) {
        const distFromStart = Math.hypot(aimX - this.trialStartPos.x, aimY - this.trialStartPos.y);
        let activeTargetObj = this.target;
        if (this.level === 7 && this.readingTargets.length > 0) {
          activeTargetObj = this.readingTargets.find((rt) => rt.isTarget) || this.readingTargets[0];
        }
        const totalTargetChord = activeTargetObj
          ? Math.max(
              45,
              Math.hypot(
                activeTargetObj.x - this.trialStartPos.x,
                activeTargetObj.y - this.trialStartPos.y,
              ),
            )
          : 160;

        // Require genuine directed velocity (> 95 px/s and > 14 px displacement from trial start) to latch moveOnsetTime
        if (this.moveOnsetTime === 0 && this.telemetry.instSpeed > 95 && distFromStart > 14) {
          this.moveOnsetTime = now;
        }
        if (this.moveOnsetTime > 0) {
          if (this.telemetry.instSpeed > this.trialPeakSpeed) {
            this.trialPeakSpeed = this.telemetry.instSpeed;
            this.peakVelTime = now;
          } else if (
            this.peakVelTime > 0 &&
            this.decelOnsetTime === 0 &&
            now - this.moveOnsetTime >= 110 &&
            distFromStart >= totalTargetChord * 0.32 &&
            this.trialPeakSpeed > 180 &&
            this.telemetry.instSpeed < this.trialPeakSpeed * 0.62
          ) {
            // Latch end of Primary Ballistic Surge after at least 110ms of flight and 32% of chord distance
            this.decelOnsetTime = now;
          }
        }
      }

      if (this.level === 3 && this.spiral.active) {
        this.updateSpiralProgress(now);
      }
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      const now = performance.now();
      const sv = this.scoopVisor;

      // KID-FIRST INSTANT ENGAGEMENT:
      // On the very first touch/click inside the game arena:
      // 1) Unlock WebAudio Funny Phonetic Synthesizer & speak the active target letter/word!
      // 2) If on mobile/tablet (and not blocked by an iframe), automatically enter Fullscreen!
      if (!this.firstTouchUnlocked) {
        this.firstTouchUnlocked = true;
        if (this.voiceEngine.enabled) {
          this.voiceEngine.ensureContext();
          const heroAudioText = document.getElementById('heroAudioText');
          if (heroAudioText) heroAudioText.textContent = 'VOICE: ON';
          if (this.level === 7 && this.activeReadingItem) {
            this.voiceEngine.speakReadingItem(this.activeReadingItem, 'ASKING');
          }
        }
        const isMobileTouch = window.innerWidth < 900 || e.pointerType === 'touch';
        const inIframe = window.self !== window.top;
        if (
          isMobileTouch &&
          !inIframe &&
          !document.fullscreenElement &&
          document.documentElement.requestFullscreen
        ) {
          document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        }
      }

      // Check if user tapped the floating "🔊 TAP TO ENABLE FUNNY VOICES!" quick-enable pill in the arena
      if (!this.voiceEngine.enabled && this.audioPromptRect) {
        const r = this.audioPromptRect;
        if (
          e.offsetX >= r.x &&
          e.offsetX <= r.x + r.w &&
          e.offsetY >= r.y &&
          e.offsetY <= r.y + r.h
        ) {
          const isOn = this.voiceEngine.toggleAudio();
          const btnHeroAudio = document.getElementById('btnHeroAudio');
          if (btnHeroAudio) btnHeroAudio.classList.toggle('audio-on', isOn);
          document.getElementById('heroAudioIcon').textContent = isOn ? '🔊' : '🔇';
          document.getElementById('heroAudioText').textContent = 'VOICE & FX: ON';
          this.showToast(
            '🔊 FUNNY PHONETIC VOICES ENABLED!',
            'Playing "kjiuueehh!" (q) & expressive human vocal-tract jokes!',
            'border-amber-400',
          );
          return;
        }
      }

      this.telemetry.recordDown(e.offsetX, e.offsetY, now);

      // In L1A Zero-Move Center Tap, allow instant hair-trigger tap OR scoop grab
      if (this.level === 1 && this.l1Mode === 'zero') {
        this.cursor = { x: e.offsetX, y: e.offsetY };
        this.handleArenaClick(e.offsetX, e.offsetY, now);
        return;
      }

      if (sv.enabled) {
        sv.isDragging = true;
        sv.pointerId = e.pointerId;
        sv.dragStartTime = now;
        sv.dragPathLen = 0;

        const distToHandle = Math.hypot(e.offsetX - sv.handleX, e.offsetY - sv.handleY);
        if (distToHandle > sv.handleR * 1.8) {
          const { safeLeft, safeTop, safeRight, safeBottom } = this.getSafeArenaCenter();
          sv.handleX = Math.max(safeLeft + 16, Math.min(safeRight - 16, e.offsetX));
          sv.handleY = Math.max(safeTop + sv.offsetY + 14, Math.min(safeBottom - 10, e.offsetY));
          sv.visorX = sv.handleX;
          sv.visorY = sv.handleY - sv.offsetY;
        }
        this.cursor = { x: sv.visorX, y: sv.visorY };
        // Anchor ballistic chord start to where the Scoop-Visor grab began, and let real drag motion trigger moveOnsetTime!
        this.trialStartPos = { x: sv.visorX, y: sv.visorY };
        if (this.moveOnsetTime === 0 && now - this.trialStartTime > 90) {
          this.moveOnsetTime = now;
        }
        this.trialPeakSpeed = 0;
        this.peakVelTime = 0;
        this.decelOnsetTime = 0;
        this.updateScoopVisorCandidate();

        // In Level 3 Spiral, grabbing & placing the Visor on START immediately activates the spiral run
        if (this.level === 3 && this.spiral.path.length > 0 && !this.spiral.active) {
          const startPt = this.spiral.path[0];
          if (Math.hypot(sv.visorX - startPt.x, sv.visorY - startPt.y) <= startPt.w * 1.8) {
            this.spiral.active = true;
            this.spiral.startTime = now;
            this.spiral.progress = 0;
            this.spiral.insideSamples = 1;
            this.spiral.totalSamples = 1;
            this.trialStartTime = now;
          }
        }
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch (_) {}
      } else {
        this.cursor = { x: e.offsetX, y: e.offsetY };
        this.handleArenaClick(e.offsetX, e.offsetY, now);
      }
    });

    // LIFT FINGER TO DROP (`pointerup` on canvas) when Scoop-Visor is active!
    this.canvas.addEventListener('pointerup', (e) => {
      const now = performance.now();
      const sv = this.scoopVisor;
      if (sv.enabled && sv.isDragging) {
        sv.isDragging = false;
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch (_) {}

        // Visual drop ripple at the upper Scoop Visor crosshairs
        sv.dropRipples.push({ x: sv.visorX, y: sv.visorY, r: sv.visorR, alpha: 1.0 });

        // If user dragged the Scoop-Visor (or aimed it over a target) and lifted their finger, drop at (visorX, visorY)!
        this.updateScoopVisorCandidate();
        if (sv.hoveredCandidate) {
          this.handleArenaClick(sv.visorX, sv.visorY, now);
        } else if (sv.dragPathLen < 14 && now - sv.dragStartTime < 260) {
          // Quick direct tap fallback if user tapped directly on a target without dragging
          this.handleArenaClick(e.offsetX, e.offsetY, now);
        } else {
          // Dropped in empty space: play gentle questioning glissando
          this.voiceEngine.playPreset('ASK_GLISS');
        }
      }
    });
  }

  handleGuiDoodle(type, targetGui, meta) {
    document.getElementById('pillDoodleCount').textContent = String(
      this.guiEngine.totalDoodleEvents,
    );
    const coach = document.getElementById('insightText');
    if (type === 'ORBIT_ENCIRCLE') {
      const msg = `⭕ Orbit Doodle around [${targetGui.id}] (${targetGui.label})! Shannon DI=${targetGui.liveID.toFixed(2)} bits, Gaze Dwell=${Math.round(targetGui.dwellMs)}ms.`;
      if (coach) coach.textContent = msg;
      this.showToast(`⭕ GUI ORBIT DOODLE: ${targetGui.id}`, msg, 'border-cyan-400');
    } else if (type === 'SCRATCH_FRICTION') {
      const msg = `❌ Scratch-Out Friction on [${targetGui.id}]! Logged usability struggle (${targetGui.struggleRatio}x) & auto-enlarged button to ${Math.round(targetGui.scale * 100)}%.`;
      if (coach) coach.textContent = msg;
      this.showToast(`❌ GUI FRICTION ADAPTED: ${targetGui.id}`, msg, 'border-rose-500');
    } else if (type === 'UNDERLINE_READ') {
      const msg = `〰️ Eye-Proxy Reading Underline on [${targetGui.id}] (${targetGui.label}) — user is actively decoding this control.`;
      if (coach) coach.textContent = msg;
      this.showToast(`〰️ EYE-PROXY READING: ${targetGui.id}`, msg, 'border-amber-400');
    } else if (type === 'HESITATION_SEARCH') {
      const msg = `❓ Stray Hesitation near [${targetGui.id}] (tortuosity ${meta.tortuosity}x) — illuminating nearby affordances.`;
      if (coach) coach.textContent = msg;
      this.showToast(`❓ AFFORDANCE SEARCH: ${targetGui.id}`, msg, 'border-purple-500/40');
    }
  }

  handleEmbodiedGesture(type, info) {
    this.currentTrialGesture = type;
    document.getElementById('gCountNo').textContent = this.gesture.counts.no;
    document.getElementById('gCountYes').textContent = this.gesture.counts.yes;

    if (type === 'NO_SHAKE') {
      this.voiceEngine.playPreset('GRRRR');
      this.reading.uiFontScale = Math.min(1.6, this.reading.uiFontScale + 0.16);
      if (this.target) this.target.r = Math.min(98, this.target.r * 1.25);
      for (const rt of this.readingTargets) rt.r = Math.min(68, rt.r * 1.2);
      this.showToast(
        '↔ NO SHAKE GESTURE',
        `Enlarged targets & font scale to ${Math.round(this.reading.uiFontScale * 100)}%.`,
        'border-rose-500',
      );
    } else if (type === 'YES_NOD') {
      this.voiceEngine.playPreset('HIHI');
      this.reading.uiFontScale = Math.max(0.85, this.reading.uiFontScale - 0.06);
      if (this.target) this.target.r = Math.max(12, this.target.r * 0.9);
      this.showToast(
        '↕ YES NOD GESTURE',
        'Flow state confirmed — tightening target precision.',
        'border-emerald-500',
      );
    } else if (type === 'RAGE_SCRIBBLE') {
      this.voiceEngine.playPreset('TSSJJ');
      this.reading.uiFontScale = 1.35;
      if (this.reading.stage > 1) this.reading.stage--;
      this.spawnForCurrentLevel();
      this.showToast(
        '⚡ RAGE SCRIBBLE DETECTED',
        'Scaffolding down one reading stage & enlarging targets.',
        'border-amber-500',
      );
    }
  }

  showToast(title, sub, borderClass) {
    const toast = document.getElementById('gestureToast');
    toast.className = `bg-slate-900/95 border-2 ${borderClass} rounded-lg px-3 py-1.5 shadow-xl transition-all`;
    document.getElementById('gestureToastTitle').textContent = title;
    document.getElementById('gestureToastSub').textContent = sub;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
  }

  updateHUDText() {
    const badge = document.getElementById('hudModeBadge');
    const title = document.getElementById('hudTitle');
    const l1Sub = document.getElementById('l1SubControls');
    const l1Fp = document.getElementById('l1ForeperiodControls');
    const l2Sub = document.getElementById('l2SubControls');
    const l7Sub = document.getElementById('l7SubControls');

    if (l1Sub)
      l1Sub.className = this.level === 1 ? 'flex flex-wrap items-center gap-1.5 ml-2' : 'hidden';
    if (l1Fp) {
      l1Fp.className =
        this.level === 1 && this.l1Mode === 'zero'
          ? 'flex flex-wrap items-center gap-1.5 ml-1'
          : 'hidden';
    }
    if (l2Sub) l2Sub.className = this.level === 2 ? 'flex items-center gap-1.5 ml-2' : 'hidden';
    if (l7Sub) l7Sub.className = this.level === 7 ? 'flex items-center gap-1.5 ml-2' : 'hidden';

    if (!badge || !title) return;
    if (this.level === 1) {
      badge.textContent =
        this.l1Mode === 'zero' ? 'OSI L1A • ZERO-MOVE TAP' : 'OSI L1B • SHRINKING CIRCLE';
      title.textContent =
        this.l1Mode === 'zero'
          ? 'Isochronous → Stochastic Foreperiod PUT Test'
          : 'Shrinking Circle Calibration (View-Normalized Safe Arena)';
    } else if (this.level === 2) {
      badge.textContent = 'OSI L2 • FITTS KINEMATICS';
      title.textContent = 'View-Normalized Pointing (Ballistic Surge vs. Meyer Corrective Homing)';
    } else if (this.level === 3) {
      badge.textContent = 'OSI L3 • SPIRAL STEERING';
      title.textContent = 'Continuous Accot-Zhai Spiral Tunnel (Scaled to Safe Action Field)';
    } else if (this.level === 7) {
      const st = this.reading.getCurrentStageConfig();
      badge.textContent = `OSI L7 • ${st.name.toUpperCase()}`;
      title.textContent = st.desc;
    }
  }

  /**
   * Configures Goal Memory fade timing & working-memory parameters
   */
  configureGoalMemoryParameters() {
    const gm = this.goalMemory;
    if (gm.mode === 'ALWAYS') {
      gm.initialShowMs = 999999;
      gm.fadeDurationMs = 1000;
      gm.cloakTargets = false;
      gm.calmFadeUnlocked = false;
    } else if (gm.mode === 'PEEK_1200') {
      gm.initialShowMs = 1200;
      gm.fadeDurationMs = 1100;
      gm.cloakTargets = false;
      gm.calmFadeUnlocked = true;
    } else if (gm.mode === 'MEM_500') {
      gm.initialShowMs = 500;
      gm.fadeDurationMs = 600;
      gm.cloakTargets = true;
      gm.calmFadeUnlocked = true;
    } else {
      // AUTO_PROG: Unlock after 1 clean baseline hit for adult-speed proficiency
      const fastAdult = this.telemetry.rt0BaselineMs < 650 || this.telemetry.regMotor.tp > 4.0;
      gm.RequiredBaselineHits = fastAdult ? 1 : 2;
      gm.calmFadeUnlocked = gm.stageUnfadedStreak >= gm.RequiredBaselineHits;
      if (gm.calmFadeUnlocked) {
        gm.initialShowMs = Math.max(420, 950 - gm.autoStreak * 110);
        gm.fadeDurationMs = 1050;
        gm.cloakTargets = gm.autoStreak >= 4;
      } else {
        gm.initialShowMs = 999999;
        gm.fadeDurationMs = 1100;
        gm.cloakTargets = false;
      }
    }
  }

  /**
   * Tracks non-click hover or Scoop-Visor checkbacks into the top Goal Sensor bar
   */
  updateTopGoalHoverSensor(x, y, now) {
    const { topSafeY } = this.getSafeArenaCenter();
    const gm = this.goalMemory;
    const inTopZone = y <= topSafeY + 26;

    if (inTopZone) {
      if (!gm.isHoveringTopGoal) {
        gm.isHoveringTopGoal = true;
        gm.hoverEnterTime = now;
        if (gm.revealAlpha < 0.85) {
          gm.trialPeekCount++;
          this.telemetry.goalPeekCount++;
          const pkEl = document.getElementById('pillGoalPeeks');
          if (pkEl) pkEl.textContent = String(this.telemetry.goalPeekCount);
        }
      } else if (gm.hoverEnterTime > 0) {
        const dt = Math.min(50, Math.max(0, now - gm.hoverEnterTime));
        gm.trialHoverMs += dt;
        this.telemetry.totalGoalHoverMs += dt;
        gm.hoverEnterTime = now;
      }
      gm.revealAlpha = Math.min(1.0, gm.revealAlpha + 0.18);
    } else {
      gm.isHoveringTopGoal = false;
      gm.hoverEnterTime = 0;
    }
  }

  spawnForCurrentLevel() {
    clearTimeout(this.l1WaitTimer);
    this.configureGoalMemoryParameters();
    const { cx, cy, safeLeft, safeTop, safeRight, safeBottom, safeW, safeH, isMobile } =
      this.getSafeArenaCenter(true);

    this.trialStartTime = performance.now();
    this.trialStartPos = { x: this.cursor.x, y: this.cursor.y };
    this.moveOnsetTime = 0;
    this.peakVelTime = 0;
    this.trialPeakSpeed = 0;
    this.decelOnsetTime = 0;
    this.currentTrialDockMs = 0;
    this.currentTrialGesture = null;
    this.goalMemory.trialPeekCount = 0;
    this.goalMemory.trialHoverMs = 0;
    this.goalMemory.revealAlpha = 1.0;

    const ffpReserve =
      this.scoopVisor.enabled && !(this.level === 1 && this.l1Mode === 'zero')
        ? this.scoopVisor.offsetY + this.scoopVisor.handleR + 10
        : 0;
    const playBottom = Math.max(safeTop + 90, safeBottom - ffpReserve);

    if (this.level === 1) {
      if (this.l1Mode === 'zero') {
        this.l1WaitState = 'WAITING';
        const fp = this.fpEngine.nextForeperiod();
        this.l1WaitStartMs = performance.now();
        this.l1WaitAssignedMs = fp.tw;
        const r = Math.min(
          Math.min(safeW, safeH) * 0.22,
          Math.round(70 * this.reading.uiFontScale),
        );
        this.target = {
          x: cx,
          y: cy,
          r: Math.max(28, r),
          color: '#f59e0b',
          label: `WAIT (${fp.dist.slice(0, 4)})`,
          subLabel: `h(tw)=${fp.hazard}/s`,
          id: 0.15,
          tw: fp.tw,
          fpDist: fp.dist,
        };
        this.l1WaitTimer = setTimeout(() => {
          this.l1WaitState = 'READY_GREEN';
          this.l1GreenTimestamp = performance.now();
          this.trialStartTime = this.l1GreenTimestamp;
          if (this.target) {
            this.target.color = '#10b981';
            this.target.label = 'TAP NOW!';
            this.target.subLabel = `Waited ${fp.tw}ms`;
          }
        }, fp.tw);
      } else {
        const r = Math.max(14, Math.min(this.shrinkRadius, Math.min(safeW, safeH) * 0.2));
        const margin = r + 14;
        const tx = safeLeft + margin + Math.random() * Math.max(20, safeW - 2 * margin);
        const ty =
          safeTop + margin + Math.random() * Math.max(20, (playBottom - safeTop) * 0.75 - margin);
        const dist = Math.hypot(tx - this.cursor.x, ty - this.cursor.y);
        const id = Math.log2(dist / (2 * r) + 1);
        this.target = {
          x: tx,
          y: ty,
          r,
          color: '#06b6d4',
          label: `${Math.round(r * 2)}px`,
          id: Math.max(0.4, id),
          startX: this.cursor.x,
          startY: this.cursor.y,
        };
        this.resetScoopVisorPosition();
      }
    } else if (this.level === 2) {
      const r = Math.max(16, Math.round((18 + Math.random() * 28) * this.reading.uiFontScale));
      const margin = r + 16;
      const tx = safeLeft + margin + Math.random() * Math.max(20, safeW - 2 * margin);
      const ty =
        safeTop + margin + Math.random() * Math.max(20, (playBottom - safeTop) * 0.78 - margin);
      const dist = Math.hypot(tx - this.cursor.x, ty - this.cursor.y);
      const id = Math.log2(dist / (2 * r) + 1);
      this.target = {
        x: tx,
        y: ty,
        r,
        color: '#10b981',
        label: `ID ${id.toFixed(1)}`,
        id: Math.max(0.5, id),
        startX: this.cursor.x,
        startY: this.cursor.y,
      };
      this.resetScoopVisorPosition();
    } else if (this.level === 3) {
      this.buildSpiral(cx, cy, Math.min(safeW, playBottom - safeTop) * 0.4);
      this.resetScoopVisorPosition();
    } else if (this.level === 7) {
      this.spawnReadingTrial(safeLeft, safeTop, safeRight, playBottom, isMobile);
      this.resetScoopVisorPosition();
    }
    this.enforceOnScreenGuard();
  }

  buildSpiral(cx, cy, maxR) {
    const pts = [];
    const turns = 2.2;
    const steps = 150;
    const safeMaxR = Math.max(55, maxR);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      // Rotate phase so outer GOAL (u=1) lands right at the 12 o'clock top (-PI/2)
      const theta = u * turns * Math.PI * 2 - turns * Math.PI * 2 - Math.PI / 2;
      const rad = 20 + u * (safeMaxR - 20);
      const tw = Math.max(14, (30 - u * 12) * this.reading.uiFontScale);
      pts.push({ x: cx + rad * Math.cos(theta), y: cy + rad * Math.sin(theta), w: tw });
    }
    this.spiral = {
      active: false,
      progress: 0,
      startTime: 0,
      insideSamples: 0,
      totalSamples: 0,
      path: pts,
    };
    this.target = null;
  }

  spawnReadingTrial(safeLeft, safeTop, safeRight, playBottom, isMobile) {
    const st = this.reading.getCurrentStageConfig();
    const item = st.items[Math.floor(Math.random() * st.items.length)];
    this.activeReadingItem = item;
    this.voiceEngine.speakReadingItem(item, 'ASKING');

    const safeW = safeRight - safeLeft;
    const safeH = playBottom - safeTop;
    const promptReserveH = Math.min(
      safeH * 0.3,
      Math.round((isMobile ? 74 : 96) * this.reading.uiFontScale),
    );
    const minTargetY = safeTop + promptReserveH;
    const availH = Math.max(80, playBottom - minTargetY);

    const baseR = Math.max(
      18,
      Math.min(
        Math.min(safeW, availH) * 0.14,
        Math.round((st.id >= 5 ? 36 : 30) * this.reading.uiFontScale),
      ),
    );
    const allTexts = [item.target, ...item.distractors];
    this.readingTargets = [];

    for (let i = 0; i < allTexts.length; i++) {
      let tx = safeLeft + safeW / 2;
      let ty = minTargetY + availH / 2;
      const m = baseR + 8;
      for (let a = 0; a < 40; a++) {
        tx = safeLeft + m + Math.random() * Math.max(20, safeW - 2 * m);
        ty = minTargetY + m + Math.random() * Math.max(20, availH - 2 * m);
        if (this.readingTargets.every((o) => Math.hypot(tx - o.x, ty - o.y) > baseR * 2.35)) break;
      }
      this.readingTargets.push({
        text: allTexts[i],
        isTarget: i === 0,
        x: tx,
        y: ty,
        r: baseR,
      });
    }
    this.target = this.readingTargets[0];
  }

  handleArenaClick(x, y, now) {
    if (this.level === 1) {
      if (this.l1Mode === 'zero' && this.target) {
        const d = Math.hypot(x - this.target.x, y - this.target.y);
        if (d <= this.target.r * 1.45) {
          if (this.l1WaitState === 'WAITING') {
            clearTimeout(this.l1WaitTimer);
            const elapsedWait = now - this.l1WaitStartMs;
            this.fpEngine.recordPrematureClick(
              elapsedWait,
              this.l1WaitAssignedMs,
              this.target.fpDist,
            );
            this.voiceEngine.playPreset('TSSJJ');
            const impEl = document.getElementById('pillImpulse');
            if (impEl) impEl.textContent = String(this.fpEngine.prematureCount);
            this.showToast(
              '⚡ PREMATURE IMPULSE LOGGED',
              `Tapped after ${Math.round(elapsedWait)}ms (assigned ${this.l1WaitAssignedMs}ms). Preserved!`,
              'border-rose-500',
            );
            this.spawnForCurrentLevel();
          } else if (this.l1WaitState === 'READY_GREEN') {
            const rt = Math.max(25, now - this.l1GreenTimestamp);
            const hw = Math.round(this.telemetry.inputToPhotonMs);
            const brain = Math.max(20, Math.round(rt - hw));
            if (rt < 2500) {
              this.telemetry.rt0BaselineMs = 0.78 * this.telemetry.rt0BaselineMs + 0.22 * rt;
            }
            this.fpEngine.recordValidHit(this.target.tw, rt, this.target.fpDist);
            this.voiceEngine.playPreset(rt < 260 ? 'FROG_SKEEE' : 'CHICKEN_TOK');

            const lockEl = document.getElementById('pillEntrain');
            if (lockEl) lockEl.textContent = `${this.fpEngine.entrainmentLockScore}%`;

            const radialErrPx = Number(d.toFixed(1));
            const normRadiusPct = Number(Math.min(1.0, d / Math.max(8, this.target.r)).toFixed(3));
            const hitAngleRad = Number(Math.atan2(y - this.target.y, x - this.target.x).toFixed(2));

            this.goalMemory.stageUnfadedStreak++;
            this.goalMemory.autoStreak++;

            this.telemetry.addTrial({
              id: 0.15,
              mt: rt,
              hw,
              brain,
              ballistic: 0,
              homing: 0,
              dockInspectionMs: Math.round(this.currentTrialDockMs),
              gestureTagged: this.currentTrialGesture,
              tw: this.target.tw,
              fpDist: this.target.fpDist,
              radialErrPx,
              normRadiusPct,
              hitAngleRad,
              goalPeeks: this.goalMemory.trialPeekCount,
              goalHoverMs: Math.round(this.goalMemory.trialHoverMs),
              goalMemoryMode: this.goalMemory.mode,
            });

            this.persistence.saveToBrowser(this);
            if (!this.advanceEnvelopeTutor()) {
              this.spawnForCurrentLevel();
            }
          }
        }
      } else if (this.l1Mode === 'shrink' && this.target) {
        const d = Math.hypot(x - this.target.x, y - this.target.y);
        if (d <= this.target.r * 1.25) {
          this.recordPointingSuccess(now, this.target.id, x, y, this.target);
          this.voiceEngine.playPreset(d < this.target.r * 0.3 ? 'OH_WOOW' : 'CHICKEN_TOK');
          this.shrinkRadius = this.shrinkRadius > 14 ? Math.max(12, this.shrinkRadius * 0.84) : 78;
          this.goalMemory.stageUnfadedStreak++;
          this.goalMemory.autoStreak++;
          this.persistence.saveToBrowser(this);
          if (!this.advanceEnvelopeTutor()) {
            this.spawnForCurrentLevel();
          }
        }
      }
    } else if (this.level === 2 && this.target) {
      const d = Math.hypot(x - this.target.x, y - this.target.y);
      const hit =
        this.l2Shape === 'circle'
          ? d <= this.target.r * 1.25
          : Math.abs(x - this.target.x) <= this.target.r * 1.25 &&
            Math.abs(y - this.target.y) <= this.target.r * 1.25;
      if (hit) {
        this.recordPointingSuccess(now, this.target.id, x, y, this.target);
        this.voiceEngine.playPreset(d < this.target.r * 0.3 ? 'OH_WOOW' : 'FROG_SKEEE');
        this.goalMemory.stageUnfadedStreak++;
        this.goalMemory.autoStreak++;
        this.persistence.saveToBrowser(this);
        if (!this.advanceEnvelopeTutor()) {
          this.spawnForCurrentLevel();
        }
      }
    } else if (this.level === 3 && this.spiral.path.length > 0) {
      const startPt = this.spiral.path[0];
      if (!this.spiral.active && Math.hypot(x - startPt.x, y - startPt.y) <= startPt.w * 1.6) {
        this.spiral.active = true;
        this.spiral.startTime = now;
        this.spiral.progress = 0;
        this.spiral.insideSamples = 1;
        this.spiral.totalSamples = 1;
        this.trialStartTime = now;
      }
    } else if (this.level === 7) {
      for (const rt of this.readingTargets) {
        const d = Math.hypot(x - rt.x, y - rt.y);
        if (d <= rt.r * 1.28) {
          const mt = Math.max(80, now - this.trialStartTime);
          const hw = Math.round(this.telemetry.inputToPhotonMs);
          const brain =
            this.moveOnsetTime > this.trialStartTime
              ? Math.max(70, Math.round(this.moveOnsetTime - this.trialStartTime - hw))
              : Math.round(Math.min(mt * 0.42, this.telemetry.rt0BaselineMs + 160));

          let maxPull = 0;
          const distractors = this.readingTargets.filter((item) => !item.isTarget);
          for (const p of this.trail.slice(-25)) {
            for (const distItem of distractors) {
              const distD = Math.hypot(p.x - distItem.x, p.y - distItem.y);
              if (distD < 95) maxPull = Math.max(maxPull, 95 - distD);
            }
          }

          const status = this.reading.evaluateTrial(rt.isTarget, brain, maxPull, mt);
          document.getElementById('navReadBadge').textContent = `S${this.reading.stage}`;
          document.getElementById('l7StageName').textContent =
            this.reading.getCurrentStageConfig().name;

          if (rt.isTarget) {
            const jokeSub = this.voiceEngine.speakGraphemeOrWord(rt.text, 'CELEBRATE');
            if (this.semanticMorphEnabled && this.activeReadingItem) {
              this.activeMorphs.push({
                x: rt.x,
                y: rt.y,
                r: rt.r,
                startTime: now,
                durationMs: 1350,
                semanticKey: this.activeReadingItem.morph || 'BALL',
                label: jokeSub || this.activeReadingItem.morphLabel || rt.text,
                gazeDwellMs: 0,
              });
            }
            this.goalMemory.stageUnfadedStreak++;
            this.goalMemory.autoStreak++;

            if (status === 'PROMOTED') {
              this.goalMemory.stageUnfadedStreak = 0;
              this.goalMemory.calmFadeUnlocked = false;
              this.showToast(
                `🎉 PROMOTED TO STAGE ${this.reading.stage}!`,
                this.reading.getCurrentStageConfig().name,
                'border-emerald-400',
              );
            }

            const startX = this.trialStartPos ? this.trialStartPos.x : x;
            const startY = this.trialStartPos ? this.trialStartPos.y : y;
            const chord = Math.max(30, Math.hypot(rt.x - startX, rt.y - startY));
            const id = Math.log2(chord / (2 * rt.r) + 1);
            this.recordPointingSuccess(now, id, x, y, rt);
            this.persistence.saveToBrowser(this);
            if (!this.advanceEnvelopeTutor()) {
              this.spawnForCurrentLevel();
            }
          } else {
            // Distractor hit: reset fade streak so Top Goal re-illuminates steadily to scaffold the learner
            this.voiceEngine.speakDistractorBump(rt.text);
            this.goalMemory.autoStreak = 0;
            this.goalMemory.stageUnfadedStreak = 0;
            this.goalMemory.calmFadeUnlocked = false;
            this.goalMemory.revealAlpha = 1.0;
            this.configureGoalMemoryParameters();
            this.syncStageUI();
            this.showToast(
              `🛡️ TRY AGAIN: Look for "${this.activeReadingItem ? this.activeReadingItem.target : ''}"`,
              'Top goal re-illuminated steadily to help!',
              'border-amber-400',
            );
          }
          break;
        }
      }
    }
  }

  recordPointingSuccess(now, id, clickX, clickY, targetObj) {
    const mt = Math.max(60, now - this.trialStartTime);
    const hw = Math.round(this.telemetry.inputToPhotonMs);
    let brain =
      this.moveOnsetTime > this.trialStartTime
        ? Math.round(this.moveOnsetTime - this.trialStartTime - hw)
        : Math.round(Math.min(mt * 0.35, this.telemetry.rt0BaselineMs));
    brain = Math.max(70, Math.min(mt - 40, brain));

    const motorTime = Math.max(30, mt - hw - brain);
    let ballistic = Math.round(motorTime * 0.45);
    if (this.decelOnsetTime > this.moveOnsetTime && this.decelOnsetTime < now) {
      ballistic = Math.round(
        Math.max(45, Math.min(motorTime * 0.85, this.decelOnsetTime - this.moveOnsetTime)),
      );
    }
    const homing = Math.max(10, Math.round(motorTime - ballistic));

    const tx = targetObj ? targetObj.x : clickX;
    const ty = targetObj ? targetObj.y : clickY;
    const tr = targetObj ? Math.max(8, targetObj.r) : 30;
    const radialErrPx = Number(Math.hypot(clickX - tx, clickY - ty).toFixed(1));
    const normRadiusPct = Number(Math.min(1.0, radialErrPx / tr).toFixed(3));
    const hitAngleRad = Number(Math.atan2(clickY - ty, clickX - tx).toFixed(2));

    this.telemetry.lastRadialErrPx = radialErrPx;
    this.telemetry.addTrial({
      id: Number(id.toFixed(3)),
      mt,
      hw,
      brain,
      ballistic,
      homing,
      dockInspectionMs: Math.round(this.currentTrialDockMs),
      gestureTagged: this.currentTrialGesture,
      radialErrPx,
      normRadiusPct,
      hitAngleRad,
      goalPeeks: this.goalMemory.trialPeekCount,
      goalHoverMs: Math.round(this.goalMemory.trialHoverMs),
      goalMemoryMode: this.goalMemory.mode,
      semanticMorphActive: this.semanticMorphEnabled,
    });
  }

  updateSpiralProgress(now) {
    const path = this.spiral.path;
    if (!path || path.length === 0) return;
    let bestIdx = this.spiral.progress;
    let bestDist = Infinity;
    const limit = Math.min(path.length - 1, this.spiral.progress + 18);
    for (let i = Math.max(0, this.spiral.progress - 3); i <= limit; i++) {
      const d = Math.hypot(this.cursor.x - path[i].x, this.cursor.y - path[i].y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    this.spiral.progress = Math.max(this.spiral.progress, bestIdx);
    this.spiral.totalSamples++;
    if (bestDist <= path[this.spiral.progress].w) {
      this.spiral.insideSamples++;
    }
    if (this.spiral.progress >= path.length - 2) {
      this.spiral.active = false;
      const mt = Math.max(300, now - this.spiral.startTime);
      const hw = Math.round(this.telemetry.inputToPhotonMs);
      const brain = Math.round(Math.min(mt * 0.25, this.telemetry.rt0BaselineMs));
      const rem = Math.max(40, mt - hw - brain);
      this.voiceEngine.playPreset('FROG_SKEEE');
      this.telemetry.addTrial({
        id: 6.8,
        mt,
        hw,
        brain,
        ballistic: Math.round(rem * 0.52),
        homing: Math.round(rem * 0.48),
        dockInspectionMs: Math.round(this.currentTrialDockMs),
        normRadiusPct: 0.2,
        hitAngleRad: 0,
      });
      this.persistence.saveToBrowser(this);
      setTimeout(() => {
        if (!this.advanceEnvelopeTutor()) {
          this.spawnForCurrentLevel();
        }
      }, 320);
    }
  }

  buildPayloadObject() {
    const ts = TimeStampUtil.nowPacket();
    const guiElementsArr = [];
    for (const g of this.guiEngine.registry.values()) {
      guiElementsArr.push({
        id: g.id,
        label: g.label,
        liveShannonID: Number(g.liveID.toFixed(2)),
        dwellMs: Math.round(g.dwellMs),
        eyeProxyReadingScanMs: Math.round(g.gazeScanMs),
        visits: g.visits,
        clicks: g.clicks,
        doodles: g.doodles,
        struggleRatio: g.struggleRatio,
        adaptedScale: Number(g.scale.toFixed(2)),
      });
    }
    return {
      gitCheckpointMeta: GIT_CHECKPOINT_META,
      unixTimestampMs: ts.unixMs,
      perfNowMicroseconds: ts.perfNowUs,
      timestampISO: ts.iso,
      longitudinalPersistence: {
        sessionNumber: this.persistence.sessionNumber,
        returnGapMinutes: Number(this.persistence.returnGapMinutes.toFixed(2)),
        progressionDeltaReport: this.persistence.progressionDeltaReport,
        previousSessionSummary: this.persistence.previousSessionSummary,
        semanticMorphEnabled: this.semanticMorphEnabled,
        semanticMorphRewardGazeDwellMs: Math.round(this.persistence.morphRewardDwellMs),
      },
      deviceClassification:
        this.telemetry.estimatedHz >= 115
          ? 'High-Rate USB Gaming Mouse'
          : 'Mouse / Trackpad • ~90Hz VSync/Touch',
      estimatedPollingHz: this.telemetry.estimatedHz,
      pollingJitterMs: Number(this.telemetry.jitterMs.toFixed(2)),
      inputToPhotonLagMs: Number(this.telemetry.inputToPhotonMs.toFixed(2)),
      calibratedGroundTruthRT0Ms: Math.round(this.telemetry.rt0BaselineMs),
      multiManifoldRegression: {
        a: Math.round(this.telemetry.regTotal.a),
        b: Math.round(this.telemetry.regTotal.b),
        tpTotal: this.telemetry.regTotal.tp.toFixed(2),
        tpMotor: this.telemetry.regMotor.tp.toFixed(2),
      },
      putForeperiodAnalysis: {
        mode: this.fpEngine.mode,
        activeDistribution: this.fpEngine.activeDist,
        entrainmentLockScore: this.fpEngine.entrainmentLockScore,
        prematureImpulseCount: this.fpEngine.prematureCount,
        exGaussianStats: this.fpEngine.computeStats(),
        records: this.fpEngine.records,
      },
      guiElementAffordanceAndDoodles: {
        totalDoodles: this.guiEngine.totalDoodleEvents,
        orbitCount: this.guiEngine.orbitCount,
        underlineCount: this.guiEngine.underlineCount,
        scratchCount: this.guiEngine.scratchCount,
        hesitationCount: this.guiEngine.hesitationCount,
        elements: guiElementsArr,
      },
      goalWorkingMemoryAnalysis: {
        mode: this.goalMemory.mode,
        initialShowMs: this.goalMemory.initialShowMs,
        cloakTargets: this.goalMemory.cloakTargets,
        totalGoalRePeeks: this.telemetry.goalPeekCount,
        totalGoalHoverRecallMs: Math.round(this.telemetry.totalGoalHoverMs),
        autoProgressionStreak: this.goalMemory.autoStreak,
      },
      embodiedGestures: this.gesture.counts,
      adaptiveReadingStage: this.reading.stage,
      signature100Metrics: this.sig100.metrics,
      trials: this.telemetry.trials,
    };
  }

  openJsonInspectorModal(autoCopy = true) {
    this.persistence.saveToBrowser(this);
    const payload = this.buildPayloadObject();
    const jsonStr = JSON.stringify(payload, null, 2);

    const modal = document.getElementById('jsonInspectorModal');
    const ta = document.getElementById('jsonModalTextarea');
    const sum = document.getElementById('jsonModalSummary');
    const cards = document.getElementById('jsonModalCards');

    if (sum) {
      sum.textContent = `Session #${this.persistence.sessionNumber} • ${payload.trials.length} Trials • Reading Stage ${this.reading.stage}/6 • Hit Offset ${(this.telemetry.meanNormRadiusPct * 100).toFixed(1)}% R • We/W=${this.telemetry.effectiveWidthRatio.toFixed(2)}x`;
    }
    if (cards) {
      cards.innerHTML = `
            <div class="bg-slate-950 border border-slate-800 rounded p-2 text-xs mono">
              <div class="text-slate-400">UNIX TIMESTAMP</div>
              <div class="text-emerald-300 font-bold">${payload.unixTimestampMs}</div>
            </div>
            <div class="bg-slate-950 border border-slate-800 rounded p-2 text-xs mono">
              <div class="text-slate-400">TRIALS &amp; STAGE</div>
              <div class="text-cyan-300 font-bold">${payload.trials.length} Trials • Stage ${this.reading.stage}/6</div>
            </div>
            <div class="bg-slate-950 border border-slate-800 rounded p-2 text-xs mono">
              <div class="text-slate-400">CENTER BIAS (We/W)</div>
              <div class="text-amber-300 font-bold">${(this.telemetry.meanNormRadiusPct * 100).toFixed(1)}% R (${this.telemetry.effectiveWidthRatio.toFixed(2)}x)</div>
            </div>
            <div class="bg-slate-950 border border-slate-800 rounded p-2 text-xs mono">
              <div class="text-slate-400">VOICE &amp; MORPH DWELL</div>
              <div class="text-purple-300 font-bold">${this.voiceEngine.utteranceCount} Utter • ${Math.round(this.persistence.morphRewardDwellMs)}ms</div>
            </div>
          `;
    }
    if (ta) {
      ta.value = jsonStr;
    }
    if (modal) {
      modal.classList.remove('hidden');
    }
    if (ta) {
      ta.focus();
      ta.select();
    }
    if (autoCopy) {
      this.copyJSONToClipboard(false);
    }
  }

  copyJSONToClipboard(showToastMsg = true) {
    const payload = this.buildPayloadObject();
    const jsonStr = JSON.stringify(payload, null, 2);
    const ta = document.getElementById('jsonModalTextarea');
    if (ta && !document.getElementById('jsonInspectorModal').classList.contains('hidden')) {
      ta.value = jsonStr;
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
      } catch (_) {}
    } else {
      const tempTa = document.createElement('textarea');
      tempTa.value = jsonStr;
      tempTa.style.position = 'fixed';
      tempTa.style.left = '-9999px';
      document.body.appendChild(tempTa);
      tempTa.select();
      try {
        document.execCommand('copy');
      } catch (_) {}
      document.body.removeChild(tempTa);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).catch(() => {});
    }
    if (showToastMsg) {
      this.showToast(
        '📋 JSON COPIED TO CLIPBOARD!',
        `Copied ${payload.trials.length} trials & 100 metrics (${Math.round(jsonStr.length / 1024)} KB). Paste directly into chat!`,
        'border-emerald-400',
      );
    }
  }

  exportJSON() {
    const payload = this.buildPayloadObject();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hci-ground-truth-${payload.unixTimestampMs}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 3000);
  }

  loop(now) {
    this.enforceOnScreenGuard();

    if (now - this.lastFrameTime > 95) {
      this.telemetry.computeFFT();
      this.sig100.computeAll(
        this.telemetry,
        this.gesture,
        this.reading,
        this.drawerState,
        this.fpEngine,
        this.guiEngine,
      );
      if (this.drawerState === 2) {
        this.update100MetricDOM();
        this.updateGuiRegistryDOM();
      }
      this.updateTextTelemetry();
      this.lastFrameTime = now;
    }

    this.renderArena(now);
    this.guiEngine.renderOverlay(
      this.overlayCtx,
      window.innerWidth || 800,
      window.innerHeight || 600,
      this.winCursor,
    );
    if (this.drawerState >= 1) {
      this.renderScope1();
      this.renderScope2();
      this.renderScope3();
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  updateTextTelemetry() {
    const fpStats = this.fpEngine.computeStats();
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('sumRt0', `${Math.round(this.telemetry.rt0BaselineMs)}ms`);
    setTxt('sumMu', `${fpStats.mu}ms`);
    setTxt('sumTau', `${fpStats.tau}ms`);
    setTxt('sumGuiGaze', this.guiEngine.activeFocusId);

    setTxt('hdrCenterBias', `${Math.round(this.telemetry.meanNormRadiusPct * 100)}% R`);
    setTxt('hdrViewID', `+${this.telemetry.selfImposedTaxBits.toFixed(1)}b`);

    setTxt(
      'scope1Stat',
      `${this.telemetry.estimatedHz} Hz (±${this.telemetry.jitterMs.toFixed(1)}ms)`,
    );
    setTxt('s1Coalesced', `${this.telemetry.coalescedRatio.toFixed(1)}x`);
    setTxt('s1Dwell', `${Math.round(this.telemetry.lastDwellMs)}ms`);
    setTxt('s1Slip', `${this.telemetry.lastSlipPx.toFixed(1)}px`);

    setTxt('scope2Stat', `Peak: ${this.telemetry.peakFreqHz.toFixed(1)} Hz`);
    setTxt('fftBandLow', `${this.telemetry.bandLow.toFixed(1)}%`);
    setTxt('fftBandTremor', `${this.telemetry.bandTremor.toFixed(1)}%`);
    setTxt('fftBandNoise', `${this.telemetry.bandNoise.toFixed(1)}%`);

    setTxt('s3Mu', `${Math.round(this.telemetry.meanNormRadiusPct * 100)}% R`);
    setTxt('s3Tau', `${this.telemetry.effectiveWidthRatio.toFixed(2)}x`);
    setTxt('s3Slope', `+${this.telemetry.selfImposedTaxBits.toFixed(2)} bits`);
    setTxt('s3False', `${this.telemetry.trials.length} Kept`);
    setTxt('scope4Badge', `${this.telemetry.trials.length} Trials`);

    const last = this.telemetry.trials[this.telemetry.trials.length - 1];
    if (last) {
      const tot = Math.max(1, last.hw + last.brain + last.ballistic + last.homing);
      const barHw = document.getElementById('barHw');
      const barBrain = document.getElementById('barBrain');
      const barBal = document.getElementById('barBallistic');
      const barHom = document.getElementById('barHoming');
      if (barHw) barHw.style.width = `${(last.hw / tot) * 100}%`;
      if (barBrain) barBrain.style.width = `${(last.brain / tot) * 100}%`;
      if (barBal) barBal.style.width = `${(last.ballistic / tot) * 100}%`;
      if (barHom) barHom.style.width = `${(last.homing / tot) * 100}%`;
      setTxt('lblHw', `${last.hw}ms`);
      setTxt('lblBrain', `${last.brain}ms`);
      setTxt('lblBallistic', `${last.ballistic}ms`);
      setTxt('lblHoming', `${last.homing}ms`);
    }
  }

  renderArena(now) {
    const ctx = this.ctx;
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
    } = this.getSafeArenaCenter();
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
    const gm = this.goalMemory;
    const elapsedTrial = Math.max(0, now - this.trialStartTime);
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
    this.telemetry.memoryDecayAlpha = gm.revealAlpha;

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
    if (this.level === 1 && this.l1Mode === 'shrink') {
      goalBannerText = '🎯 GOAL: Drag Scoop-Visor & Lift to Drop on Shrinking Circle!';
    } else if (this.level === 2) {
      goalBannerText = '🎯 GOAL: Drag Scoop-Visor to Target & Lift Finger to Drop!';
    } else if (this.level === 3) {
      goalBannerText = "🎯 GOAL: Steer Through the Spiral Tunnel to the Top 12 o'clock GOAL!";
    } else if (this.level === 7 && this.activeReadingItem) {
      goalBannerText = `🎯 FIND & DROP ON: "${this.activeReadingItem.target}"  —  ${this.activeReadingItem.cue}`;
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
    if (!this.voiceEngine.enabled) {
      const pillW = Math.min(safeW - 12, isMobile ? 280 : 340);
      const pillH = 26;
      const pillX = cx - pillW / 2;
      const pillY = bannerY + bannerH + 4;
      this.audioPromptRect = { x: pillX, y: pillY, w: pillW, h: pillH };

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
      this.audioPromptRect = null;
    }

    // 5. Render Level 1 or Level 2 Target (With Bullseye / Rim-Graze Affordance Rings)
    if ((this.level === 1 || this.level === 2) && this.target) {
      const t = this.target;
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

      if (this.level === 1 && this.l1Mode === 'zero' && this.l1WaitState === 'WAITING') {
        const elapsed = now - this.l1WaitStartMs;
        const prog = Math.min(1, elapsed / Math.max(1, this.l1WaitAssignedMs));
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
        !(this.level === 1 && this.l1Mode === 'zero')
      ) {
        ctx.globalAlpha = Math.max(0.18, gm.revealAlpha);
      }

      ctx.fillStyle = t.color;
      ctx.beginPath();
      if (this.level === 2 && this.l2Shape === 'square') {
        ctx.rect(t.x - safeR, t.y - safeR, safeR * 2, safeR * 2);
      } else {
        ctx.arc(t.x, t.y, safeR, 0, Math.PI * 2);
      }
      ctx.fill();

      // Aim-Strategy Visual Rings (Bullseye Core <30% R vs Speed Rim-Graze 70-100% R)
      if (this.telemetry.aimStrategy === 'BULLSEYE') {
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, safeR * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (this.telemetry.aimStrategy === 'RIM_GRAZE') {
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
      ctx.font = `bold ${Math.round(13 * this.reading.uiFontScale)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.label || '', t.x, t.y - (t.subLabel ? 7 : 0));
      if (t.subLabel) {
        ctx.font = `${Math.round(10 * this.reading.uiFontScale)}px ui-monospace, monospace`;
        ctx.fillText(t.subLabel, t.x, t.y + 10);
      }
      ctx.restore();
    }

    // 6. Render Level 3 Spiral Tunnel
    if (this.level === 3 && this.spiral.path.length > 0) {
      const path = this.spiral.path;
      for (let i = 1; i < path.length; i++) {
        const p0 = path[i - 1],
          p1 = path[i];
        ctx.strokeStyle =
          i <= this.spiral.progress ? 'rgba(16, 185, 129, 0.42)' : 'rgba(30, 41, 59, 0.85)';
        ctx.lineWidth = p1.w * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      const s = path[0],
        e = path[path.length - 1];
      ctx.fillStyle = this.spiral.active ? '#06b6d4' : '#10b981';
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(10, s.w), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#020617';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.spiral.active ? 'GO' : 'START', s.x, s.y);

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(e.x, e.y, Math.max(10, e.w), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#020617';
      ctx.fillText('GOAL', e.x, e.y);
    }

    // 7. Render Level 7 Adaptive Reading Arena (Giant Single-Letter Focal Badge at Top + Target Bubbles Below)
    if (this.level === 7 && this.activeReadingItem) {
      const cardW = Math.min(
        safeW - 16,
        Math.round((isMobile ? 210 : 260) * this.reading.uiFontScale),
      );
      const cardH = Math.round((isMobile ? 64 : 78) * this.reading.uiFontScale);
      const cardX = cx - cardW / 2;
      const cardY = safeTop + (this.audioPromptRect ? 28 : 4);

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
        ctx.font = `800 ${Math.round((isMobile ? 34 : 44) * this.reading.uiFontScale)}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.activeReadingItem.target, cx, cardY + cardH * 0.44);

        ctx.fillStyle = '#94a3b8';
        ctx.font = `${Math.round(11 * this.reading.uiFontScale)}px ui-monospace, monospace`;
        ctx.fillText(this.activeReadingItem.cue, cx, cardY + cardH * 0.84);
        ctx.restore();
      }

      for (const rt of this.readingTargets) {
        const isLocked =
          this.scoopVisor.hoveredCandidate && this.scoopVisor.hoveredCandidate.obj === rt;
        ctx.save();
        ctx.fillStyle = isLocked ? 'rgba(6, 78, 59, 0.95)' : 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = isLocked ? '#10b981' : '#475569';
        ctx.lineWidth = isLocked ? 3 : 2;
        ctx.beginPath();
        ctx.arc(rt.x, rt.y, Math.max(14, rt.r), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold ${Math.round(18 * this.reading.uiFontScale)}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rt.text, rt.x, rt.y);
        ctx.restore();
      }
    }

    // 8. Render Celebratory Clean Circle -> Semantic SVG Morphs & Track 60Hz Gaze Dwell (M097)
    for (let i = this.activeMorphs.length - 1; i >= 0; i--) {
      const m = this.activeMorphs[i];
      const elapsed = now - m.startTime;
      if (elapsed > m.durationMs) {
        this.activeMorphs.splice(i, 1);
        continue;
      }
      const prog = elapsed / m.durationMs;
      SemanticMorphEngine.renderMorph(ctx, m.x, m.y, m.r, prog, m.semanticKey, m.label);

      const distToMorph = Math.hypot(this.cursor.x - m.x, this.cursor.y - m.y);
      if (distToMorph <= m.r * 1.75) {
        m.gazeDwellMs += 16.6;
        this.persistence.morphRewardDwellMs += 16.6;
      }
    }

    // 9. Render Active Embodied Gesture Ribbon
    if (this.gesture.activeRibbon.length > 1) {
      ctx.save();
      ctx.strokeStyle = this.gesture.ribbonColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < this.gesture.activeRibbon.length; i++) {
        const p = this.gesture.activeRibbon[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        p.alpha -= 0.015;
      }
      ctx.stroke();
      ctx.restore();
      if (this.gesture.activeRibbon[0].alpha <= 0) this.gesture.activeRibbon = [];
    }

    // 10. Render Kinematic Cursor Trail
    for (let i = 1; i < this.trail.length; i++) {
      const p0 = this.trail[i - 1],
        p1 = this.trail[i];
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
    if (this.scoopVisor.enabled && !(this.level === 1 && this.l1Mode === 'zero')) {
      this.renderScoopVisorRig(ctx, now);
    }
  }

  /**
   * CLEAN DOM-CLONE STANDALONE HTML BUILDER (`buildCleanStandaloneHtmlString`):
   * Returns the sanitized, self-contained HTML string with your current state baked inside.
   */
  buildCleanStandaloneHtmlString() {
    const savedState = this.persistence.saveToBrowser(this);
    const docClone = document.documentElement.cloneNode(true);

    const oldBaked = docClone.querySelector('#bakedTillmannState');
    if (oldBaked) oldBaked.remove();

    ['#jsonInspectorModal', '#cloudShareModal', '#gestureToast'].forEach((sel) => {
      const el = docClone.querySelector(sel);
      if (el) el.classList.add('hidden');
    });

    const drawerClone = docClone.querySelector('#telemetryDrawer');
    if (drawerClone) {
      drawerClone.dataset.state = '0';
      drawerClone.classList.remove('proximity-glow');
    }

    ['#metrics100Grid', '#guiElementsGrid', '#jsonModalCards'].forEach((sel) => {
      const el = docClone.querySelector(sel);
      if (el) el.innerHTML = '';
    });

    const taClone = docClone.querySelector('#jsonModalTextarea');
    if (taClone) taClone.value = '';

    const audioBtnClone = docClone.querySelector('#btnHeroAudio');
    if (audioBtnClone) audioBtnClone.classList.add('audio-on');
    const audioIconClone = docClone.querySelector('#heroAudioIcon');
    if (audioIconClone) audioIconClone.textContent = '🔊';
    const audioTextClone = docClone.querySelector('#heroAudioText');
    if (audioTextClone) audioTextClone.textContent = 'VOICE: READY!';

    const fsTextClone = docClone.querySelector('#fsText');
    if (fsTextClone) fsTextClone.textContent = 'FULL';

    docClone.querySelectorAll('canvas').forEach((c) => {
      c.removeAttribute('width');
      c.removeAttribute('height');
    });

    const safeJson = JSON.stringify(savedState).replace(/</g, '\\u003c');
    const stateScriptEl = document.createElement('script');
    stateScriptEl.id = 'bakedTillmannState';
    stateScriptEl.textContent = `window.__BAKED_TILLMANN_STATE__ = ${safeJson};`;

    const headClone = docClone.querySelector('head');
    if (headClone) {
      headClone.insertBefore(stateScriptEl, headClone.firstChild);
    }

    return '<!DOCTYPE html>\n' + docClone.outerHTML;
  }

  /**
   * Attempts True Hardware OS Fullscreen (`requestFullscreen`).
   * If running inside Google Sites' nested iframe where `allowfullscreen` is stripped by Google's Caja/Atari wrapper,
   * automatically breaks out into a 100% borderless standalone Blob tab with current state preserved!
   */
  async toggleTrueFullscreenOrBreakout() {
    const docEl = document.documentElement;
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);

    if (isFs) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } catch (_) {}
      return;
    }

    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen({ navigationUI: 'hide' });
        this.showToast(
          '⛶ TRUE OS FULLSCREEN ACTIVE!',
          '100% borderless ground-truth arena locked.',
          'border-purple-400',
        );
        return;
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
        return;
      }
    } catch (err) {
      // Google Sites outer iframe blocked requestFullscreen(): pop out into a 100% borderless tab!
      this.popoutBorderlessWindow();
      return;
    }

    // Fallback check if browser silently ignored requestFullscreen inside iframe
    setTimeout(() => {
      const nowFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      if (!nowFs) {
        this.popoutBorderlessWindow();
      }
    }, 180);
  }

  /**
   * Breaks out of a bordered iframe (such as a standard Google Sites embed box)
   * into a 100% borderless full-viewport standalone window with all current trials & progress baked in.
   */
  popoutBorderlessWindow() {
    const fullHtml = this.buildCleanStandaloneHtmlString();
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (win) {
      this.showToast(
        '🚀 OPENED 100% BORDERLESS FULLSCREEN TAB!',
        'Google Sites iframe blocked hardware Fullscreen, so we launched a borderless full-viewport tab with your state!',
        'border-purple-400',
      );
    } else {
      document.getElementById('cloudShareModal').classList.remove('hidden');
      this.showToast(
        'ℹ️ ENABLE "FULL PAGE EMBED" IN GOOGLE SITES',
        'See Fix 1 in the modal to make your Google Sites page 100% edge-to-edge without borders!',
        'border-amber-400',
      );
    }
  }

  exportStandaloneHTMLApp() {
    const fullHtml = this.buildCleanStandaloneHtmlString();

    const hasValidClosing =
      fullHtml.includes('window.labApp = new LabApp()') && fullHtml.endsWith('</html>');
    if (!hasValidClosing) {
      this.showToast(
        '⚠️ HTML PACKAGER ERROR',
        'Generated HTML failed integrity check.',
        'border-rose-500',
      );
      return;
    }

    // Named `index.html` by default so you can upload it directly to GitHub Pages (`username.github.io/tillmanreader/`)!
    const fileName = 'index.html';
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 5000);

    this.showToast(
      `✅ GITHUB PAGES index.html (${Math.round(fullHtml.length / 1024)} KB) DOWNLOADED!`,
      `Drop "index.html" into your GitHub repo to launch immediately into Tillmann Reader!`,
      'border-emerald-400',
    );
  }

  /**
   * Packages and downloads a complete VS Code TypeScript + HTML + README + JSON .ZIP archive
   * (`tillmann-reader-vscode-ts.zip`) using our in-memory CRC32 PKZIP generator.
   */
  exportVsCodeZipProject() {
    try {
      const payload = this.buildPayloadObject();
      const fullHtml = this.buildCleanStandaloneHtmlString();
      const readmeMd = VSCodeProjectScaffold.buildReadme(payload);
      const pkgJson = VSCodeProjectScaffold.buildPackageJson();
      const tsConfig = VSCodeProjectScaffold.buildTsConfig();
      const typesTs = VSCodeProjectScaffold.buildTelemetryTypesTs();
      const mainTs = VSCodeProjectScaffold.buildMainTs();
      const jsonStr = JSON.stringify(payload, null, 2);

      const zip = new SimpleZipPackager();
      zip.addFile('index.html', fullHtml);
      zip.addFile('README.md', readmeMd);
      zip.addFile('package.json', pkgJson);
      zip.addFile('tsconfig.json', tsConfig);
      zip.addFile('src/types/telemetry.ts', typesTs);
      zip.addFile('src/main.ts', mainTs);
      zip.addFile('telemetry-ground-truth.json', jsonStr);

      const blob = zip.generateZipBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'tillmann-reader-vscode-ts.zip';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 5000);

      this.showToast(
        `📦 VSCODE TS + HTML + README ZIP (${Math.round(blob.size / 1024)} KB) DOWNLOADED!`,
        'Contains index.html, README.md, package.json, tsconfig.json, src/types/telemetry.ts, src/main.ts & JSON!',
        'border-amber-400',
      );
    } catch (err) {
      RuntimeWatchdog.recordError('ZIP Export: ' + err.message);
      this.showToast('⚠️ ZIP EXPORT ERROR', String(err.message), 'border-rose-500');
    }
  }

  /**
   * Renders the Anti-Fat-Finger (FFP) Offset Scoop-Visor Drag-and-Drop Rig
   */
  renderScoopVisorRig(ctx, now) {
    const sv = this.scoopVisor;
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

    if (this.level === 7 && this.activeReadingItem && this.goalMemory.revealAlpha > 0.15) {
      ctx.save();
      ctx.globalAlpha = this.goalMemory.revealAlpha;
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.activeReadingItem.target, sv.visorX, sv.visorY - vr - 13);
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

  renderScope1() {
    const ctx = this.s1Ctx;
    const w = this.s1Canvas.clientWidth || 240;
    const h = this.s1Canvas.clientHeight || 120;
    ctx.clearRect(0, 0, w, h);

    const y60 = h - (16.67 / 40) * h;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, y60);
    ctx.lineTo(w, y60);
    ctx.stroke();

    const dts = this.telemetry.dtHistory;
    if (dts.length < 2) return;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < dts.length; i++) {
      const x = (i / (dts.length - 1)) * w;
      const y = Math.max(4, h - (Math.min(40, dts[i]) / 40) * h);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  renderScope2() {
    const ctx = this.s2Ctx;
    const w = this.s2Canvas.clientWidth || 240;
    const h = this.s2Canvas.clientHeight || 120;
    ctx.clearRect(0, 0, w, h);

    const spec = this.telemetry.fftSpectrum;
    const maxVal = Math.max(10, ...spec);
    const barW = w / 48;
    for (let k = 1; k < 48; k++) {
      const ratio = spec[k] / maxVal;
      const bh = Math.max(2, ratio * (h - 10));
      ctx.fillStyle = k <= 5 ? '#10b981' : k <= 14 ? '#f59e0b' : '#f43f5e';
      ctx.fillRect((k - 1) * barW, h - bh, Math.max(1, barW - 1), bh);
    }
  }

  renderScope3() {
    if (this.scope3Mode === 'BULLSEYE_MAP') {
      document.getElementById('scope3Title').textContent = '3. Bullseye Center Bias & We Map';
      this.renderScope3BullseyeMap();
    } else if (this.scope3Mode === 'PUT_HAZARD') {
      document.getElementById('scope3Title').textContent = '3. PUT Wait tw vs RT & Hazard';
      this.renderScope3PutHazard();
    } else {
      document.getElementById('scope3Title').textContent = '3. Nominal vs Effective ID_eff Fitts';
      this.renderScope3Fitts();
    }
  }

  /**
   * Renders the Normalized Target Bullseye Hit Map (Left) + Radial Hit Density Histogram (Right)
   * proving how the user shoots for the center (We << W_nominal) vs. rim grazing.
   */
  renderScope3BullseyeMap() {
    const ctx = this.s3Ctx;
    const w = this.s3Canvas.clientWidth || 240;
    const h = this.s3Canvas.clientHeight || 120;
    ctx.clearRect(0, 0, w, h);

    const cx = Math.min(w * 0.34, h * 0.52);
    const cy = h * 0.5;
    const maxR = Math.max(24, Math.min(cx - 8, h * 0.43));

    // 1. Outer Nominal Target Boundary (100% R = W_nominal)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. 65% Mid Ring & 30% Bullseye Core Ring
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Crossman-Welford Effective Width Ring (We / W_nominal)
    const weR = Math.min(maxR, maxR * this.telemetry.effectiveWidthRatio);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, weR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 4. Plot Every Trial's Normalized Hit Coordinate (r/R, theta)
    const bins = [0, 0, 0, 0, 0]; // 0-20%, 20-40%, 40-60%, 60-80%, 80-100% R
    for (const t of this.telemetry.trials) {
      const nr = Math.min(1.0, Math.max(0.02, t.normRadiusPct || 0.22));
      const ang = t.hitAngleRad || 0;
      const bIdx = Math.min(4, Math.floor(nr * 5));
      bins[bIdx]++;

      const px = cx + nr * maxR * Math.cos(ang);
      const py = cy + nr * maxR * Math.sin(ang);
      ctx.fillStyle = nr <= 0.3 ? '#fbbf24' : nr <= 0.65 ? '#34d399' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Right Side: 5-Zone Radial Hit Histogram (Center Core -> Outer Rim)
    const histX = cx + maxR + 14;
    const histW = Math.max(50, w - histX - 8);
    const maxBin = Math.max(1, ...bins);
    const labels = ['0-20% Core', '20-40% In', '40-60% Mid', '60-80% Out', '80-100% Rim'];
    const colors = ['#fbbf24', '#10b981', '#22d3ee', '#818cf8', '#f43f5e'];
    const rowH = (h - 16) / 5;

    for (let i = 0; i < 5; i++) {
      const y = 8 + i * rowH;
      const bw = (bins[i] / maxBin) * (histW * 0.58);
      ctx.fillStyle = colors[i];
      ctx.fillRect(histX, y + 2, Math.max(2, bw), Math.max(4, rowH - 5));

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${labels[i]} (${bins[i]})`, histX + bw + 4, y + rowH / 2);
    }
  }

  renderScope3PutHazard() {
    const ctx = this.s3Ctx;
    const w = this.s3Canvas.clientWidth || 240;
    const h = this.s3Canvas.clientHeight || 120;
    ctx.clearRect(0, 0, w, h);

    const plotW = w * 0.78;
    const kdeX0 = plotW + 4;
    const kdeW = Math.max(16, w - kdeX0 - 2);

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
    ctx.beginPath();
    ctx.moveTo(plotW, 0);
    ctx.lineTo(plotW, h);
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const tw = 350 + (i / 40) * 2850;
      const haz = this.fpEngine.instantaneousHazard(tw, this.fpEngine.activeDist);
      const x = ((tw - 350) / 2850) * (plotW - 12) + 6;
      const y = h - 8 - Math.min(1, haz / 5.0) * (h - 20);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    const stats = this.fpEngine.computeStats();
    const meanY = stats.mu + stats.tau;
    const yAt500 = meanY - stats.slopeMsPerSec * 0.5;
    const yAt2800 = meanY + stats.slopeMsPerSec * 1.8;
    const mapY = (rt) => h - 8 - Math.min(1, Math.max(0, (rt - 140) / 1450)) * (h - 20);
    const mapX = (tw) => ((Math.min(3200, Math.max(350, tw)) - 350) / 2850) * (plotW - 12) + 6;

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mapX(500), mapY(yAt500));
    ctx.lineTo(mapX(2800), mapY(yAt2800));
    ctx.stroke();

    const distColor = {
      ISOCHRONOUS: '#38bdf8',
      EXPONENTIAL: '#10b981',
      UNIFORM: '#f59e0b',
      BIMODAL: '#a855f7',
      WEIBULL: '#ec4899',
    };

    for (const r of this.fpEngine.records) {
      const x = mapX(r.tw);
      const y = r.rt > 1600 ? 7 : mapY(r.rt);
      if (r.premature) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x - 3.5, y - 3.5);
        ctx.lineTo(x + 3.5, y + 3.5);
        ctx.moveTo(x + 3.5, y - 3.5);
        ctx.lineTo(x - 3.5, y + 3.5);
        ctx.stroke();
      } else {
        ctx.fillStyle = distColor[r.dist] || '#10b981';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = 'rgba(16, 185, 129, 0.24)';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(kdeX0, h - 6);
    for (let py = h - 6; py >= 6; py -= 3) {
      const rt = 140 + ((h - 8 - py) / (h - 20)) * 1450;
      const z = (rt - stats.mu) / Math.max(15, stats.sigma);
      const gauss = Math.exp(-0.5 * z * z);
      const tail = rt > stats.mu ? Math.exp(-(rt - stats.mu) / Math.max(40, stats.tau)) : 0;
      const dens = Math.min(1, 0.55 * gauss + 0.45 * tail);
      ctx.lineTo(kdeX0 + dens * kdeW, py);
    }
    ctx.lineTo(kdeX0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  renderScope3Fitts() {
    const ctx = this.s3Ctx;
    const w = this.s3Canvas.clientWidth || 240;
    const h = this.s3Canvas.clientHeight || 120;
    ctx.clearRect(0, 0, w, h);

    const maxID = 7.5;
    const linearMaxY = 4800;
    const bandH = 22;

    ctx.fillStyle = 'rgba(88, 28, 135, 0.22)';
    ctx.fillRect(0, 0, w, bandH);

    const mapX = (id) => Math.min(w - 8, Math.max(8, (id / maxID) * (w - 16) + 8));
    const mapY = (mt) => {
      if (mt <= linearMaxY) {
        return h - 6 - (mt / linearMaxY) * (h - bandH - 10);
      }
      return Math.max(5, bandH - 4 - Math.log10(mt / linearMaxY) * 12);
    };

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mapX(0.5), mapY(this.telemetry.regTotal.a + this.telemetry.regTotal.b * 0.5));
    ctx.lineTo(mapX(7.0), mapY(this.telemetry.regTotal.a + this.telemetry.regTotal.b * 7.0));
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
    ctx.beginPath();
    ctx.moveTo(mapX(0.5), mapY(this.telemetry.regMotor.a + this.telemetry.regMotor.b * 0.5));
    ctx.lineTo(mapX(7.0), mapY(this.telemetry.regMotor.a + this.telemetry.regMotor.b * 7.0));
    ctx.stroke();
    ctx.restore();

    for (const t of this.telemetry.trials) {
      const x = mapX(t.id);
      const y = mapY(t.mt);

      if (t.motorMt > 25 && t.id > 0.5) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.45)';
        ctx.beginPath();
        ctx.arc(x, mapY(t.motorMt), 2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t.regime === 'MOTOR_LOCKED') {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.regime === 'COGNITIVE_SEARCH') {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(x, y - 3.5);
        ctx.lineTo(x + 3.5, y + 3);
        ctx.lineTo(x - 3.5, y + 3);
        ctx.closePath();
        ctx.fill();
      } else if (t.regime === 'TELEMETRY_INSPECTION') {
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x, y + 4);
        ctx.lineTo(x - 4, y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }
  }
}
