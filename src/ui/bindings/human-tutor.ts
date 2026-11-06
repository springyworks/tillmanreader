import type { LabApp } from '../../app/lab-app';
import { resolveGuiTargetAtPoint, type ResolvedGuiTarget } from '../../diagnostics/gui-inspector';
import { byId, maybeById, onClick } from '../../util/dom';

function currentLevelLabel(app: LabApp): string {
  return app.level === 7 ? `L7-S${app.reading.stage}` : `L${app.level}-${app.l1Mode}`;
}

function getTutorSnapshot(app: LabApp) {
  return app.tutor.getStatusSnapshot(
    app.goalMemory.mode,
    app.telemetry.rt0BaselineMs,
    app.telemetry.trials.length,
  );
}

/** Updates badge counters on the compact Human-Tutor button and modal copy button. */
export function syncHumanTutorBadges(app: LabApp): void {
  const tickerBadge = maybeById('btnHumanTutorBadge');
  if (tickerBadge) {
    const entryCount = app.feedback.entries.length;
    tickerBadge.textContent = entryCount > 0 ? `${entryCount}📋` : String(app.tutor.tickers.length);
  }
  const bufCount = maybeById('humanTutorBufferCount');
  if (bufCount) bufCount.textContent = String(app.feedback.entries.length);
  const learnerLbl = maybeById('learnerNameLabel');
  if (learnerLbl) learnerLbl.textContent = app.persistence.activeNickname;
}

