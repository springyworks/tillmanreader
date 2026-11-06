import { expect, test } from '@playwright/test';

interface LabSnapshot {
  level: number;
  drawerState: number;
  trialCount: number;
  visorOffsetY: number;
  handleX: number;
  handleY: number;
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
  test('launches directly into Tillmann Reader with 14/14 watchdog checks passing', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');

    await expect(page.locator('#watchdogText')).toHaveText('0 ERR • 14/14 PASS');
    await expect(page.locator('#telemetryDrawer')).toHaveAttribute('data-state', '0');

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

      return {
        level: app.level,
        vw: window.innerWidth,
        vh: window.innerHeight,
        headerBottom: header.bottom,
        arenaHeight: arena.height,
        drawerBottom: drawer.bottom,
        drawerRight: drawer.right,
        gripWidth: handleGrip.width,
        bubblesInside: app.readingTargets.every(
          (rt) =>
            rt.x - rt.r >= 0 &&
            rt.x + rt.r <= arena.width &&
            rt.y - rt.r >= 0 &&
            rt.y + rt.r <= arena.height,
        ),
      };
    });

    expect(errors).toEqual([]);
    expect(viewportCheck).not.toBeNull();
    expect(viewportCheck?.level).toBe(7);
    expect(viewportCheck?.arenaHeight).toBeGreaterThan(150);
    expect(viewportCheck?.drawerBottom).toBeLessThanOrEqual((viewportCheck?.vh ?? 0) + 1);
    expect(viewportCheck?.drawerRight).toBeLessThanOrEqual((viewportCheck?.vw ?? 0) + 1);
    expect(viewportCheck?.gripWidth).toBeGreaterThan(40);
    expect(viewportCheck?.bubblesInside).toBe(true);
  });

  test('scores a reading trial when dragging the Anti-FFP Scoop-Visor onto the target letter', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#watchdogText')).toHaveText('0 ERR • 14/14 PASS');

    const before = await page.evaluate((): LabSnapshot | null => {
      const app = (window as unknown as LabWindow).labApp;
      if (!app) return null;
      const target = app.readingTargets.find((rt) => rt.isTarget);
      if (!target) return null;
      const rect = app.canvas.getBoundingClientRect();
      return {
        level: app.level,
        drawerState: app.drawerState,
        trialCount: app.telemetry.trials.length,
        visorOffsetY: app.scoopVisor.offsetY,
        handleX: app.scoopVisor.handleX,
        handleY: app.scoopVisor.handleY,
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

    const startClientX = before.canvasLeft + before.handleX;
    const startClientY = before.canvasTop + before.handleY;
    const endClientX = before.canvasLeft + before.targetX;
    const endClientY = before.canvasTop + before.targetY + before.visorOffsetY;

    await page.mouse.move(startClientX, startClientY);
    await page.mouse.down();
    await page.mouse.move((startClientX + endClientX) / 2, (startClientY + endClientY) / 2, {
      steps: 6,
    });
    await page.mouse.move(endClientX, endClientY, { steps: 6 });
    await page.mouse.up();

    const afterCount = await page.evaluate(
      () => (window as unknown as LabWindow).labApp?.telemetry.trials.length ?? 0,
    );
    expect(afterCount).toBe(before.trialCount + 1);
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
