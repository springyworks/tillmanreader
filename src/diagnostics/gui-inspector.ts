import type { LabApp } from '../app/lab-app';
import type { Rect } from '../types/arena';
import { closestFrom } from '../util/dom';

/** Unambiguous identifier and geometry for whatever GUI widget or Canvas arena object is under the cursor. */
export interface ResolvedGuiTarget {
  readonly guiId: string;
  readonly label: string;
  readonly surface: 'DOM' | 'CANVAS';
  readonly domSelector: string;
  readonly rect: Rect;
  readonly extraDetail?: string;
}

function insideRect(x: number, y: number, r: Rect | null): boolean {
  return r !== null && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function circleToScreenRect(canvasRect: DOMRect, cx: number, cy: number, r: number): Rect {
  return {
    x: Math.round(canvasRect.left + cx - r),
    y: Math.round(canvasRect.top + cy - r),
    w: Math.round(r * 2),
    h: Math.round(r * 2),
  };
}

function canvasRectToScreen(canvasRect: DOMRect, r: Rect): Rect {
  return {
    x: Math.round(canvasRect.left + r.x),
    y: Math.round(canvasRect.top + r.y),
    w: Math.round(r.w),
    h: Math.round(r.h),
  };
}

/** Resolves a canvas-local coordinate `(cx, cy)` inside `#gameArena` to a named Canvas GUI element. */
function resolveCanvasSubElement(
  app: LabApp,
  canvasRect: DOMRect,
  cx: number,
  cy: number,
): ResolvedGuiTarget {
  const sv = app.scoopVisor;

  // 1. Scoop-Visor Lower Thumb Pad & Upper Optical Visor (check first since they float over the arena)
  if (sv.enabled && !(app.level === 1 && app.l1Mode === 'zero')) {
    if (Math.hypot(cx - sv.handleX, cy - sv.handleY) <= sv.handleR * 1.25) {
      return {
        guiId: 'CANVAS_SCOOP_THUMB_PAD',
        label: 'Anti-FFP Lower Scoop Thumb Drag Pad',
        surface: 'CANVAS',
        domSelector: '#gameArena :: ScoopThumbPad',
        rect: circleToScreenRect(canvasRect, sv.handleX, sv.handleY, sv.handleR),
        extraDetail: `handle=(${Math.round(sv.handleX)},${Math.round(sv.handleY)}) offsetY=${Math.round(sv.offsetY)}px`,
      };
    }
    if (Math.hypot(cx - sv.visorX, cy - sv.visorY) <= sv.visorR * 1.15) {
      return {
        guiId: 'CANVAS_SCOOP_VISOR',
        label: 'Upper Optical Scoop-Visor Crosshair',
        surface: 'CANVAS',
        domSelector: '#gameArena :: ScoopVisor',
        rect: circleToScreenRect(canvasRect, sv.visorX, sv.visorY, sv.visorR),
        extraDetail: `visor=(${Math.round(sv.visorX)},${Math.round(sv.visorY)}) locked=${Boolean(sv.hoveredCandidate)}`,
      };
    }
  }

  // 2. Top Goal & Memory Re-Peek Banner
  const banner = app.arenaRenderer.lastBannerRect;
  if (banner && insideRect(cx, cy, banner)) {
    return {
      guiId: 'CANVAS_TOP_GOAL_BANNER',
      label: 'Top Goal & Re-Peek Memory Sensor Banner',
      surface: 'CANVAS',
      domSelector: '#gameArena :: TopGoalBanner',
      rect: canvasRectToScreen(canvasRect, banner),
      extraDetail: `revealAlpha=${app.goalMemory.revealAlpha.toFixed(2)} mode=${app.goalMemory.mode}`,
    };
  }

  // 3. Audio Opt-in Pill (when visible)
  if (app.audioPromptRect && insideRect(cx, cy, app.audioPromptRect)) {
    return {
      guiId: 'CANVAS_AUDIO_OPTIN_PILL',
      label: 'In-Arena Tap-for-Voice Opt-In Pill',
      surface: 'CANVAS',
      domSelector: '#gameArena :: AudioOptInPill',
      rect: canvasRectToScreen(canvasRect, app.audioPromptRect),
    };
  }

  // 4. Top Goal Center Launch Box (fading prompt box near top!)
  const goalBox = app.arenaRenderer.lastGoalCenterRect;
  if (goalBox && insideRect(cx, cy, goalBox)) {
    const promptTxt = app.activeReadingItem ? app.activeReadingItem.target : `L${app.level}`;
    return {
      guiId: 'CANVAS_GOAL_CENTER_BOX',
      label: `Top Goal Center Launch Box ("${promptTxt}" — Fading Goal)`,
      surface: 'CANVAS',
      domSelector: '#gameArena :: GoalCenterBox',
      rect: canvasRectToScreen(canvasRect, goalBox),
      extraDetail: `prompt="${promptTxt}" alpha=${app.goalMemory.revealAlpha.toFixed(2)} holdMs=${app.goalMemory.initialShowMs}`,
    };
  }

  // 5. Level 7 Reading Target & Distractor Bubbles
  if (app.level === 7) {
    for (const rt of app.readingTargets) {
      if (Math.hypot(cx - rt.x, cy - rt.y) <= rt.r * 1.2) {
        return {
          guiId: rt.isTarget ? 'CANVAS_TARGET_BUBBLE' : 'CANVAS_DISTRACTOR_BUBBLE',
          label: rt.isTarget
            ? `Target Reading Bubble ("${rt.text}")`
            : `Distractor Reading Bubble ("${rt.text}")`,
          surface: 'CANVAS',
          domSelector: `#gameArena :: Bubble[${rt.text}]`,
          rect: circleToScreenRect(canvasRect, rt.x, rt.y, rt.r),
          extraDetail: `text="${rt.text}" isTarget=${rt.isTarget} r=${Math.round(rt.r)}px`,
        };
      }
    }
  }

  // 6. Level 1 / Level 2 Pointing Target
  if ((app.level === 1 || app.level === 2) && app.target) {
    if (Math.hypot(cx - app.target.x, cy - app.target.y) <= app.target.r * 1.25) {
      return {
        guiId:
          app.level === 1 && app.l1Mode === 'zero' ? 'CANVAS_PULSE_TARGET' : 'CANVAS_FITTS_TARGET',
        label: `Level ${app.level} Pointing Target`,
        surface: 'CANVAS',
        domSelector: `#gameArena :: Target[L${app.level}]`,
        rect: circleToScreenRect(canvasRect, app.target.x, app.target.y, app.target.r),
        extraDetail: `r=${Math.round(app.target.r)}px pos=(${Math.round(app.target.x)},${Math.round(app.target.y)})`,
      };
    }
  }

  // 7. Level 3 Spiral Tunnel
  if (app.level === 3 && app.spiral.path.length > 0) {
    const startPt = app.spiral.path[0];
    const endPt = app.spiral.path[app.spiral.path.length - 1];
    if (Math.hypot(cx - startPt.x, cy - startPt.y) <= startPt.w * 1.4) {
      return {
        guiId: 'CANVAS_SPIRAL_START',
        label: 'Spiral Tunnel START Disc',
        surface: 'CANVAS',
        domSelector: '#gameArena :: SpiralStart',
        rect: circleToScreenRect(canvasRect, startPt.x, startPt.y, startPt.w),
      };
    }
    if (Math.hypot(cx - endPt.x, cy - endPt.y) <= endPt.w * 1.4) {
      return {
        guiId: 'CANVAS_SPIRAL_GOAL',
        label: 'Spiral Tunnel 12-o-clock GOAL Disc',
        surface: 'CANVAS',
        domSelector: '#gameArena :: SpiralGoal',
        rect: circleToScreenRect(canvasRect, endPt.x, endPt.y, endPt.w),
      };
    }
  }

  return {
    guiId: 'CANVAS_ARENA_FIELD',
    label: 'Play Arena Safe Action Field',
    surface: 'CANVAS',
    domSelector: '#gameArena',
    rect: {
      x: Math.round(canvasRect.left),
      y: Math.round(canvasRect.top),
      w: Math.round(canvasRect.width),
      h: Math.round(canvasRect.height),
    },
    extraDetail: `cursor=(${Math.round(cx)},${Math.round(cy)}) level=${app.level}`,
  };
}

/**
 * Resolves any viewport coordinate `(clientX, clientY)` to a stable named `GUI_ID`,
 * inspecting both DOM `[data-gui-id]` controls and Canvas sub-elements inside `#gameArena`.
 */
export function resolveGuiTargetAtPoint(
  app: LabApp,
  clientX: number,
  clientY: number,
): ResolvedGuiTarget {
  const hitEl = document.elementFromPoint(clientX, clientY);

  if (hitEl === app.canvas) {
    const cRect = app.canvas.getBoundingClientRect();
    return resolveCanvasSubElement(app, cRect, clientX - cRect.left, clientY - cRect.top);
  }

  const tagged = closestFrom<HTMLElement>(hitEl, '[data-gui-id]');
  if (tagged && tagged.dataset.guiId) {
    const r = tagged.getBoundingClientRect();
    const textSnippet = (tagged.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48);
    return {
      guiId: tagged.dataset.guiId,
      label:
        tagged.dataset.guiLabel ||
        tagged.getAttribute('title') ||
        textSnippet ||
        tagged.dataset.guiId,
      surface: 'DOM',
      domSelector: tagged.id ? `#${tagged.id}` : `[data-gui-id="${tagged.dataset.guiId}"]`,
      rect: {
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
    };
  }

  if (hitEl instanceof HTMLElement) {
    const withId = closestFrom<HTMLElement>(hitEl, '[id]') ?? hitEl;
    const r = withId.getBoundingClientRect();
    const rawId = withId.id ? `DOM_${withId.id.toUpperCase()}` : `DOM_${withId.tagName}`;
    return {
      guiId: rawId,
      label: withId.getAttribute('title') || withId.id || withId.tagName.toLowerCase(),
      surface: 'DOM',
      domSelector: withId.id ? `#${withId.id}` : withId.tagName.toLowerCase(),
      rect: {
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
    };
  }

  return {
    guiId: 'VIEWPORT_ROOT',
    label: 'Application Viewport',
    surface: 'DOM',
    domSelector: 'body',
    rect: { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight },
  };
}