/** Re-renders the Learner Nickname chips, live Tutor Tickers, and Accumulative Clipboard Buffer. */
export function renderHumanTutorModal(app: LabApp): void {
  syncHumanTutorBadges(app);
  const status = getTutorSnapshot(app);

  // 1. Learner Profile Chips
  const chipsEl = maybeById('learnerProfileChips');
  if (chipsEl) {
    chipsEl.innerHTML = '';
    for (const prof of app.persistence.profiles) {
      const btn = document.createElement('button');
      const isActive = prof.slug === app.persistence.activeSlug;
      btn.type = 'button';
      btn.dataset.guiId = `GUI_PROFILE_${prof.slug.toUpperCase()}`;
      btn.className = isActive
        ? 'ergo-sub-btn active border-emerald-400 text-emerald-300'
        : 'ergo-sub-btn border-slate-700 text-slate-300';
      btn.textContent = `${isActive ? '✅ ' : '👶 '}${prof.nickname}`;
      btn.addEventListener('click', () => {
        app.switchLearnerProfile(prof.nickname);
        renderHumanTutorModal(app);
        app.hud.showToast(
          `👶 PROFIEL ACTIEF: ${app.persistence.activeNickname}`,
          `Eigen geheugen & leescurve geladen (Stap ${app.reading.stage}/6).`,
          'border-emerald-400',
        );
      });
      chipsEl.appendChild(btn);
    }
  }

  // 2. Embedded Tutor Toggle & Live Status Summary
  const toggleBtn = maybeById('btnToggleEmbeddedTutor');
  if (toggleBtn) {
    toggleBtn.classList.toggle('active', app.tutor.enabled);
    toggleBtn.textContent = `🤖 Embedded Tutor: ${app.tutor.enabled ? 'ACTIEF' : 'PAUZE'}`;
  }

  const liveEl = maybeById('humanTutorLiveStatus');
  if (liveEl) {
    const fadeDesc = status.fadeUnlocked
      ? `Zachte fade (${(status.fadeHoldMs / 1000).toFixed(1)}s vast → ${(status.fadeDurationMs / 1000).toFixed(1)}s fade)`
      : `VAST ZICHTBAAR (${status.calmStreak}/${status.requiredFadeBaselineHits} rustige treffers nodig)`;
    liveEl.textContent = `Leerling: "${status.learnerName}" • Doel-throttle: ${fadeDesc} • Stuur-comfort: ${status.steeringComfortPct}% • Laatste besluit: ${status.lastDecision}`;
  }

  // 3. Chronological Tutor Tickers List with 1-tap Human-Tutor feedback buttons
  const listEl = maybeById('tutorTickerList');
  if (listEl) {
    listEl.innerHTML = '';
    const noteInput = maybeById('generalTutorNoteInput', HTMLInputElement);
    for (const tk of app.tutor.tickers) {
      const row = document.createElement('div');
      row.className =
        'bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col gap-1.5 text-xs';

      const topLine = document.createElement('div');
      topLine.className = 'flex flex-wrap items-center justify-between gap-1 mono';
      const titleSpan = document.createElement('span');
      titleSpan.className = 'text-cyan-300 font-bold';
      titleSpan.textContent = `#${tk.seq} [${tk.timeLabel} • ${tk.stageLabel} • ${tk.kind}]`;
      const metricSpan = document.createElement('span');
      metricSpan.className = 'text-slate-400';
      metricSpan.textContent = tk.metricsTag;
      topLine.append(titleSpan, metricSpan);

      const sumDiv = document.createElement('div');
      sumDiv.className = 'text-slate-100';
      sumDiv.textContent = tk.summary;

      row.append(topLine, sumDiv);

      if (tk.dutchSpeech) {
        const speechDiv = document.createElement('div');
        speechDiv.className = 'text-amber-300 italic';
        speechDiv.textContent = `🗣️ NL Stem: "${tk.dutchSpeech}"`;
        row.appendChild(speechDiv);
      }

      const actions = document.createElement('div');
      actions.className = 'flex flex-wrap items-center gap-1 pt-0.5';
      const reactions: ReadonlyArray<{ tag: string; label: string }> = [
        { tag: 'GOED_MENSELIJK', label: '👍 Goed' },
        { tag: 'TE_SNEL_ AGRESSIEF', label: '🐢 Te snel' },
        { tag: 'MAG_VLOTTER', label: '⚡ Mag vlotter' },
        { tag: 'STEM_FEEDBACK', label: '🗣️ Stem-tip' },
      ];
      for (const r of reactions) {
        const rBtn = document.createElement('button');
        rBtn.type = 'button';
        rBtn.className =
          'px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 mono';
        rBtn.style.fontSize = '11px';
        rBtn.textContent = r.label;
        rBtn.addEventListener('click', () => {
          const extra = noteInput ? noteInput.value.trim() : '';
          app.feedback.addTickerFeedback(tk, r.tag, extra, getTutorSnapshot(app));
          if (noteInput) noteInput.value = '';
          app.feedback.copyToClipboard(getTutorSnapshot(app), app.tutor.tickers);
          renderHumanTutorModal(app);
          app.hud.showToast(
            `📋 TICKER #${tk.seq} TOEGEVOEGD (${app.feedback.entries.length} totaal)`,
            'Accumulatief gekopieerd naar het klembord!',
            'border-emerald-400',
          );
        });
        actions.appendChild(rBtn);
      }
      row.appendChild(actions);
      listEl.appendChild(row);
    }
  }

  // 4. Accumulative Clipboard Buffer Textarea
  const bufTa = maybeById('humanTutorBufferTextarea', HTMLTextAreaElement);
  if (bufTa) {
    bufTa.value = app.feedback.formatClipboardReport(status, app.tutor.tickers);
  }
}

/** Opens the quick `Ctrl+Alt+G` / `Pick GUI` comment dialog for a resolved GUI target. */
function openQuickGuiCommentDialog(app: LabApp, target: ResolvedGuiTarget): void {
  const modal = maybeById('quickGuiCommentModal');
  const idBadge = maybeById('quickGuiTargetId');
  const descEl = maybeById('quickGuiTargetDesc');
  const input = maybeById('quickGuiCommentInput', HTMLInputElement);
  const countBadge = maybeById('quickGuiAccumCount');
  if (!modal || !input) return;

  if (idBadge) idBadge.textContent = target.guiId;
  if (descEl) {
    descEl.textContent = `${target.label} (${target.domSelector}) • ${target.rect.x},${target.rect.y} ${target.rect.w}x${target.rect.h}${target.extraDetail ? ` • ${target.extraDetail}` : ''}`;
  }
  if (countBadge) {
    countBadge.textContent = `Buffer: ${app.feedback.entries.length} items (accumulatief)`;
  }

  modal.dataset.pendingGuiJson = JSON.stringify(target);
  input.value = '';
  modal.classList.remove('hidden');
  setTimeout(() => input.focus(), 20);
}

