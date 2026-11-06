import type { LabApp } from '../../app/lab-app';
import { RuntimeWatchdog } from '../../diagnostics/runtime-watchdog';
import type { GoalMemoryMode, Scope3Mode } from '../../types/arena';
import { isAimStrategy, isForeperiodDistribution, isGoalMemoryMode } from '../../types/guards';
import type { AimStrategy } from '../../types/telemetry';
import { byId, maybeById, onClick } from '../../util/dom';

const AIM_DESCRIPTIONS: Record<AimStrategy, string> = {
  NATURAL:
    '🎯 Natural Aiming: Click naturally while we measure your radial center bias (r/R) & Effective Width (We).',
  BULLSEYE:
    '⊕ Bullseye Core Mode: Aim inside the inner 30% center ring to maximize precision (high ID_eff).',
  RIM_GRAZE:
    '⚡ Speed Rim-Graze Mode: Tap as soon as your cursor crosses the outer 70–100% boundary ring—zero homing needed!',
};

const GOAL_MEMORY_DESCRIPTIONS: Record<GoalMemoryMode, string> = {
  ALWAYS: '👁️ Always Visible: Top Goal & targets stay 100% visible (Baseline).',
  PEEK_1200:
    '⏳ 1.2s Peek + Hover Recall: Top goal fades after 1.2s! Move mouse to top banner (no click) to reveal it again.',
  MEM_500:
    '🧠 0.5s Spatial Working Memory: Goal & target flash for 0.5s then cloak! Hover top sensor bar to re-peek anytime.',
  AUTO_PROG:
    '🔄 Auto-Fade Progression: Starts Always-On for 3 hits, then progressively shortens peek window to test working memory!',
};

const SCOPE3_ORDER: readonly Scope3Mode[] = ['BULLSEYE_MAP', 'FITTS', 'PUT_HAZARD'];

/** Makes `active` the only highlighted button among those matching `selector`. */
function setActiveButton(selector: string, active: HTMLElement): void {
  document.querySelectorAll(selector).forEach((b) => b.classList.remove('active'));
  active.classList.add('active');
}

