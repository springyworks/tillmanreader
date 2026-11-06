import { expect, test } from '@playwright/test';

interface LabSnapshot {
  level: number;
  drawerState: number;
  trialCount: number;
  calmFadeUnlocked: boolean;
  activeNickname: string;
  visorOffsetY: number;
  handleX: number;
  handleY: number;
  visorX: number;
  visorY: number;
  goalCenterX: number;
  goalCenterY: number;
  targetX: number;
  targetY: number;
  canvasLeft: number;
  canvasTop: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface LabWindow {
  labApp?: {
    level: number;
    drawerState: number;
    telemetry: { trials: unknown[] };
    persistence: { activeNickname: string; activeSlug: string };
    goalMemory: { calmFadeUnlocked: boolean; initialShowMs: number };
    tutor: { tickers: Array<{ seq: number; summary: string }> };
    feedback: { entries: Array<{ guiId: string; comment: string }> };
    arenaRenderer: { lastGoalCenterRect: { x: number; y: number; w: number; h: number } | null };
    scoopVisor: {
      offsetY: number;
      handleX: number;
      handleY: number;
      visorX: number;
      visorY: number;
    };
    readingTargets: Array<{ x: number; y: number; r: number; isTarget: boolean; text: string }>;
    canvas: HTMLCanvasElement;
    buildCleanStandaloneHtmlString(): string;
  };
}

test.describe('Tillmann Reader E2E (Desktop & Android Pixel 7)', () => {
  test('launches clean for a fresh learner with Embedded Tutor steady hold, Goal Center dock & 14/14 watchdog pass', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');

    await expect(page.locator('#watchdogText')).toHaveText('0 ERR • 14/14 PASS');
    await expect(page.locator('#telemetryDrawer')).toHaveAttribute('data-state', '0');
    await expect(page.locator('#btnHumanTutor')).toBeVisible();

    const viewportCheck = await page.evaluate(() => {
      const header = document.getElementById('topHeader')?.getBoundingClientRect();
      const arena = document.getElementById('arenaContainer')?.getBoundingClientRect();
      const drawer = document.getElementById('telemetryDrawer')?.getBoundingClientRect();
      const handleGrip = document
        .querySelector('#drawerHandle > div:first-child')
        ?.getBoundingClientRect();
      const win = window as unknown as LabWindow;
      const app = win.labApp;
      if (!header || !arena || !drawer || !handleGrip || !app) return null;
      const goalRect = app.arenaRenderer.lastGoalCenterRect;

      return {
        level: app.level,
        trialCount: app.telemetry.trials.length,
        calmFadeUnlocked: app.goalMemory.calmFadeUnlocked,
        activeNickname: app.persistence.activeNickname,
        vw: window.innerWidth,
        vh: window.innerHeight,
        arenaHeight: arena.height,
        drawerBottom: drawer.bottom,
        drawerRight: drawer.right,
        gripWidth: handleGrip.width,
        visorDockedInGoal:
          goalRect !== null &&
          Math.abs(app.scoopVisor.visorX - (goalRect.x + goalRect.w / 2)) <= 6 &&
          app.scoopVisor.visorY >= goalRect.y &&
          app.scoopVisor.visorY <= goalRect.y + goalRect.h,
        bubblesInsideAndClear: app.readingTargets.every(
          (rt) =>
            rt.x - rt.r >= 0 &&
            rt.x + rt.r <= arena.width &&
            rt.y - rt.r >= 0 &&
            rt.y + rt.r <= arena.height &&
            (!goalRect ||
              rt.x + rt.r < goalRect.x ||
              rt.x - rt.r > goalRect.x + goalRect.w ||
              rt.y - rt.r > goalRect.y + goalRect.h),
        ),
      };
    });

    expect(errors).toEqual([]);
    expect(viewportCheck).not.toBeNull();
    expect(viewportCheck?.level).toBe(7);
    expect(viewportCheck?.trialCount).toBe(0);
    expect(viewportCheck?.calmFadeUnlocked).toBe(false);
    expect(viewportCheck?.activeNickname).toBe('Beste leerling');
    expect(viewportCheck?.arenaHeight).toBeGreaterThan(150);
    expect(viewportCheck?.drawerBottom).toBeLessThanOrEqual((viewportCheck?.vh ?? 0) + 1);
    expect(viewportCheck?.drawerRight).toBeLessThanOrEqual((viewportCheck?.vw ?? 0) + 1);
    expect(viewportCheck?.gripWidth).toBeGreaterThan(40);
    expect(viewportCheck?.visorDockedInGoal).toBe(true);
    expect(viewportCheck?.bubblesInsideAndClear).toBe(true);
  });

  test('does NOT teleport Scoop-Visor on stray arena taps and drags smoothly from Goal Center to score a hit', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#watchdogText')).toHaveText('0 ERR • 14/14 PASS');

    const before = await page.evaluate((): LabSnapshot | null => {
      const app = (window as unknown as LabWindow).labApp;
      if (!app) return null;
      const target = app.readingTargets.find((rt) => rt.isTarget);
      const gc = app.arenaRenderer.lastGoalCenterRect;
      if (!target || !gc) return null;
      const rect = app.canvas.getBoundingClientRect();
      return {
        level: app.level,
        drawerState: app.drawerState,
        trialCount: app.telemetry.trials.length,
        calmFadeUnlocked: app.goalMemory.calmFadeUnlocked,
        activeNickname: app.persistence.activeNickname,
        visorOffsetY: app.scoopVisor.offsetY,
        handleX: app.scoopVisor.handleX,
        handleY: app.scoopVisor.handleY,
        visorX: app.scoopVisor.visorX,
        visorY: app.scoopVisor.visorY,
        goalCenterX: gc.x + gc.w / 2,
        goalCenterY: gc.y + gc.h / 2,
        targetX: target.x,
        targetY: target.y,
        canvasLeft: rect.left,
        canvasTop: rect.top,
        canvasWidth: rect.width,
        canvasHeight: rect.height,
      };
    });

    expect(before).not.toBeNull();
    if (!before) return;

    // 1. Tap far away at bottom-left corner of arena -> Scoop-Visor MUST stay docked at Goal Center!
    await page.mouse.click(before.canvasLeft + 24, before.canvasTop + before.canvasHeight - 24);
    const afterStrayTap = await page.evaluate(() => {
      const sv = (window as unknown as LabWindow).labApp?.scoopVisor;
      return sv ? { handleX: sv.handleX, handleY: sv.handleY } : null;
    });
    expect(afterStrayTap?.handleX).toBe(before.handleX);
    expect(afterStrayTap?.handleY).toBe(before.handleY);

    // 2. Grab the Thumb Pad docked below Goal Center (slightly off-center to verify zero grab snap!) and drag onto target
    const startClientX = before.canvasLeft + before.handleX + 8;
    const startClientY = before.canvasTop + before.handleY + 6;
    const endClientX = before.canvasLeft + before.targetX + 8;
    const endClientY = before.canvasTop + before.targetY + before.visorOffsetY + 6;

    await page.mouse.move(startClientX, startClientY);
    await page.mouse.down();
    await page.mouse.move((startClientX + endClientX) / 2, (startClientY + endClientY) / 2, {
      steps: 6,
    });
    await page.mouse.move(endClientX, endClientY, { steps: 6 });
    await page.mouse.up();

    const afterHit = await page.evaluate(() => {
      const app = (window as unknown as LabWindow).labApp;
      return app
        ? { trials: app.telemetry.trials.length, tickers: app.tutor.tickers.length }
        : null;
    });
    expect(afterHit?.trials).toBe(before.trialCount + 1);
    expect(afterHit?.tickers).toBeGreaterThanOrEqual(2);
  });

