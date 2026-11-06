import type { LabApp } from '../../app/lab-app';
import { toDrawerState } from '../../app/layout-controller';
import { isMetricFilter } from '../../engines/signature-100-engine';
import { byId, closestFrom, maybeById } from '../../util/dom';

/** Telemetry drawer states, handle drag, category filter and inspection-time tracking. */
export function bindDrawer(app: LabApp): void {
  // Drawer State Buttons & Handle Drag/Click
  document.querySelectorAll<HTMLElement>('.dstate-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      app.layout.setDrawerState(toDrawerState(parseInt(btn.dataset.dstate ?? '', 10)));
    });
  });

  const drawer = maybeById('telemetryDrawer');
  const header = maybeById('topHeader');
  const handle = byId('drawerHandle');
  let dragStartY: number | null = null;
  handle.addEventListener('pointerdown', (e) => {
    if (closestFrom(e.target, 'button')) return;
    dragStartY = e.clientY;
  });
  window.addEventListener('pointercancel', () => {
    dragStartY = null;
  });
  window.addEventListener('pointerup', (e) => {
    app.telemetry.recordUp(app.cursor.x, app.cursor.y, performance.now());
    if (dragStartY !== null) {
      const dy = dragStartY - e.clientY;
      if (Math.abs(dy) < 12) {
        app.layout.setDrawerState(toDrawerState((app.drawerState + 1) % 3));
      } else if (dy > 30) {
        app.layout.setDrawerState(toDrawerState(app.drawerState + 1));
      } else if (dy < -30) {
        app.layout.setDrawerState(toDrawerState(app.drawerState - 1));
      }
      dragStartY = null;
    }
  });

  // Category Filter Pills
  document.querySelectorAll<HTMLElement>('.cat-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (isMetricFilter(cat)) app.panels.filter100Category(cat);
    });
  });

  // Track Inspection Time on Drawer or Top Bar
  [drawer, header].forEach((el) => {
    if (!el) return;
    el.addEventListener('pointerenter', () => {
      app.dockEnterTime = performance.now();
    });
    el.addEventListener('pointerleave', () => {
      if (app.dockEnterTime > 0) {
        const dt = performance.now() - app.dockEnterTime;
        app.currentTrialDockMs += dt;
        if (dt > 500) app.gesture.counts.inspect++;
        app.dockEnterTime = 0;
      }
    });
  });
}
