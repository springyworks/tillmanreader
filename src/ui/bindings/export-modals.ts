// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import type { LabApp } from '../../app/lab-app';

/** Export buttons plus the cloud-share and JSON-inspector modals. */
export function bindExportAndModals(app: LabApp): void {
  // Top Header `💾 SAVED • 📋 COPY JSON` Button & Collapsed Handle Bar `📋 COPY JSON` Button
  const btnTopSavedJson = document.getElementById('btnTopSavedJson');
  if (btnTopSavedJson) {
    btnTopSavedJson.addEventListener('click', (e) => {
      e.stopPropagation();
      app.payload.openJsonInspectorModal(true);
    });
  }
  const btnStandaloneExport = document.getElementById('btnStandaloneExport');
  if (btnStandaloneExport) {
    btnStandaloneExport.addEventListener('click', (e) => {
      e.stopPropagation();
      app.standalone.exportStandaloneHTMLApp();
    });
  }
  const btnCloudShareGuide = document.getElementById('btnCloudShareGuide');
  if (btnCloudShareGuide) {
    btnCloudShareGuide.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('cloudShareModal').classList.remove('hidden');
    });
  }
  const btnCloseCloudModal = document.getElementById('btnCloseCloudModal');
  if (btnCloseCloudModal) {
    btnCloseCloudModal.addEventListener('click', () => {
      document.getElementById('cloudShareModal').classList.add('hidden');
    });
  }
  const btnCloudDownloadHtml = document.getElementById('btnCloudDownloadHtml');
  if (btnCloudDownloadHtml) {
    btnCloudDownloadHtml.addEventListener('click', () => {
      app.standalone.exportStandaloneHTMLApp();
    });
  }
  const btnCopyFullHtmlSource = document.getElementById('btnCopyFullHtmlSource');
  if (btnCopyFullHtmlSource) {
    btnCopyFullHtmlSource.addEventListener('click', () => {
      const fullHtml = app.standalone.buildCleanStandaloneHtmlString();
      const ta = document.createElement('textarea');
      ta.value = fullHtml;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (_) {}
      document.body.removeChild(ta);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullHtml).catch(() => {});
      }
      btnCopyFullHtmlSource.textContent = `✅ COPIED (${Math.round(fullHtml.length / 1024)} KB)! PASTE INTO GOOGLE SITES EMBED`;
      setTimeout(() => {
        btnCopyFullHtmlSource.textContent = '📋 COPY FULL HTML FOR GOOGLE SITES';
      }, 3500);
      app.hud.showToast(
        '📋 FULL HTML COPIED FOR GOOGLE SITES!',
        'Open sites.google.com → Insert → Embed → Embed Code → Paste!',
        'border-emerald-400',
      );
    });
  }
  const btnHandleCopyJson = document.getElementById('btnHandleCopyJson');
  if (btnHandleCopyJson) {
    btnHandleCopyJson.addEventListener('click', (e) => {
      e.stopPropagation();
      app.payload.openJsonInspectorModal(true);
    });
  }

  // JSON Inspector Modal Controls
  const btnModalCopy = document.getElementById('btnModalCopy');
  if (btnModalCopy) {
    btnModalCopy.addEventListener('click', () => {
      app.payload.copyJSONToClipboard(true);
    });
  }
  const btnModalDownloadHtml = document.getElementById('btnModalDownloadHtml');
  if (btnModalDownloadHtml) {
    btnModalDownloadHtml.addEventListener('click', () => {
      app.standalone.exportStandaloneHTMLApp();
    });
  }
  const btnModalDownload = document.getElementById('btnModalDownload');
  if (btnModalDownload) {
    btnModalDownload.addEventListener('click', () => {
      app.payload.exportJSON();
    });
  }
  const btnModalClose = document.getElementById('btnModalClose');
  if (btnModalClose) {
    btnModalClose.addEventListener('click', () => {
      document.getElementById('jsonInspectorModal').classList.add('hidden');
    });
  }
}
