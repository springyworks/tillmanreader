import { expect, test, type Page } from '@playwright/test';

interface DragCoords {
  level: number;
  trialCount: number;
  visorOffsetY: number;
  handleX: number;
  handleY: number;
  targetX: number;
  targetY: number;
  canvasLeft: number;
  canvasTop: number;
  canvasHeight: number;
}

interface LabWindow {
  labApp?: {
    level: number;
    drawerState: number;
    reading: { stage: number };
    telemetry: { trials: unknown[] };
    persistence: {
      activeNickname: string;
      activeSlug: string;
      previousSessionSummary: unknown;
    };
    goalMemory: { calmFadeUnlocked: boolean; initialShowMs: number };
    tutor: {
      baselineHitsRemaining: number;
      priorKnowledgeCalibrating: boolean;
      tickers: Array<{ seq: number; summary: string; kind: string }>;
    };
    activeMorphs: Array<{ r: number; semanticKey: string }>;
    feedback: { entries: Array<{ guiId: string; comment: string }> };
    arenaRenderer: { lastGoalCenterRect: { x: number; y: number; w: number; h: number } | null };
    scoopVisor: {
      offsetY: number;
      handleX: number;
      handleY: number;
      visorX: number;
      visorY: number;
    };
    target: { x: number; y: number; r: number } | null;
    readingTargets: Array<{ x: number; y: number; r: number; isTarget: boolean; text: string }>;
    canvas: HTMLCanvasElement;
    buildCleanStandaloneHtmlString(): string;
  };
}

async function readDragCoords(page: Page): Promise<DragCoords | null> {
  return page.evaluate((): DragCoords | null => {
    const app = (window as unknown as LabWindow).labApp;
    if (!app) return null;
    const activeTarget =
      app.level === 7 ? (app.readingTargets.find((rt) => rt.isTarget) ?? null) : app.target;
    if (!activeTarget) return null;
    const rect = app.canvas.getBoundingClientRect();
    return {
      level: app.level,
      trialCount: app.telemetry.trials.length,
      visorOffsetY: app.scoopVisor.offsetY,
      handleX: app.scoopVisor.handleX,
      handleY: app.scoopVisor.handleY,
      targetX: activeTarget.x,
      targetY: activeTarget.y,
      canvasLeft: rect.left,
      canvasTop: rect.top,
      canvasHeight: rect.height,
    };
  });
}

async function performScoopDragToTarget(page: Page, coords: DragCoords): Promise<void> {
  const startClientX = coords.canvasLeft + coords.handleX + 6;
  const startClientY = coords.canvasTop + coords.handleY + 5;
  const endClientX = coords.canvasLeft + coords.targetX + 6;
  const endClientY = coords.canvasTop + coords.targetY + coords.visorOffsetY + 5;

  await page.mouse.move(startClientX, startClientY);
  await page.mouse.down();
  await page.mouse.move((startClientX + endClientX) / 2, (startClientY + endClientY) / 2, {
    steps: 5,
  });
  await page.mouse.move(endClientX, endClientY, { steps: 5 });
  await page.mouse.up();
}

