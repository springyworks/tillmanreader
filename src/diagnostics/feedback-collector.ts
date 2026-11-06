import type { TutorStatusSnapshot, TutorTickerItem } from '../engines/embedded-tutor-engine';
import type { ResolvedGuiTarget } from './gui-inspector';
import { TimeStampUtil } from '../util/timestamp';

/** Source of an accumulated feedback item: `Ctrl+Alt+G` GUI inspect, a Tutor Ticker reaction, or a general note. */
export type FeedbackEntrySource = 'CTRL_ALT_G_GUI' | 'TUTOR_TICKER' | 'HUMAN_TUTOR_NOTE';

export interface FeedbackEntry {
  readonly index: number;
  readonly isoTime: string;
  readonly source: FeedbackEntrySource;
  readonly guiId: string;
  readonly guiLabel: string;
  readonly domSelector: string;
  readonly rectSummary: string;
  readonly comment: string;
  readonly reactionTag?: string;
  readonly tickerRef?: string;
  readonly stateContext: string;
}

const STORAGE_KEY = 'TILLMANN_ACCUMULATIVE_FEEDBACK_V1';

function isStoredEntryArray(val: unknown): val is FeedbackEntry[] {
  return (
    Array.isArray(val) &&
    val.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).guiId === 'string' &&
        typeof (item as Record<string, unknown>).comment === 'string',
    )
  );
}

/**
 * Accumulative GUI (`Ctrl+Alt+G`) & Human-Tutor Feedback Collector:
 * Every note appends to a persistent clipboard-ready log so the user can inspect multiple
 * GUI elements and tutor ticker decisions in one session and paste them all at once.
 */
