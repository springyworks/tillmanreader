import type { LabApp } from '../../app/lab-app';
import { byId, onClick } from '../../util/dom';

/** Selects `text` in a throwaway textarea and copies it with the legacy command, for pages without the async clipboard. */
function copyWithLegacyCommand(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    // Falls through to the async clipboard API.
  }
  document.body.removeChild(ta);
}

/** Export buttons plus the cloud-share and JSON-inspector modals. */
export function bindExportAndModals(app: LabApp): void {
  // Top Header `💾 SAVED • 📋 COPY JSON` Button & Collapsed Handle Bar `📋 COPY JSON` Button
  onClick('btnTopSavedJson', () => app.payload.openJsonInspectorModal(true), {
    stopPropagation: true,
  });
  onClick('btnStandaloneExport', () => app.standalone.exportStandaloneHTMLApp(), {
    stopPropagation: true,
  });
  onClick('btnCloudShareGuide', () => byId('cloudShareModal').classList.remove('hidden'), {
    stopPropagation: true,
  });
  onClick('btnCloseCloudModal', () => byId('cloudShareModal').classList.add('hidden'));
  onClick('btnCloudDownloadHtml', () => app.standalone.exportStandaloneHTMLApp());
  onClick('btnCopyFullHtmlSource', (button) => {
    const fullHtml = app.standalone.buildCleanStandaloneHtmlString();
    copyWithLegacyCommand(fullHtml);
    // `navigator.clipboard` only exists in secure contexts.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullHtml).catch(() => {});
    }
    button.textContent = `✅ COPIED (${Math.round(fullHtml.length / 1024)} KB)! PASTE INTO GOOGLE SITES EMBED`;
    setTimeout(() => {
      button.textContent = '📋 COPY FULL HTML FOR GOOGLE SITES';
    }, 3500);
    app.hud.showToast(
      '📋 FULL HTML COPIED FOR GOOGLE SITES!',
      'Open sites.google.com → Insert → Embed → Embed Code → Paste!',
      'border-emerald-400',
    );
  });
  onClick('btnHandleCopyJson', () => app.payload.openJsonInspectorModal(true), {
    stopPropagation: true,
  });

  // JSON Inspector Modal Controls
  onClick('btnModalCopy', () => app.payload.copyJSONToClipboard(true));
  onClick('btnModalDownloadHtml', () => app.standalone.exportStandaloneHTMLApp());
  onClick('btnModalDownload', () => app.payload.exportJSON());
  onClick('btnModalClose', () => byId('jsonInspectorModal').classList.add('hidden'));
}