test.describe('Tillmann Reader E2E (Desktop & Android Pixel 7)', () => {
  test('opens on Level 2 Tillmann Baseline with both arrows at top-left, Goal Center dock & 14/14 watchdog pass', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');

    await expect(page.locator('#watchdogText')).toHaveText('0 ERR • 14/14 PASS');
    await expect(page.locator('#telemetryDrawer')).toHaveAttribute('data-state', '0');
    await expect(page.locator('#btnHumanTutor')).toBeVisible();
    await expect(page.locator('#btnEraseDataMemory')).toBeVisible();
    await expect(page.locator('#btnPrevLevel')).toBeVisible();
    await expect(page.locator('#btnNextLevel')).toBeVisible();
    await expect(page.locator('#btnLevelUp')).toBeVisible();
    await expect(page.locator('#btnLevelDown')).toBeVisible();
    await expect(page.locator('#tinyLevelIndicator')).toHaveText('L2');

    const viewportCheck = await page.evaluate(() => {
      const header = document.getElementById('topHeader')?.getBoundingClientRect();
      const prevBtn = document.getElementById('btnPrevLevel')?.getBoundingClientRect();
      const nextBtn = document.getElementById('btnNextLevel')?.getBoundingClientRect();
      const stepper = document.getElementById('topLeftLevelStepper')?.getBoundingClientRect();
      const eraseBtn = document.getElementById('btnEraseDataMemory')?.getBoundingClientRect();
      const arena = document.getElementById('arenaContainer')?.getBoundingClientRect();
      const drawer = document.getElementById('telemetryDrawer')?.getBoundingClientRect();
      const handleGrip = document
        .querySelector('#drawerHandle > div:first-child')
        ?.getBoundingClientRect();
      const win = window as unknown as LabWindow;
      const app = win.labApp;
      if (
        !header ||
        !prevBtn ||
        !nextBtn ||
        !stepper ||
        !eraseBtn ||
        !arena ||
        !drawer ||
        !handleGrip ||
        !app
      ) {
        return null;
      }
      const goalRect = app.arenaRenderer.lastGoalCenterRect;
      const t = app.target;

      return {
        level: app.level,
        baselineRem: app.tutor.baselineHitsRemaining,
        trialCount: app.telemetry.trials.length,
        calmFadeUnlocked: app.goalMemory.calmFadeUnlocked,
        activeNickname: app.persistence.activeNickname,
        vw: window.innerWidth,
        vh: window.innerHeight,
        prevLeft: prevBtn.left,
        nextLeft: nextBtn.left,
        nextRight: nextBtn.right,
        stepperLeft: stepper.left,
        stepperRight: stepper.right,
        eraseVisibleInBottomBar:
          eraseBtn.top >= drawer.top - 2 && eraseBtn.bottom <= drawer.bottom + 2,
        arrowsSameRow:
          Math.abs(prevBtn.top - nextBtn.top) <= 4 && Math.abs(prevBtn.top - stepper.top) <= 6,
        arenaHeight: arena.height,
        drawerBottom: drawer.bottom,
        drawerRight: drawer.right,
        gripWidth: handleGrip.width,
        visorDockedInGoal:
          goalRect !== null &&
          Math.abs(app.scoopVisor.visorX - (goalRect.x + goalRect.w / 2)) <= 6 &&
          app.scoopVisor.visorY >= goalRect.y &&
          app.scoopVisor.visorY <= goalRect.y + goalRect.h,
        targetInsideAndClear:
          t !== null &&
          t.x - t.r >= 0 &&
          t.x + t.r <= arena.width &&
          t.y - t.r >= 0 &&
          t.y + t.r <= arena.height &&
          (!goalRect ||
            t.x + t.r < goalRect.x ||
            t.x - t.r > goalRect.x + goalRect.w ||
            t.y - t.r > goalRect.y + goalRect.h),
      };
    });

    expect(errors).toEqual([]);
    expect(viewportCheck).not.toBeNull();
    expect(viewportCheck?.level).toBe(2);
    expect(viewportCheck?.baselineRem).toBe(3);
    expect(viewportCheck?.trialCount).toBe(0);
    expect(viewportCheck?.calmFadeUnlocked).toBe(false);
    expect(viewportCheck?.activeNickname).toBe('Beste leerling');
    // Both ◀ and ▶ are side-by-side at top-left, with ▲/▼ level stepper directly to their right!
    expect(viewportCheck?.arrowsSameRow).toBe(true);
    expect(viewportCheck?.nextLeft).toBeGreaterThan(viewportCheck?.prevLeft ?? 0);
    expect(viewportCheck?.stepperLeft).toBeGreaterThanOrEqual((viewportCheck?.nextRight ?? 0) - 1);
    expect(viewportCheck?.stepperRight).toBeLessThan((viewportCheck?.vw ?? 0) * 0.65);
    expect(viewportCheck?.eraseVisibleInBottomBar).toBe(true);
    expect(viewportCheck?.arenaHeight).toBeGreaterThan(150);
    expect(viewportCheck?.drawerBottom).toBeLessThanOrEqual((viewportCheck?.vh ?? 0) + 1);
    expect(viewportCheck?.drawerRight).toBeLessThanOrEqual((viewportCheck?.vw ?? 0) + 1);
    expect(viewportCheck?.gripWidth).toBeGreaterThan(40);
    expect(viewportCheck?.visorDockedInGoal).toBe(true);
    expect(viewportCheck?.targetInsideAndClear).toBe(true);
  });

  test('completes 3 Level 2 baseline circles into Level 7 Reading, spawns thin-ink morphs & supports top-left ◀ safety step-back', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#watchdogText')).toHaveText('0 ERR • 14/14 PASS');

    const first = await readDragCoords(page);
    expect(first).not.toBeNull();
    if (!first) return;
    expect(first.level).toBe(2);

    // 1. Stray tap far from Goal Center MUST NOT teleport Scoop-Visor
    await page.mouse.click(first.canvasLeft + 24, first.canvasTop + first.canvasHeight - 24);
    const afterStrayTap = await page.evaluate(() => {
      const sv = (window as unknown as LabWindow).labApp?.scoopVisor;
      return sv ? { handleX: sv.handleX, handleY: sv.handleY } : null;
    });
    expect(afterStrayTap?.handleX).toBe(first.handleX);
    expect(afterStrayTap?.handleY).toBe(first.handleY);

    // 2. Complete the 3 baseline circle drags on Level 2 -> must auto-transition to Level 7 Reading!
    for (let i = 0; i < 3; i++) {
      const c = await readDragCoords(page);
      expect(c).not.toBeNull();
      if (!c) return;
      expect(c.level).toBe(2);
      await performScoopDragToTarget(page, c);
    }

    const readingCoords = await readDragCoords(page);
    expect(readingCoords).not.toBeNull();
    if (!readingCoords) return;
    expect(readingCoords.level).toBe(7);
    expect(readingCoords.trialCount).toBe(3);

    // 3. Score a Reading Bubble hit on Level 7 -> spawns celebratory thin-ink morph & logs tutor ticker
    await performScoopDragToTarget(page, readingCoords);

    const afterReadHit = await page.evaluate(() => {
      const app = (window as unknown as LabWindow).labApp;
      return app
        ? {
            level: app.level,
            trials: app.telemetry.trials.length,
            morphCount: app.activeMorphs.length,
            tickers: app.tutor.tickers.length,
          }
        : null;
    });
    expect(afterReadHit?.level).toBe(7);
    expect(afterReadHit?.trials).toBe(4);
    expect(afterReadHit?.morphCount).toBeGreaterThanOrEqual(1);
    expect(afterReadHit?.tickers).toBeGreaterThanOrEqual(3);

    // 4. Top-left ◀ safety button steps cleanly back to Level 2 circles, and ▶ returns to Level 7
    await page.locator('#btnPrevLevel').click();
    expect(await page.evaluate(() => (window as unknown as LabWindow).labApp?.level)).toBe(2);
    await page.locator('#btnNextLevel').click();
    expect(await page.evaluate(() => (window as unknown as LabWindow).labApp?.level)).toBe(7);
  });

  test('supports Ctrl+Alt+G accumulative GUI_ID capture, Voice Emotion + Bach Gloria controls & isolated kid profiles', async ({
    page,
  }) => {
    await page.goto('/');

    const goalScreenPt = await page.evaluate(() => {
      const app = (window as unknown as LabWindow).labApp;
      const gc = app?.arenaRenderer.lastGoalCenterRect;
      const rect = app?.canvas.getBoundingClientRect();
      if (!gc || !rect) return null;
      return { x: rect.left + gc.x + 14, y: rect.top + gc.y + gc.h / 2 };
    });
    expect(goalScreenPt).not.toBeNull();
    if (!goalScreenPt) return;

    await page.mouse.move(goalScreenPt.x, goalScreenPt.y);
    await page.keyboard.press('Control+Alt+KeyG');
    await expect(page.locator('#quickGuiCommentModal')).toBeVisible();
    await expect(page.locator('#quickGuiTargetId')).toHaveText('CANVAS_GOAL_CENTER_BOX');
    await page.locator('#quickGuiCommentInput').fill('Top fading goal center anchor');
    await page.locator('#quickGuiCommentInput').press('Enter');
    await expect(page.locator('#quickGuiCommentModal')).toBeHidden();

    const audioBox = await page.locator('#btnHeroAudio').boundingBox();
    expect(audioBox).not.toBeNull();
    if (audioBox) {
      await page.mouse.move(audioBox.x + audioBox.width / 2, audioBox.y + audioBox.height / 2);
      await page.keyboard.press('Control+Alt+KeyG');
      await expect(page.locator('#quickGuiTargetId')).toHaveText('GUI_HERO_AUDIO');
      await page.locator('#quickGuiCommentInput').fill('Dutch voice toggle button');
      await page.locator('#quickGuiCommentInput').press('Enter');
    }

    await page.locator('#btnHumanTutor').click();
    await expect(page.locator('#humanTutorModal')).toBeVisible();
    await expect(page.locator('#voiceEmotionBar')).toBeVisible();
    await expect(page.locator('#btnPreviewBachGloria')).toBeVisible();
    await page.locator('[data-emo="PLAYFUL_GIGGLE"]').click();
    await page.locator('#btnPreviewBachGloria').click();
    await page.locator('#tutorTickerList button').first().click();

    await page.locator('#learnerNicknameInput').fill('Sem');
    await page.locator('#btnSaveLearnerNickname').click();
    await expect(page.locator('#learnerNameLabel')).toHaveText('Sem');

    const bufValue = await page.locator('#humanTutorBufferTextarea').inputValue();
    expect(bufValue).toContain('3 items');
    expect(bufValue).toContain('CANVAS_GOAL_CENTER_BOX');
    expect(bufValue).toContain('GUI_HERO_AUDIO');
    expect(bufValue).toContain('TUTOR_TICKER_');

    await page.locator('#btnCloseHumanTutorModal').click();
    await expect(page.locator('#humanTutorModal')).toBeHidden();
  });

  test('opens Scopes & 100-Math drawer cleanly without overlapping panels and builds standalone HTML', async ({
    page,
  }) => {
    await page.goto('/');

    await page.locator('[data-dstate="1"]').click();
    await expect(page.locator('#telemetryDrawer')).toHaveAttribute('data-state', '1');
    await page.waitForTimeout(320);

    const scopesLayout = await page.evaluate(() => {
      const s1 = document.getElementById('canvasScope1') as HTMLCanvasElement | null;
      const scopesGrid = document.querySelector('.scopes-grid')?.getBoundingClientRect();
      const guiCard = document
        .getElementById('guiElementsGrid')
        ?.parentElement?.getBoundingClientRect();
      if (!s1 || !scopesGrid || !guiCard) return null;
      return {
        s1Width: s1.width,
        s1Height: s1.height,
        scopesBottom: scopesGrid.bottom,
        guiCardTop: guiCard.top,
      };
    });

    expect(scopesLayout).not.toBeNull();
    expect(scopesLayout?.s1Width).toBeGreaterThan(0);
    expect(scopesLayout?.s1Height).toBeGreaterThan(0);
    expect(scopesLayout?.guiCardTop).toBeGreaterThanOrEqual((scopesLayout?.scopesBottom ?? 0) - 1);

    await page.locator('[data-dstate="2"]').click();
    await expect(page.locator('#telemetryDrawer')).toHaveAttribute('data-state', '2');
    await expect(page.locator('#metrics100Grid > div')).toHaveCount(100);

    const standaloneOk = await page.evaluate(() => {
      const html = (window as unknown as LabWindow).labApp?.buildCleanStandaloneHtmlString() ?? '';
      return html.includes('id="bakedTillmannState"') && html.endsWith('</html>');
    });
    expect(standaloneOk).toBe(true);
  });

  test('steps levels via tiny ▲/▼ arrows, erases webpage memory via bottom service button & fast-forwards prior knowledge on ms dynamics', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#tinyLevelIndicator')).toHaveText('L2');

    // Step UP with tiny ▲ arrow: L2 -> L3 -> S1 -> S2
    await page.locator('#btnLevelUp').click();
    await expect(page.locator('#tinyLevelIndicator')).toHaveText('L3');
    await page.locator('#btnLevelUp').click();
    await expect(page.locator('#tinyLevelIndicator')).toHaveText('S1');
    await page.locator('#btnLevelUp').click();
    await expect(page.locator('#tinyLevelIndicator')).toHaveText('S2');

    // Step DOWN with tiny ▼ arrow: S2 -> S1 -> L3 -> L2 -> 1B
    await page.locator('#btnLevelDown').click();
    await expect(page.locator('#tinyLevelIndicator')).toHaveText('S1');
    await page.locator('#btnLevelDown').click();
    await expect(page.locator('#tinyLevelIndicator')).toHaveText('L3');
    await page.locator('#btnLevelDown').click();
    await expect(page.locator('#tinyLevelIndicator')).toHaveText('L2');
    await page.locator('#btnLevelDown').click();
    await expect(page.locator('#tinyLevelIndicator')).toHaveText('1B');

    // Score a trial first, then erase webpage data-memory via bottom service button
    await page.locator('#btnLevelUp').click(); // back to L2
    const c0 = await readDragCoords(page);
    expect(c0).not.toBeNull();
    if (!c0) return;
    await performScoopDragToTarget(page, c0);

    await page.locator('#btnEraseDataMemory').click();
    await expect(page.locator('#serviceEraseModal')).toBeVisible();
    await page.locator('#btnConfirmEraseMemory').click();
    await expect(page.locator('#serviceEraseModal')).toBeHidden();

    const afterErase = await page.evaluate(() => {
      const app = (window as unknown as LabWindow).labApp;
      return app
        ? {
            trials: app.telemetry.trials.length,
            prevSummary: app.persistence.previousSessionSummary,
            calibrating: app.tutor.priorKnowledgeCalibrating,
            level: app.level,
          }
        : null;
    });
    expect(afterErase?.trials).toBe(0);
    expect(afterErase?.prevSummary).toBeNull();
    expect(afterErase?.calibrating).toBe(true);
    expect(afterErase?.level).toBe(2);

    // Step into S1 via ▲ twice (L2 -> L3 -> S1) and perform 2 fluent drags:
    // Millisecond prior-knowledge pickup must jump stage above S1 automatically!
    await page.locator('#btnLevelUp').click();
    await page.locator('#btnLevelUp').click();
    await expect(page.locator('#tinyLevelIndicator')).toHaveText('S1');

    for (let i = 0; i < 2; i++) {
      const rc = await readDragCoords(page);
      expect(rc).not.toBeNull();
      if (!rc) return;
      await performScoopDragToTarget(page, rc);
    }

    const jumpedStage = await page.evaluate(
      () => (window as unknown as LabWindow).labApp?.reading.stage ?? 0,
    );
    expect(jumpedStage).toBeGreaterThanOrEqual(2);
  });
});
