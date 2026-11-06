import { describe, expect, it } from 'vitest';
import { FeedbackCollector } from './feedback-collector';
import { EmbeddedTutorEngine } from '../engines/embedded-tutor-engine';

describe('FeedbackCollector (accumulative Ctrl+Alt+G & Human-Tutor buffer)', () => {
  it('accumulates multiple GUI element comments and Tutor Ticker reactions without overwriting', () => {
    const collector = new FeedbackCollector();
    collector.clear();

    const tutor = new EmbeddedTutorEngine();
    tutor.resetForLearner('Beste leerling');
    const snap = tutor.getStatusSnapshot('AUTO_PROG', 780, 0);

    collector.addGuiComment(
      {
        guiId: 'CANVAS_GOAL_CENTER_BOX',
        label: 'Top Goal Center Launch Box',
        surface: 'CANVAS',
        domSelector: '#gameArena :: GoalCenterBox',
        rect: { x: 100, y: 60, w: 200, h: 56 },
      },
      'Goal box position near top looks great',
      snap,
      'L7-S1',
    );

    collector.addTickerFeedback(
      tutor.tickers[0],
      'GOED_MENSELIJK',
      'Nice warm Dutch welcome',
      snap,
    );

    expect(collector.entries).toHaveLength(2);
    const report = collector.formatClipboardReport(snap, tutor.tickers);
    expect(report).toContain('CANVAS_GOAL_CENTER_BOX');
    expect(report).toContain('Goal box position near top looks great');
    expect(report).toContain('[GOED_MENSELIJK] Nice warm Dutch welcome');
    expect(report).toContain('2 items');
  });
});