/** Lab deck: envelope tutor, scale, aiming, scoop visor, goal memory, stage and scope controls. */
export function bindLabDeck(app: LabApp): void {
  // Auto-Scenario Envelope Tutor Toggle (inside drawer)
  onClick('btnAutoScenario', (button) => {
    app.autoScenarioEnabled = !app.autoScenarioEnabled;
    button.classList.toggle('active', app.autoScenarioEnabled);
    button.textContent = `🚀 Auto-Scenario: ${app.autoScenarioEnabled ? 'ON (Grounding → Reading)' : 'OFF (Manual)'}`;
    app.flow.syncStageUI();
  });

  // Explicit UI / Target Scale Buttons (- / +)
  const setUiScale = (scale: number): void => {
    app.reading.uiFontScale = scale;
    byId('lblUiScale').textContent = `Scale: ${Math.round(scale * 100)}%`;
    app.spawner.spawnForCurrentLevel();
  };
  const scaledBy = (delta: number): number => Number((app.reading.uiFontScale + delta).toFixed(2));
  byId('btnScaleDown').addEventListener('click', () => setUiScale(Math.max(0.75, scaledBy(-0.15))));
  byId('btnScaleUp').addEventListener('click', () => setUiScale(Math.min(2.0, scaledBy(0.15))));

  // Aiming Strategy Selector (Natural vs Bullseye Core vs Speed Rim-Graze)
  document.querySelectorAll<HTMLElement>('.aim-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const strategy = btn.dataset.aim;
      if (!isAimStrategy(strategy)) return;
      setActiveButton('.aim-btn', btn);
      app.telemetry.aimStrategy = strategy;
      app.scope3Mode = 'BULLSEYE_MAP';
      const description = AIM_DESCRIPTIONS[strategy];
      const coach = maybeById('insightText');
      if (coach) coach.textContent = description;
      app.hud.showToast(`AIM STRATEGY: ${strategy}`, description, 'border-amber-400');
    });
  });

  // Toggle Anti-Fat-Finger (FFP) Offset Scoop-Visor Drag & Drop Mode
  onClick('btnToggleScoop', (button) => {
    app.scoopVisor.enabled = !app.scoopVisor.enabled;
    button.classList.toggle('active', app.scoopVisor.enabled);
    button.textContent = `🔭 Scoop-Visor: ${app.scoopVisor.enabled ? 'ON (FFP Offset)' : 'OFF (Direct Tap)'}`;
    app.layout.enforceOnScreenGuard();
    app.hud.showToast(
      app.scoopVisor.enabled ? '🔭 ANTI-FFP SCOOP-VISOR: ON' : '👆 DIRECT TAP MODE: ON',
      app.scoopVisor.enabled
        ? 'Grab the lower thumb pad, steer the unobstructed upper Visor over the target, and lift finger to drop!'
        : 'Switched to standard direct tap/click.',
      'border-cyan-400',
    );
  });

  // Parameterized Goal Memory & Hover-to-Reveal Mode Buttons
  document.querySelectorAll<HTMLElement>('.gmem-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.gmem;
      if (!isGoalMemoryMode(mode)) return;
      setActiveButton('.gmem-btn', btn);
      app.goalMemory.mode = mode;
      app.telemetry.goalMemoryMode = mode;
      app.goalMemory.autoStreak = 0;
      app.flow.configureGoalMemoryParameters();
      app.trialStartTime = performance.now();
      const description = GOAL_MEMORY_DESCRIPTIONS[mode];
      const coach = maybeById('insightText');
      if (coach) coach.textContent = description;
      app.hud.showToast(`GOAL MEMORY: ${mode}`, description, 'border-cyan-400');
    });
  });

  // L7 Stage Controls
  byId('btnStagePrev').addEventListener('click', () => {
    app.reading.stage = Math.max(1, app.reading.stage - 1);
    app.flow.syncStageUI();
    app.spawner.spawnForCurrentLevel();
  });
  byId('btnStageNext').addEventListener('click', () => {
    app.reading.stage = Math.min(6, app.reading.stage + 1);
    app.flow.syncStageUI();
    app.spawner.spawnForCurrentLevel();
  });
  const btnAutoZpd = byId('btnAutoZPD');
  btnAutoZpd.addEventListener('click', () => {
    app.reading.autoZPD = !app.reading.autoZPD;
    btnAutoZpd.textContent = `Auto-ZPD: ${app.reading.autoZPD ? 'ON' : 'OFF'}`;
  });

  // Keyboard shortcuts [ and ] or PageUp / PageDown for Prev / Next Level
  window.addEventListener('keydown', (e) => {
    if (e.key === '[' || e.key === 'PageUp') {
      e.preventDefault();
      app.flow.stepLevel(-1);
    } else if (e.key === ']' || e.key === 'PageDown') {
      e.preventDefault();
      app.flow.stepLevel(1);
    }
  });

  // Direct Step Jump Pills
  document.querySelectorAll<HTMLElement>('.lvl-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.flow.applyStepIndex(parseInt(btn.dataset.step ?? '', 10));
    });
  });

  // L1 Subcontrols
  byId('btnL1Zero').addEventListener('click', () => {
    app.flow.applyStepIndex(0);
  });
  byId('btnL1Shrink').addEventListener('click', () => {
    app.shrinkRadius = 78;
    app.flow.applyStepIndex(1);
  });

  // L1 Foreperiod Distribution Selector
  document.querySelectorAll<HTMLElement>('.fp-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const distribution = btn.dataset.fp;
      if (!isForeperiodDistribution(distribution)) return;
      setActiveButton('.fp-btn', btn);
      app.fpEngine.setMode(distribution);
      app.scope3Mode = 'PUT_HAZARD';
      if (app.level === 1 && app.l1Mode === 'zero') {
        app.spawner.spawnForCurrentLevel();
      }
    });
  });

  // L2 Subcontrols
  const btnShapeCircle = byId('btnShapeCircle');
  const btnShapeSquare = byId('btnShapeSquare');
  btnShapeCircle.addEventListener('click', () => {
    app.l2Shape = 'circle';
    btnShapeCircle.className = 'ergo-sub-btn active';
    btnShapeSquare.className = 'ergo-sub-btn';
    app.spawner.spawnForCurrentLevel();
  });
  btnShapeSquare.addEventListener('click', () => {
    app.l2Shape = 'square';
    btnShapeSquare.className = 'ergo-sub-btn active';
    btnShapeCircle.className = 'ergo-sub-btn';
    app.spawner.spawnForCurrentLevel();
  });

  // Toggle X-Ray Overlay
  const btnXray = byId('btnToggleXray');
  btnXray.addEventListener('click', () => {
    app.guiEngine.xrayEnabled = !app.guiEngine.xrayEnabled;
    btnXray.textContent = `🔍 X-Ray: ${app.guiEngine.xrayEnabled ? 'ON' : 'OFF'}`;
  });

  // Cycle Scope 3 Mode (3-way: BULLSEYE_MAP -> FITTS -> PUT_HAZARD)
  byId('btnToggleScope3').addEventListener('click', () => {
    const idx = (SCOPE3_ORDER.indexOf(app.scope3Mode) + 1) % SCOPE3_ORDER.length;
    app.scope3Mode = SCOPE3_ORDER[idx];
  });

  // Watchdog Self-Test Button
  byId('btnWatchdog').addEventListener('click', () => {
    const ok = RuntimeWatchdog.runSelfTests(app);
    app.hud.showToast(
      ok ? '✅ 12/12 DIAGNOSTIC SELF-TESTS PASSED' : '⚠️ DIAGNOSTIC WARNING',
      'Verified 2x Ergonomic GUI, Unobstructed Safe Action Field, View-Normalized Tillman Law & 48-Trial Log.',
      ok ? 'border-emerald-500' : 'border-rose-500',
    );
  });
}
