import type { LabApp } from '../../app/lab-app';
import { closestFrom } from '../../util/dom';

/** Window-level resize and pointer tracking (GUI-id Shannon DI, eye-proxy gaze, doodling). */
export function bindGlobalPointerTracking(app: LabApp): void {
  window.addEventListener('resize', () => {
    app.layout.setupCanvases();
    app.guiEngine.scanDOMElements();
    app.layout.clampActiveTargetsToSafeView();
  });

  // Global window pointermove for Self-Referential GUI-ID Shannon DI, Eye-Proxy Gaze & Doodling
  window.addEventListener('pointermove', (e) => {
    const now = performance.now();
    app.winCursor = { x: e.clientX, y: e.clientY };
    app.guiEngine.pushWindowPointer(
      e.clientX,
      e.clientY,
      now,
      app.telemetry.rt0BaselineMs,
      app.telemetry.regMotor.b,
    );
  });

  // Track clicks on any [data-gui-id] element
  window.addEventListener('pointerdown', (e) => {
    const guiEl = closestFrom<HTMLElement>(e.target, '[data-gui-id]');
    if (guiEl) {
      app.guiEngine.recordGuiClick(guiEl.dataset.guiId);
    }
  });
}
