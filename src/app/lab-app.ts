// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import { VocalTractFormantEngine } from '../audio/vocal-tract-formant-engine';
import { RuntimeWatchdog } from '../diagnostics/runtime-watchdog';
import { AdaptiveReadingEngine } from '../engines/adaptive-reading-engine';
import { ForeperiodHazardEngine } from '../engines/foreperiod-hazard-engine';
import { GestureDecoder } from '../engines/gesture-decoder';
import { GuiAffordanceDoodleEngine } from '../engines/gui-affordance-doodle-engine';
import { LongitudinalPersistenceEngine } from '../engines/longitudinal-persistence-engine';
import { Signature100Engine } from '../engines/signature-100-engine';
import { TelemetryEngine } from '../engines/telemetry-engine';
import { TelemetryPanels } from '../ui/telemetry-panels';
import { Hud } from '../ui/hud';
import { LayoutController } from './layout-controller';
import { LevelFlow } from './level-flow';
import { TrialSpawner } from './trial-spawner';
import { HitProcessor } from './hit-processor';
import { PayloadExporter } from '../export/payload-exporter';
import { StandaloneExporter } from '../export/standalone-exporter';
import { ArenaRenderer } from '../render/arena-renderer';
import { ScoopVisorRenderer } from '../render/scoop-visor-renderer';
import { ScopeRenderer } from '../render/scope-renderer';
import { bindEvents } from '../ui/bindings';

/*************************************************************************
 * 9. MAIN LAB CONTROLLER, VIEW-SIZE SAFE ACTION FIELD & GUI DOODLING LOOP
 *************************************************************************/
export class LabApp {
  readonly panels: TelemetryPanels;
  readonly hud: Hud;
  readonly layout: LayoutController;
  readonly flow: LevelFlow;
  readonly spawner: TrialSpawner;
  readonly hits: HitProcessor;
  readonly payload: PayloadExporter;
  readonly standalone: StandaloneExporter;
  readonly arenaRenderer: ArenaRenderer;
  readonly visorRenderer: ScoopVisorRenderer;
  readonly scopeRenderer: ScopeRenderer;

  constructor() {
    this.panels = new TelemetryPanels(this);
    this.hud = new Hud(this);
    this.layout = new LayoutController(this);
    this.flow = new LevelFlow(this);
    this.spawner = new TrialSpawner(this);
    this.hits = new HitProcessor(this);
    this.payload = new PayloadExporter(this);
    this.standalone = new StandaloneExporter(this);
    this.arenaRenderer = new ArenaRenderer(this);
    this.visorRenderer = new ScoopVisorRenderer(this);
    this.scopeRenderer = new ScopeRenderer(this);

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
    this.gesture = new GestureDecoder((type, info) => this.hud.handleEmbodiedGesture(type, info));
    this.guiEngine = new GuiAffordanceDoodleEngine((type, gui, meta) =>
      this.hud.handleGuiDoodle(type, gui, meta),
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

    this.layout.setupCanvases();
    this.guiEngine.scanDOMElements();
    this.panels.buildGuiRegistryDOM();
    this.panels.build100MetricDOM();
    bindEvents(this);

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

    this.layout.setDrawerState(0);
    this.flow.syncStageUI();
    this.spawner.spawnForCurrentLevel();
    this.sig100.computeAll(
      this.telemetry,
      this.gesture,
      this.reading,
      this.drawerState,
      this.fpEngine,
      this.guiEngine,
    );
    this.panels.update100MetricDOM();
    this.panels.updateGuiRegistryDOM();

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
          this.layout.setupCanvases();
          this.guiEngine.scanDOMElements();
          this.layout.clampActiveTargetsToSafeView();
        }, 80);
      });
      this.resizeObs.observe(document.getElementById('arenaContainer'));
    }

    RuntimeWatchdog.runSelfTests(this);

    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(now) {
    this.layout.enforceOnScreenGuard();

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
        this.panels.update100MetricDOM();
        this.panels.updateGuiRegistryDOM();
      }
      this.hud.updateTextTelemetry();
      this.lastFrameTime = now;
    }

    this.arenaRenderer.renderArena(now);
    this.guiEngine.renderOverlay(
      this.overlayCtx,
      window.innerWidth || 800,
      window.innerHeight || 600,
      this.winCursor,
    );
    if (this.drawerState >= 1) {
      this.scopeRenderer.renderScope1();
      this.scopeRenderer.renderScope2();
      this.scopeRenderer.renderScope3();
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  // Public facade: stable entry points used by engines, the watchdog and the console.
  stepLevel(delta) {
    return this.flow.stepLevel(delta);
  }

  applyStepIndex(idx, fromAutoTutor = false) {
    return this.flow.applyStepIndex(idx, fromAutoTutor);
  }

  syncStageUI() {
    return this.flow.syncStageUI();
  }

  spawnForCurrentLevel() {
    return this.spawner.spawnForCurrentLevel();
  }

  getSafeArenaCenter(forceRefresh = false) {
    return this.layout.getSafeArenaCenter(forceRefresh);
  }

  showToast(title, sub, borderClass) {
    return this.hud.showToast(title, sub, borderClass);
  }

  buildPayloadObject() {
    return this.payload.buildPayloadObject();
  }

  buildCleanStandaloneHtmlString() {
    return this.standalone.buildCleanStandaloneHtmlString();
  }

  exportStandaloneHTMLApp() {
    return this.standalone.exportStandaloneHTMLApp();
  }
}