/** Wires `Ctrl+Alt+G` GUI Element Inspector, Touch/Mouse GUI Picker, Learner Profiles & Human-Tutor Modal. */
export function bindHumanTutorAndGuiFeedback(app: LabApp): void {
  const openModal = () => {
    renderHumanTutorModal(app);
    maybeById('humanTutorModal')?.classList.remove('hidden');
  };

  onClick('btnHumanTutor', openModal, { stopPropagation: true });
  onClick('btnLearnerProfile', openModal, { stopPropagation: true });
  onClick('btnCloseHumanTutorModal', () => {
    maybeById('humanTutorModal')?.classList.add('hidden');
  });

  // Switch / Create Learner Nickname Profile
  const submitNickname = () => {
    const inp = maybeById('learnerNicknameInput', HTMLInputElement);
    if (!inp) return;
    const raw = inp.value.trim();
    if (!raw) return;
    app.switchLearnerProfile(raw);
    inp.value = '';
    renderHumanTutorModal(app);
    app.hud.showToast(
      `👶 PROFIEL AANGEMAAKT: ${app.persistence.activeNickname}`,
      'Eigen leesniveau & stuur-kalibratie opgeslagen in browser.',
      'border-emerald-400',
    );
  };
  onClick('btnSaveLearnerNickname', submitNickname);
  maybeById('learnerNicknameInput', HTMLInputElement)?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitNickname();
    }
  });

  // Toggle Embedded Tutor Active/Paused
  onClick('btnToggleEmbeddedTutor', () => {
    app.tutor.enabled = !app.tutor.enabled;
    app.flow.configureGoalMemoryParameters();
    app.flow.syncStageUI();
    app.tutor.logExternalEvent(
      app.tutor.enabled ? 'STEADY_HOLD' : 'THROTTLE_BACK',
      currentLevelLabel(app),
      app.tutor.enabled
        ? 'Embedded Tutor geactiveerd (zachte doel-fade & ZPD bewaking aan).'
        : 'Embedded Tutor gepauzeerd door Human-Tutor (doel blijft 100% vast zichtbaar).',
    );
    renderHumanTutorModal(app);
  });

  // General Human-Tutor Note (+ Accumulative Clipboard Copy)
  const submitGeneralNote = () => {
    const inp = maybeById('generalTutorNoteInput', HTMLInputElement);
    if (!inp) return;
    const txt = inp.value.trim();
    if (!txt) return;
    app.feedback.addGeneralTutorNote(txt, getTutorSnapshot(app), currentLevelLabel(app));
    inp.value = '';
    app.feedback.copyToClipboard(getTutorSnapshot(app), app.tutor.tickers);
    renderHumanTutorModal(app);
    app.hud.showToast(
      `📋 NOTITIE #${app.feedback.entries.length} GEKOPIEERD!`,
      'Toegevoegd aan accumulatieve klembord-buffer.',
      'border-emerald-400',
    );
  };
  onClick('btnAddGeneralTutorNote', submitGeneralNote);
  maybeById('generalTutorNoteInput', HTMLInputElement)?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitGeneralNote();
    }
  });

  // Copy All & Clear Buffer Buttons
  onClick('btnCopyHumanTutorBuffer', () => {
    const text = app.feedback.copyToClipboard(getTutorSnapshot(app), app.tutor.tickers);
    const bufTa = maybeById('humanTutorBufferTextarea', HTMLTextAreaElement);
    if (bufTa) {
      bufTa.value = text;
      bufTa.focus();
      bufTa.select();
    }
    app.hud.showToast(
      `📋 VOLLEDIGE BUFFER GEKOPIEERD (${app.feedback.entries.length} items)`,
      'Plak direct in de chat voor co-design feedback!',
      'border-emerald-400',
    );
  });

  onClick('btnClearHumanTutorBuffer', () => {
    app.feedback.clear();
    renderHumanTutorModal(app);
    app.hud.showToast(
      '🗑️ FEEDBACK-BUFFER GEWIST',
      'Klaar voor een nieuwe reeks aantekeningen.',
      'border-rose-500',
    );
  });

  // Interactive Touch/Click GUI Picker (works on Android phones as well as desktop!)
  onClick('btnStartGuiPick', () => {
    maybeById('humanTutorModal')?.classList.add('hidden');
    app.guiPickModeActive = true;
    document.body.classList.add('cursor-crosshair');
    app.hud.showToast(
      '🎯 TIK OP EEN GUI- OF CANVAS-ELEMENT!',
      'Tik op elk gewenst onderdeel om de GUI_ID + je opmerking vast te leggen.',
      'border-purple-400',
    );
  });

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (!app.guiPickModeActive) return;
      e.preventDefault();
      e.stopPropagation();
      app.guiPickModeActive = false;
      document.body.classList.remove('cursor-crosshair');
      const resolved = resolveGuiTargetAtPoint(app, e.clientX, e.clientY);
      openQuickGuiCommentDialog(app, resolved);
    },
    true,
  );

  // Quick GUI Comment Modal (Ctrl+Alt+G)
  const commitQuickComment = () => {
    const modal = byId('quickGuiCommentModal');
    const input = byId('quickGuiCommentInput', HTMLInputElement);
    const rawTarget = modal.dataset.pendingGuiJson;
    if (!rawTarget) return;
    const parsedTarget = JSON.parse(rawTarget) as ResolvedGuiTarget;
    const entry = app.feedback.addGuiComment(
      parsedTarget,
      input.value,
      getTutorSnapshot(app),
      currentLevelLabel(app),
    );
    app.feedback.copyToClipboard(getTutorSnapshot(app), app.tutor.tickers);
    modal.classList.add('hidden');
    syncHumanTutorBadges(app);
    app.hud.showToast(
      `📋 #${entry.index} [${entry.guiId}] GEKOPIEERD!`,
      `Accumulatief opgeslagen (${app.feedback.entries.length} items in klembord).`,
      'border-emerald-400',
    );
  };

  onClick('btnQuickGuiSave', commitQuickComment);
  onClick('btnQuickGuiOpenTutor', () => {
    const inp = maybeById('quickGuiCommentInput', HTMLInputElement);
    const modal = maybeById('quickGuiCommentModal');
    if (
      modal &&
      !modal.classList.contains('hidden') &&
      modal.dataset.pendingGuiJson &&
      inp?.value.trim()
    ) {
      commitQuickComment();
    } else {
      modal?.classList.add('hidden');
    }
    openModal();
  });
  onClick('btnQuickGuiCancel', () => {
    maybeById('quickGuiCommentModal')?.classList.add('hidden');
  });

  maybeById('quickGuiCommentInput', HTMLInputElement)?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitQuickComment();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      maybeById('quickGuiCommentModal')?.classList.add('hidden');
    }
  });

  // Global Shortcut: Ctrl + Alt + G -> Capture GUI_ID under cursor + accumulative comment -> Clipboard!
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && (e.code === 'KeyG' || e.key.toLowerCase() === 'g')) {
      e.preventDefault();
      const cx = app.winCursor.x || window.innerWidth / 2;
      const cy = app.winCursor.y || window.innerHeight / 2;
      const resolved = resolveGuiTargetAtPoint(app, cx, cy);
      openQuickGuiCommentDialog(app, resolved);
    }
  });

  syncHumanTutorBadges(app);
}
