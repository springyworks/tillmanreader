import type { LabApp } from '../app/lab-app';
import { byId } from '../util/dom';

/** A detached deep copy of the whole page, ready to be cleaned up and serialized. */
function cloneDocument(): HTMLElement {
  const clone = document.documentElement.cloneNode(true);
  if (!(clone instanceof HTMLElement)) {
    throw new Error('The document element could not be cloned.');
  }
  return clone;
}

/** Single-file HTML export, fullscreen toggle and the borderless pop-out window (state baked in). */
export class StandaloneExporter {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  /**
   * CLEAN DOM-CLONE STANDALONE HTML BUILDER (`buildCleanStandaloneHtmlString`):
   * Returns the sanitized, self-contained HTML string with your current state baked inside.
   */
  buildCleanStandaloneHtmlString(): string {
    const savedState = this.app.persistence.saveToBrowser(this.app);
    const docClone = cloneDocument();

    docClone.querySelector('#bakedTillmannState')?.remove();

    for (const sel of ['#jsonInspectorModal', '#cloudShareModal', '#gestureToast']) {
      docClone.querySelector(sel)?.classList.add('hidden');
    }

    const drawerClone = docClone.querySelector<HTMLElement>('#telemetryDrawer');
    if (drawerClone) {
      drawerClone.dataset.state = '0';
      drawerClone.classList.remove('proximity-glow');
    }

    for (const sel of ['#metrics100Grid', '#guiElementsGrid', '#jsonModalCards']) {
      const el = docClone.querySelector(sel);
      if (el) el.innerHTML = '';
    }

    const taClone = docClone.querySelector<HTMLTextAreaElement>('#jsonModalTextarea');
    if (taClone) taClone.value = '';

    docClone.querySelector('#btnHeroAudio')?.classList.add('audio-on');
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
  async toggleTrueFullscreenOrBreakout(): Promise<void> {
    const docEl = document.documentElement;
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);

    if (isFs) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } catch {
        // Leaving fullscreen is best-effort: the browser may already have left it.
      }
      return;
    }

    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen({ navigationUI: 'hide' });
        this.app.hud.showToast(
          '⛶ TRUE OS FULLSCREEN ACTIVE!',
          '100% borderless ground-truth arena locked.',
          'border-purple-400',
        );
        return;
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
        return;
      }
    } catch {
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
  popoutBorderlessWindow(): void {
    if (import.meta.env.DEV) {
      this.app.hud.showToast(
        'ℹ️ POP-OUT NEEDS A PRODUCTION BUILD',
        'The dev server serves unbundled modules. Use "npm run build" + "npm run preview".',
        'border-amber-400',
      );
      return;
    }
    const fullHtml = this.buildCleanStandaloneHtmlString();
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (win) {
      this.app.hud.showToast(
        '🚀 OPENED 100% BORDERLESS FULLSCREEN TAB!',
        'Google Sites iframe blocked hardware Fullscreen, so we launched a borderless full-viewport tab with your state!',
        'border-purple-400',
      );
    } else {
      byId('cloudShareModal').classList.remove('hidden');
      this.app.hud.showToast(
        'ℹ️ ENABLE "FULL PAGE EMBED" IN GOOGLE SITES',
        'See Fix 1 in the modal to make your Google Sites page 100% edge-to-edge without borders!',
        'border-amber-400',
      );
    }
  }

  /**
   * Packages and downloads the standalone `index.html` (current state baked in).
   * Only available from a production build: the dev server serves unbundled modules.
   */
  exportStandaloneHTMLApp(): void {
    if (import.meta.env.DEV) {
      this.app.hud.showToast(
        'ℹ️ EXPORT NEEDS A PRODUCTION BUILD',
        'Run "npm run build", open the built dist/index.html and export from there.',
        'border-amber-400',
      );
      return;
    }
    const fullHtml = this.buildCleanStandaloneHtmlString();

    const hasValidClosing =
      fullHtml.includes('id="bakedTillmannState"') && fullHtml.endsWith('</html>');
    if (!hasValidClosing) {
      this.app.hud.showToast(
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

    this.app.hud.showToast(
      `✅ GITHUB PAGES index.html (${Math.round(fullHtml.length / 1024)} KB) DOWNLOADED!`,
      `Drop "index.html" into your GitHub repo to launch immediately into Tillmann Reader!`,
      'border-emerald-400',
    );
  }
}