export class FeedbackCollector {
  entries: FeedbackEntry[] = [];
  private readonly fallbackMemory = new Map<string, string>();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? this.fallbackMemory.get(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (isStoredEntryArray(parsed)) {
        this.entries = parsed;
      }
    } catch {
      this.entries = [];
    }
  }

  private persist(): void {
    const json = JSON.stringify(this.entries);
    this.fallbackMemory.set(STORAGE_KEY, json);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // In-memory map preserves entries when storage is restricted.
    }
  }

  addGuiComment(
    target: ResolvedGuiTarget,
    comment: string,
    tutorStatus: TutorStatusSnapshot,
    levelLabel: string,
  ): FeedbackEntry {
    const ts = TimeStampUtil.nowPacket();
    const entry: FeedbackEntry = {
      index: this.entries.length + 1,
      isoTime: ts.iso,
      source: 'CTRL_ALT_G_GUI',
      guiId: target.guiId,
      guiLabel: target.label,
      domSelector: target.domSelector,
      rectSummary: `${target.rect.x},${target.rect.y} (${target.rect.w}x${target.rect.h})${target.extraDetail ? ` • ${target.extraDetail}` : ''}`,
      comment: comment.trim() || '(GUI element captured without extra comment)',
      stateContext: `learner="${tutorStatus.learnerName}" • ${levelLabel} • fade=${tutorStatus.fadeUnlocked ? `${tutorStatus.fadeHoldMs}ms→${tutorStatus.fadeDurationMs}ms` : `STEADY(${tutorStatus.calmStreak}/${tutorStatus.requiredFadeBaselineHits})`} • comfort=${tutorStatus.steeringComfortPct}%`,
    };
    this.entries.push(entry);
    this.persist();
    return entry;
  }

  addTickerFeedback(
    ticker: TutorTickerItem,
    reactionTag: string,
    comment: string,
    tutorStatus: TutorStatusSnapshot,
  ): FeedbackEntry {
    const ts = TimeStampUtil.nowPacket();
    const entry: FeedbackEntry = {
      index: this.entries.length + 1,
      isoTime: ts.iso,
      source: 'TUTOR_TICKER',
      guiId: `TUTOR_TICKER_${ticker.kind}`,
      guiLabel: `[#${ticker.seq} ${ticker.stageLabel}] ${ticker.summary}`,
      domSelector: `#humanTutorModal :: Ticker#${ticker.seq}`,
      rectSummary: ticker.metricsTag,
      reactionTag,
      tickerRef: `#${ticker.seq} (${ticker.timeLabel}) ${ticker.dutchSpeech ? `🗣️ "${ticker.dutchSpeech}"` : ''}`,
      comment: comment.trim() || reactionTag,
      stateContext: `learner="${tutorStatus.learnerName}" • streak=${tutorStatus.calmStreak} • comfort=${tutorStatus.steeringComfortPct}%`,
    };
    this.entries.push(entry);
    this.persist();
    return entry;
  }

  addGeneralTutorNote(
    comment: string,
    tutorStatus: TutorStatusSnapshot,
    levelLabel: string,
  ): FeedbackEntry {
    const ts = TimeStampUtil.nowPacket();
    const entry: FeedbackEntry = {
      index: this.entries.length + 1,
      isoTime: ts.iso,
      source: 'HUMAN_TUTOR_NOTE',
      guiId: 'EMBEDDED_TUTOR_GENERAL',
      guiLabel: 'Human-Tutor Pedagogical Note',
      domSelector: '#btnHumanTutor',
      rectSummary: `lastDecision="${tutorStatus.lastDecision}"`,
      comment: comment.trim() || '(General tutor checkpoint)',
      stateContext: `learner="${tutorStatus.learnerName}" • ${levelLabel} • fade=${tutorStatus.fadeUnlocked ? `${tutorStatus.fadeHoldMs}ms` : 'STEADY'} • speech="${tutorStatus.lastDutchSpeech}"`,
    };
    this.entries.push(entry);
    this.persist();
    return entry;
  }

  clear(): void {
    this.entries = [];
    this.persist();
  }

  /** Formats the entire accumulated buffer + recent tutor tickers for pasting straight into chat. */
  formatClipboardReport(
    tutorStatus: TutorStatusSnapshot,
    recentTickers: readonly TutorTickerItem[],
  ): string {
    const lines: string[] = [
      `=== TILLMANN HUMAN-TUTOR & GUI FEEDBACK BUFFER (${this.entries.length} items) ===`,
      `Learner: "${tutorStatus.learnerName}" | Tutor Active: ${tutorStatus.enabled} | Comfort: ${tutorStatus.steeringComfortPct}%`,
      `Goal Throttle: ${tutorStatus.fadeUnlocked ? `FADE (${tutorStatus.fadeHoldMs}ms hold -> ${tutorStatus.fadeDurationMs}ms fade)` : `STEADY (${tutorStatus.calmStreak}/${tutorStatus.requiredFadeBaselineHits} calm hits)`}`,
      `Last Tutor Decision: ${tutorStatus.lastDecision}`,
      tutorStatus.lastDutchSpeech ? `Last Dutch Voice: "${tutorStatus.lastDutchSpeech}"` : '',
      '',
    ].filter((l) => l !== '');

    if (this.entries.length === 0) {
      lines.push('(No manual notes added yet — recent Tutor Tickers attached below)');
    } else {
      for (const e of this.entries) {
        lines.push(
          `[${e.index}] ${e.source} | GUI_ID: ${e.guiId} (${e.domSelector})`,
          `    Element/Ticker: ${e.guiLabel}`,
          e.tickerRef ? `    Ticker Detail : ${e.tickerRef}` : '',
          `    Geometry/Stats: ${e.rectSummary}`,
          `    Tutor Context : ${e.stateContext}`,
          `    >>> COMMENT   : ${e.reactionTag ? `[${e.reactionTag}] ` : ''}${e.comment}`,
          '',
        );
      }
    }

    if (recentTickers.length > 0) {
      lines.push('--- Recent Built-in Tutor Tickers (latest 10) ---');
      for (const t of recentTickers.slice(0, 10)) {
        lines.push(
          `  #${t.seq} [${t.timeLabel} • ${t.stageLabel} • ${t.kind}] ${t.summary}${t.dutchSpeech ? ` | 🗣️ "${t.dutchSpeech}"` : ''} (${t.metricsTag})`,
        );
      }
    }

    return lines.filter((l) => l !== undefined).join('\n');
  }

  /** Copies the full accumulative report to the system clipboard (with hidden textarea fallback). */
  copyToClipboard(
    tutorStatus: TutorStatusSnapshot,
    recentTickers: readonly TutorTickerItem[],
  ): string {
    const text = this.formatClipboardReport(tutorStatus, recentTickers);
    try {
      const tempTa = document.createElement('textarea');
      tempTa.value = text;
      tempTa.style.position = 'fixed';
      tempTa.style.left = '-9999px';
      document.body.appendChild(tempTa);
      tempTa.select();
      document.execCommand('copy');
      document.body.removeChild(tempTa);
    } catch {
      // Async clipboard API below handles modern browsers.
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    return text;
  }
}
