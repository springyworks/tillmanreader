import type { LabApp } from '../../app/lab-app';
import { BUILD_INFO } from '../../app/build-info';
import { maybeById, onClick } from '../../util/dom';

/** Preset loaders, new-kid reset, checkpoint commit/revert, morph toggle and JSON copy/save. */
export function bindSessionControls(app: LabApp): void {
  // Preset Loaders (66-Log, 48-Log, 25-Fitts)
  onClick('btnLoad66', () => {
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
  onClick('btnLoad48', () => {
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
  onClick('btnLoad25', () => {
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

  // Clear Storage / New Kid Profile (inside Lab Drawer)
  onClick('btnClearStorage', () => {
    app.persistence.clearBrowserSave();
    app.resetFreshLearnerState();
    app.tutor.armPriorKnowledgeCalibration();
    app.persistence.saveToBrowser(app);
    app.flow.syncStageUI();
    app.spawner.spawnForCurrentLevel();
    app.hud.showToast(
      `👶 SCHOON PROFIEL: ${app.persistence.activeNickname}`,
      'Geheugen gewist — live ms-voorkennismeting actief vanaf de basis!',
      'border-rose-500',
    );
  });

  // Bottom Service Button: Erase All Webpage Data-Memory + Re-Calibrate from Millisecond Dynamics
  const openServiceEraseModal = (): void => {
    const modal = maybeById('serviceEraseModal');
    if (!modal) return;
    const summaryEl = maybeById('eraseModalMemorySummary');
    if (summaryEl) {
      summaryEl.textContent = `Sessie #${app.persistence.sessionNumber} • ${app.telemetry.trials.length} trials • ${app.persistence.profiles.length} profielen`;
    }
    modal.classList.remove('hidden');
  };
  const closeServiceEraseModal = (): void => {
    maybeById('serviceEraseModal')?.classList.add('hidden');
  };
  const confirmEraseWebpageMemory = (): void => {
    closeServiceEraseModal();
    app.eraseAllWebpageMemoryAndRecalibrate();
    app.hud.showToast(
      '🧹 WEBPAGINA DATA-GEHEUGEN GEWIST',
      'Langetermijn-historie gereset — tutor pakt op ms-detail direct je huidige niveau op!',
      'border-rose-500',
    );
  };

  onClick('btnEraseDataMemory', () => openServiceEraseModal(), { stopPropagation: true });
  onClick('btnCancelEraseMemory', () => closeServiceEraseModal());
  onClick('btnConfirmEraseMemory', () => confirmEraseWebpageMemory());
  window.addEventListener('keydown', (e) => {
    const modal = maybeById('serviceEraseModal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeServiceEraseModal();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirmEraseWebpageMemory();
    }
  });

  // Git-Style Checkpoint Commit & Revert Buttons
  onClick('btnCommitCheckpoint', () => {
    app.persistence.commitCheckpoint(app);
    app.hud.showToast(
      '📌 CHECKPOINT COMMITTED',
      `Saved snapshot (${BUILD_INFO.tag}) to localStorage.`,
      'border-amber-400',
    );
  });
  onClick('btnRevertCheckpoint', () => {
    const tag = app.persistence.revertToCheckpoint(app);
    app.hud.showToast(
      '⏪ REVERTED TO CHECKPOINT',
      `Restored ${tag || BUILD_INFO.tag}.`,
      'border-purple-400',
    );
  });

  // Semantic SVG Morph Toggle
  onClick('btnToggleMorph', (button) => {
    app.semanticMorphEnabled = !app.semanticMorphEnabled;
    button.classList.toggle('active', app.semanticMorphEnabled);
    button.textContent = `🎨 Morph: ${app.semanticMorphEnabled ? 'ON' : 'OFF'}`;
    app.persistence.saveToBrowser(app);
  });

  // Drawer Copy JSON & Export JSON Buttons
  onClick('btnCopyJson', () => app.payload.openJsonInspectorModal(true));
  onClick('btnExport', () => app.payload.exportJSON());
}
