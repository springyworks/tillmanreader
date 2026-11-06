// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import type { LabApp } from '../../app/lab-app';
import { RuntimeWatchdog } from '../../diagnostics/runtime-watchdog';

/** Lab deck: envelope tutor, scale, aiming, scoop visor, goal memory, stage and scope controls. */
export function bindLabDeck(app: LabApp): void {
  // Auto-Scenario Envelope Tutor Toggle (inside drawer)
  const btnAutoScen = document.getElementById('btnAutoScenario');
  if (btnAutoScen) {
    btnAutoScen.addEventListener('click', (e) => {
      app.autoScenarioEnabled = !app.autoScenarioEnabled;
      e.currentTarget.classList.toggle('active', app.autoScenarioEnabled);
      e.currentTarget.textContent = `🚀 Auto-Scenario: ${app.autoScenarioEnabled ? 'ON (Grounding → Reading)' : 'OFF (Manual)'}`;
      app.flow.syncStageUI();
    });
  }

  // Explicit UI / Target Scale Buttons (- / +)
  document.getElementById('btnScaleDown').addEventListener('click', () => {
    app.reading.uiFontScale = Math.max(0.75, Number((app.reading.uiFontScale - 0.15).toFixed(2)));
    document.getElementById('lblUiScale').textContent =
      `Scale: ${Math.round(app.reading.uiFontScale * 100)}%`;
    app.spawner.spawnForCurrentLevel();
  });
  document.getElementById('btnScaleUp').addEventListener('click', () => {
    app.reading.uiFontScale = Math.min(2.0, Number((app.reading.uiFontScale + 0.15).toFixed(2)));
    document.getElementById('lblUiScale').textContent =
      `Scale: ${Math.round(app.reading.uiFontScale * 100)}%`;
    app.spawner.spawnForCurrentLevel();
  });

  // Aiming Strategy Selector (Natural vs Bullseye Core vs Speed Rim-Graze)
  document.querySelectorAll('.aim-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.aim-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      app.telemetry.aimStrategy = btn.dataset.aim;
      app.scope3Mode = 'BULLSEYE_MAP';
      const modeDesc = {
        NATURAL:
          '🎯 Natural Aiming: Click naturally while we measure your radial center bias (r/R) & Effective Width (We).',
        BULLSEYE:
          '⊕ Bullseye Core Mode: Aim inside the inner 30% center ring to maximize precision (high ID_eff).',
        RIM_GRAZE:
          '⚡ Speed Rim-Graze Mode: Tap as soon as your cursor crosses the outer 70–100% boundary ring—zero homing needed!',
      };
      const coach = document.getElementById('insightText');
      if (coach) coach.textContent = modeDesc[app.telemetry.aimStrategy] || modeDesc.NATURAL;
      app.hud.showToast(
        `AIM STRATEGY: ${app.telemetry.aimStrategy}`,
        modeDesc[app.telemetry.aimStrategy],
        'border-amber-400',
      );
    });
  });

  // Toggle Anti-Fat-Finger (FFP) Offset Scoop-Visor Drag & Drop Mode
  const btnScoop = document.getElementById('btnToggleScoop');
  if (btnScoop) {
    btnScoop.addEventListener('click', (e) => {
      app.scoopVisor.enabled = !app.scoopVisor.enabled;
      e.currentTarget.classList.toggle('active', app.scoopVisor.enabled);
      e.currentTarget.textContent = `🔭 Scoop-Visor: ${app.scoopVisor.enabled ? 'ON (FFP Offset)' : 'OFF (Direct Tap)'}`;
      app.layout.enforceOnScreenGuard();
      app.hud.showToast(
        app.scoopVisor.enabled ? '🔭 ANTI-FFP SCOOP-VISOR: ON' : '👆 DIRECT TAP MODE: ON',
        app.scoopVisor.enabled
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
      app.goalMemory.mode = mode;
      app.telemetry.goalMemoryMode = mode;
      app.goalMemory.autoStreak = 0;
      app.flow.configureGoalMemoryParameters();
      app.trialStartTime = performance.now();
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
      app.hud.showToast(`GOAL MEMORY: ${mode}`, descMap[mode], 'border-cyan-400');
    });
  });

  // L7 Stage Controls
  document.getElementById('btnStagePrev').addEventListener('click', () => {
    app.reading.stage = Math.max(1, app.reading.stage - 1);
    app.flow.syncStageUI();
    app.spawner.spawnForCurrentLevel();
  });
  document.getElementById('btnStageNext').addEventListener('click', () => {
    app.reading.stage = Math.min(6, app.reading.stage + 1);
    app.flow.syncStageUI();
    app.spawner.spawnForCurrentLevel();
  });
  document.getElementById('btnAutoZPD').addEventListener('click', (e) => {
    app.reading.autoZPD = !app.reading.autoZPD;
    e.currentTarget.textContent = `Auto-ZPD: ${app.reading.autoZPD ? 'ON' : 'OFF'}`;
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
  document.querySelectorAll('.lvl-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.flow.applyStepIndex(parseInt(btn.dataset.step, 10));
    });
  });

  // L1 Subcontrols
  document.getElementById('btnL1Zero').addEventListener('click', () => {
    app.flow.applyStepIndex(0);
  });
  document.getElementById('btnL1Shrink').addEventListener('click', () => {
    app.shrinkRadius = 78;
    app.flow.applyStepIndex(1);
  });

  // L1 Foreperiod Distribution Selector
  document.querySelectorAll('.fp-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fp-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      app.fpEngine.setMode(btn.dataset.fp);
      app.scope3Mode = 'PUT_HAZARD';
      if (app.level === 1 && app.l1Mode === 'zero') {
        app.spawner.spawnForCurrentLevel();
      }
    });
  });

  // L2 Subcontrols
  document.getElementById('btnShapeCircle').addEventListener('click', () => {
    app.l2Shape = 'circle';
    document.getElementById('btnShapeCircle').className = 'ergo-sub-btn active';
    document.getElementById('btnShapeSquare').className = 'ergo-sub-btn';
    app.spawner.spawnForCurrentLevel();
  });
  document.getElementById('btnShapeSquare').addEventListener('click', () => {
    app.l2Shape = 'square';
    document.getElementById('btnShapeSquare').className = 'ergo-sub-btn active';
    document.getElementById('btnShapeCircle').className = 'ergo-sub-btn';
    app.spawner.spawnForCurrentLevel();
  });

  // Toggle X-Ray Overlay
  document.getElementById('btnToggleXray').addEventListener('click', (e) => {
    app.guiEngine.xrayEnabled = !app.guiEngine.xrayEnabled;
    e.currentTarget.textContent = `🔍 X-Ray: ${app.guiEngine.xrayEnabled ? 'ON' : 'OFF'}`;
  });

  // Cycle Scope 3 Mode (3-way: BULLSEYE_MAP -> FITTS -> PUT_HAZARD)
  document.getElementById('btnToggleScope3').addEventListener('click', () => {
    const order = ['BULLSEYE_MAP', 'FITTS', 'PUT_HAZARD'];
    const idx = (order.indexOf(app.scope3Mode) + 1) % order.length;
    app.scope3Mode = order[idx];
  });

  // Watchdog Self-Test Button
  document.getElementById('btnWatchdog').addEventListener('click', () => {
    const ok = RuntimeWatchdog.runSelfTests(app);
    app.hud.showToast(
      ok ? '✅ 12/12 DIAGNOSTIC SELF-TESTS PASSED' : '⚠️ DIAGNOSTIC WARNING',
      'Verified 2x Ergonomic GUI, Unobstructed Safe Action Field, View-Normalized Tillman Law & 48-Trial Log.',
      ok ? 'border-emerald-500' : 'border-rose-500',
    );
  });
}
