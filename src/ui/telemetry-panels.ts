import type { LabApp } from '../app/lab-app';
import type { MetricFilter } from '../engines/signature-100-engine';
import { maybeById } from '../util/dom';

/** Builds and refreshes the GUI-registry cards and the 100-metric signature grid in the telemetry drawer. */
export class TelemetryPanels {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  /**
   * Builds the Self-Referential GUI-Element ID Registry cards inside #guiElementsGrid
   */
  buildGuiRegistryDOM(): void {
    const grid = maybeById('guiElementsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const g of this.app.guiEngine.registry.values()) {
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
  updateGuiRegistryDOM(): void {
    const focusEl = maybeById('guiTableFocus');
    const doodleEl = maybeById('guiTableLastDoodle');
    if (focusEl) focusEl.textContent = this.app.guiEngine.activeFocusId;
    if (doodleEl) doodleEl.textContent = this.app.guiEngine.lastDoodleSummary;

    for (const g of this.app.guiEngine.registry.values()) {
      const diEl = maybeById(`guiid-di-${g.id}`);
      const dwEl = maybeById(`guiid-dwell-${g.id}`);
      const stEl = maybeById(`guiid-strug-${g.id}`);
      const doEl = maybeById(`guiid-dood-${g.id}`);
      if (diEl) diEl.textContent = `${g.liveID.toFixed(1)}b`;
      if (dwEl) dwEl.textContent = `${Math.round(g.dwellMs)}ms`;
      if (stEl) stEl.textContent = `${g.struggleRatio}x`;
      if (doEl) doEl.textContent = String(g.doodles);
    }
  }

  /**
   * Builds the 100 Deterministic Mathematical Metrics cards inside #metrics100Grid
   */
  build100MetricDOM(): void {
    const grid = maybeById('metrics100Grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const m of this.app.sig100.metrics) {
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
  update100MetricDOM(): void {
    for (const m of this.app.sig100.metrics) {
      const el = maybeById(`mval-${m.id}`);
      if (el) el.textContent = String(m.value);
    }
  }

  /**
   * Filters the 100-Metric Grid by Category (ALL, A, B, C, D, E, F)
   */
  filter100Category(cat: MetricFilter): void {
    this.app.sig100.activeCategory = cat;
    document.querySelectorAll<HTMLElement>('.cat-pill').forEach((b) => {
      b.classList.toggle('active', b.dataset.cat === cat);
    });
    for (const m of this.app.sig100.metrics) {
      const card = maybeById(`mcard-${m.id}`);
      if (card) {
        card.style.display = cat === 'ALL' || m.cat === cat ? 'flex' : 'none';
      }
    }
  }
}