  test('supports Ctrl+Alt+G accumulative GUI_ID capture, Human-Tutor tickers & isolated kid profiles', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Hover over the Top Goal Center box on Canvas (left of center visor ring) and press Ctrl+Alt+G
    const goalScreenPt = await page.evaluate(() => {
      const app = (window as unknown as LabWindow).labApp;
      const gc = app?.arenaRenderer.lastGoalCenterRect;
      const rect = app?.canvas.getBoundingClientRect();
      if (!gc || !rect) return null;
      return { x: rect.left + gc.x + 18, y: rect.top + gc.y + gc.h / 2 };
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

    // 2. Hover over the Hero Audio DOM button and press Ctrl+Alt+G again -> must ACCUMULATE!
    const audioBox = await page.locator('#btnHeroAudio').boundingBox();
    expect(audioBox).not.toBeNull();
    if (audioBox) {
      await page.mouse.move(audioBox.x + audioBox.width / 2, audioBox.y + audioBox.height / 2);
      await page.keyboard.press('Control+Alt+KeyG');
      await expect(page.locator('#quickGuiTargetId')).toHaveText('GUI_HERO_AUDIO');
      await page.locator('#quickGuiCommentInput').fill('Dutch voice toggle button');
      await page.locator('#quickGuiCommentInput').press('Enter');
    }

    // 3. Open small Human-Tutor button, test Voice Emotion bar, react to a live Tutor Ticker, and create a grandchild profile
    await page.locator('#btnHumanTutor').click();
    await expect(page.locator('#humanTutorModal')).toBeVisible();
    await expect(page.locator('#voiceEmotionBar')).toBeVisible();
    await page.locator('[data-emo="PLAYFUL_GIGGLE"]').click();
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
});
