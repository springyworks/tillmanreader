// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import type { LabApp } from '../../app/lab-app';

/** Telemetry drawer states, handle drag, category filter and inspection-time tracking. */
export function bindDrawer(app: LabApp): void {
  // Drawer State Buttons & Handle Drag/Click
  document.querySelectorAll('.dstate-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      app.layout.setDrawerState(parseInt(btn.dataset.dstate, 10));
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
    app.telemetry.recordUp(app.cursor.x, app.cursor.y, performance.now());
    if (dragStartY !== null) {
      const dy = dragStartY - e.clientY;
      if (Math.abs(dy) < 12) {
        app.layout.setDrawerState((app.drawerState + 1) % 3);
      } else if (dy > 30) {
        app.layout.setDrawerState(Math.min(2, app.drawerState + 1));
      } else if (dy < -30) {
        app.layout.setDrawerState(Math.max(0, app.drawerState - 1));
      }
      dragStartY = null;
    }
  });

  // Category Filter Pills
  document.querySelectorAll('.cat-pill').forEach((btn) => {
    btn.addEventListener('click', () => app.panels.filter100Category(btn.dataset.cat));
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
