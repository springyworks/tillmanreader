// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import type { LabApp } from '../../app/lab-app';
import { BUILD_INFO } from '../../app/build-info';

/** Preset loaders, new-kid reset, checkpoint commit/revert, morph toggle and JSON copy/save. */
export function bindSessionControls(app: LabApp): void {
  // Preset Loaders (66-Log, 48-Log, 25-Fitts)
  const btn66 = document.getElementById('btnLoad66');
  if (btn66) {
    btn66.addEventListener('click', () => {
      app.telemetry.loadPreset66(app.fpEngine, app.reading);
      app.scope3Mode = 'BULLSEYE_MAP';
      app.flow.syncStageUI();
      app.persistence.saveToBrowser(app);
      app.hud.showToast(
        '🎯 66-TRIAL BULLSEYE LOG LOADED',
        'Loaded 66 trials & 49 PUT records.',
        'border-emerald-400',
      );
    });
  }
  const btn48 = document.getElementById('btnLoad48');
  if (btn48) {
    btn48.addEventListener('click', () => {
      app.telemetry.loadPresetPut32(app.fpEngine);
      app.scope3Mode = 'PUT_HAZARD';
      app.flow.syncStageUI();
      app.persistence.saveToBrowser(app);
      app.hud.showToast(
        '⚡ 48-TRIAL LOG LOADED',
        'Loaded 48 trials & PUT hazard records.',
        'border-cyan-400',
      );
    });
  }
  const btn25 = document.getElementById('btnLoad25');
  if (btn25) {
    btn25.addEventListener('click', () => {
      app.telemetry.loadPreset25(app.fpEngine);
      app.scope3Mode = 'FITTS';
      app.flow.syncStageUI();
      app.persistence.saveToBrowser(app);
      app.hud.showToast(
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
      app.persistence.clearBrowserSave();
      app.telemetry.trials = [];
      app.fpEngine.records = [];
      app.reading.stage = 1;
      app.currentStepIdx = 0;
      app.phaseProgress = 0;
      app.flow.applyStepIndex(0, false);
      app.hud.showToast(
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
      app.persistence.commitCheckpoint(app);
      app.hud.showToast(
        '📌 CHECKPOINT COMMITTED',
        `Saved snapshot (${BUILD_INFO.tag}) to localStorage.`,
        'border-amber-400',
      );
    });
  }
  const btnRevert = document.getElementById('btnRevertCheckpoint');
  if (btnRevert) {
    btnRevert.addEventListener('click', () => {
      const tag = app.persistence.revertToCheckpoint(app);
      app.hud.showToast(
        '⏪ REVERTED TO CHECKPOINT',
        `Restored ${tag || BUILD_INFO.tag}.`,
        'border-purple-400',
      );
    });
  }

  // Semantic SVG Morph Toggle
  const btnMorph = document.getElementById('btnToggleMorph');
  if (btnMorph) {
    btnMorph.addEventListener('click', (e) => {
      app.semanticMorphEnabled = !app.semanticMorphEnabled;
      e.currentTarget.classList.toggle('active', app.semanticMorphEnabled);
      e.currentTarget.textContent = `🎨 Morph: ${app.semanticMorphEnabled ? 'ON' : 'OFF'}`;
      app.persistence.saveToBrowser(app);
    });
  }

  // Drawer Copy JSON & Export JSON Buttons
  const btnCopy = document.getElementById('btnCopyJson');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => app.payload.openJsonInspectorModal(true));
  }
  const btnExp = document.getElementById('btnExport');
  if (btnExp) {
    btnExp.addEventListener('click', () => app.payload.exportJSON());
  }
}
