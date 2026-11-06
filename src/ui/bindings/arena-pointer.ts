import type { LabApp } from '../../app/lab-app';
import { byId, maybeById } from '../../util/dom';

/** Puts the scoop-visor handle at (x, y), kept inside the safe arena, with the visor floating above it. */
function placeScoopHandle(app: LabApp, x: number, y: number): void {
  const sv = app.scoopVisor;
  const { safeLeft, safeRight, safeBottom } = app.layout.getSafeArenaCenter();
  sv.handleX = Math.max(safeLeft + 16, Math.min(safeRight - 16, x));
  sv.handleY = Math.max(sv.offsetY + 16, Math.min(safeBottom - 10, y));
  sv.visorX = sv.handleX;
  sv.visorY = sv.handleY - sv.offsetY;
}

/** Latches the onset of movement and the end of the primary ballistic surge from the pointer speed. */
function latchBallisticPhases(app: LabApp, aimX: number, aimY: number, now: number): void {
  const distFromStart = Math.hypot(aimX - app.trialStartPos.x, aimY - app.trialStartPos.y);
  let activeTarget = app.target;
  if (app.level === 7 && app.readingTargets.length > 0) {
    activeTarget = app.readingTargets.find((rt) => rt.isTarget) ?? app.readingTargets[0];
  }
  const totalTargetChord = activeTarget
    ? Math.max(
        45,
        Math.hypot(activeTarget.x - app.trialStartPos.x, activeTarget.y - app.trialStartPos.y),
      )
    : 160;

  // Require genuine directed velocity (> 95 px/s and > 14 px displacement from trial start) to latch moveOnsetTime
  if (app.moveOnsetTime === 0 && app.telemetry.instSpeed > 95 && distFromStart > 14) {
    app.moveOnsetTime = now;
  }
  if (app.moveOnsetTime > 0) {
    if (app.telemetry.instSpeed > app.trialPeakSpeed) {
      app.trialPeakSpeed = app.telemetry.instSpeed;
      app.peakVelTime = now;
    } else if (
      app.peakVelTime > 0 &&
      app.decelOnsetTime === 0 &&
      now - app.moveOnsetTime >= 110 &&
      distFromStart >= totalTargetChord * 0.32 &&
      app.trialPeakSpeed > 180 &&
      app.telemetry.instSpeed < app.trialPeakSpeed * 0.62
    ) {
      // Latch end of Primary Ballistic Surge after at least 110ms of flight and 32% of chord distance
      app.decelOnsetTime = now;
    }
  }
}

function onArenaPointerMove(app: LabApp, e: PointerEvent): void {
  if (app.guiPickModeActive) return;
  const now = performance.now();
  const sv = app.scoopVisor;
  const dragging = sv.enabled && sv.isDragging;
  if (dragging && sv.pointerId !== null && e.pointerId !== sv.pointerId) return;

  // Update Anti-FFP Scoop-Visor coordinates with preserved grab offset (zero jump/snap!)
  if (dragging) {
    const prevVx = sv.visorX;
    const prevVy = sv.visorY;
    placeScoopHandle(app, e.offsetX - sv.grabOffsetX, e.offsetY - sv.grabOffsetY);
    sv.dragPathLen += Math.hypot(sv.visorX - prevVx, sv.visorY - prevVy);
    app.layout.updateScoopVisorCandidate();
  }

  // Use the upper Scoop Visor as the active aiming coordinate when dragging so Fitts/Tillman & L3 Spiral track the unobstructed visor!
  const aimX = dragging ? sv.visorX : e.offsetX;
  const aimY = dragging ? sv.visorY : e.offsetY;

  app.cursor = { x: aimX, y: aimY };
  app.telemetry.recordPointerMove(e, now);
  app.gesture.pushSample(aimX, aimY, now);

  const { h } = app.layout.getSafeArenaCenter();
  const nearBottom = h - e.offsetY < 48 && app.telemetry.instSpeed < 380;
  byId('telemetryDrawer').classList.toggle('proximity-glow', nearBottom);

  // HOVER-TO-REVEAL TOP GOAL SENSOR DETECTOR:
  // Triggered either by cursor OR by steering the upper Scoop Visor into the top goal zone!
  app.hits.updateTopGoalHoverSensor(aimX, aimY, now);

  app.trail.push({ x: aimX, y: aimY, t: now, speed: app.telemetry.instSpeed });
  if (app.trail.length > 75) app.trail.shift();

  if (app.trialStartTime > 0) {
    latchBallisticPhases(app, aimX, aimY, now);
  }

  if (app.level === 3 && app.spiral.active) {
    app.hits.updateSpiralProgress(now);
  }
}

/**
 * KID-FIRST INSTANT ENGAGEMENT, on the very first touch/click inside the game arena:
 * 1) Unlock WebAudio Funny Phonetic Synthesizer & greet the learner warmly in Dutch!
 * 2) If on mobile/tablet (and not blocked by an iframe), automatically enter Fullscreen!
 */
function unlockOnFirstTouch(app: LabApp, e: PointerEvent): void {
  if (app.firstTouchUnlocked) return;
  app.firstTouchUnlocked = true;
  if (app.voiceEngine.enabled) {
    app.voiceEngine.ensureContext();
    const heroAudioText = maybeById('heroAudioText');
    if (heroAudioText) heroAudioText.textContent = 'STEM: AAN';
    const who = app.tutor.vocative();
    if (app.level === 7 && app.activeReadingItem) {
      app.voiceEngine.speakDutchTutor(
        `Hoi ${who}! Pak het blauwe handvat bovenaan en sleep rustig.`,
        app.activeReadingItem.target,
      );
    } else {
      app.voiceEngine.speakDutchTutor(`Hoi ${who}! Veel plezier!`);
    }
  }
  const isMobileTouch = window.innerWidth < 900 || e.pointerType === 'touch';
  const inIframe = window.self !== window.top;
  if (
    isMobileTouch &&
    !inIframe &&
    !document.fullscreenElement &&
    document.documentElement.requestFullscreen
  ) {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }
}

/** Handles a tap on the floating "🔊 TAP TO ENABLE FUNNY VOICES!" pill; returns whether it was hit. */
function tapEnablesVoice(app: LabApp, e: PointerEvent): boolean {
  const r = app.audioPromptRect;
  if (app.voiceEngine.enabled || !r) return false;
  const hit =
    e.offsetX >= r.x && e.offsetX <= r.x + r.w && e.offsetY >= r.y && e.offsetY <= r.y + r.h;
  if (!hit) return false;

  const isOn = app.voiceEngine.toggleAudio();
  maybeById('btnHeroAudio')?.classList.toggle('audio-on', isOn);
  byId('heroAudioIcon').textContent = isOn ? '🔊' : '🔇';
  byId('heroAudioText').textContent = 'STEM & FX: AAN';
  app.hud.showToast(
    '🔊 NEDERLANDSE STEM & KLANKGRAPPEN AAN!',
    'De ingebouwde tutor moedigt nu in het Nederlands aan!',
    'border-amber-400',
  );
  return true;
}

let strayTapCount = 0;

/**
 * Starts a scoop-visor drag ONLY when grabbing the Scoop Pad, Upper Visor, or Goal Center Dock.
 * Never teleports the Scoop-Visor to distant stray taps across the arena!
 */
function grabScoopVisor(app: LabApp, e: PointerEvent, now: number): void {
  const sv = app.scoopVisor;
  const distToHandle = Math.hypot(e.offsetX - sv.handleX, e.offsetY - sv.handleY);
  const distToVisor = Math.hypot(e.offsetX - sv.visorX, e.offsetY - sv.visorY);
  const goalRect = app.arenaRenderer.lastGoalCenterRect;
  const inGoalBox =
    goalRect !== null &&
    e.offsetX >= goalRect.x - 12 &&
    e.offsetX <= goalRect.x + goalRect.w + 12 &&
    e.offsetY >= goalRect.y - 12 &&
    e.offsetY <= goalRect.y + goalRect.h + 16 &&
    Math.hypot(
      sv.visorX - (goalRect.x + goalRect.w / 2),
      sv.visorY - (goalRect.y + goalRect.h / 2),
    ) <= 75;

  const withinGrabZone =
    distToHandle <= sv.handleR * 1.95 || distToVisor <= sv.visorR * 1.7 || inGoalBox;

  if (!withinGrabZone) {
    // Do NOT jump/teleport the visor! Pulse the Goal-Center handle and guide the learner gently.
    sv.nudgePulse = 1.0;
    strayTapCount++;
    app.hud.showToast(
      '👆 PAK HET BLAUWE HANDVAT BOVENAAN!',
      'Sleep vanaf het doel-vak bovenaan rustig naar de juiste letter.',
      'border-amber-400',
    );
    if (strayTapCount >= 2) {
      strayTapCount = 0;
      const who = app.tutor.vocative();
      const hint = `Pak eerst het blauwe handvat bij het doel bovenaan, ${who}, en sleep het naar beneden.`;
      app.tutor.logExternalEvent(
        'GIMBAL_ASSIST',
        `L${app.level}`,
        'Losse tik buiten het Scoop-handvat — handvat bij doel-centrum oplichtend gemaakt.',
        hint,
        `tap=(${Math.round(e.offsetX)},${Math.round(e.offsetY)})`,
      );
      app.voiceEngine.speakDutchTutor(hint);
    } else {
      app.voiceEngine.playPreset('ASK_GLISS');
    }
    return;
  }

  strayTapCount = 0;
  sv.isDragging = true;
  sv.pointerId = e.pointerId;
  sv.dragStartTime = now;
  sv.dragPathLen = 0;
  // Preserve exact finger-to-handle offset so the first pointermove never snaps!
  sv.grabOffsetX = e.offsetX - sv.handleX;
  sv.grabOffsetY = e.offsetY - sv.handleY;

  app.cursor = { x: sv.visorX, y: sv.visorY };
  app.trialStartPos = { x: sv.visorX, y: sv.visorY };
  app.trialPeakSpeed = 0;
  app.peakVelTime = 0;
  app.decelOnsetTime = 0;
  app.layout.updateScoopVisorCandidate();

  // In Level 3 Spiral, grabbing the Visor at START immediately activates the spiral run
  if (app.level === 3 && app.spiral.path.length > 0 && !app.spiral.active) {
    const startPt = app.spiral.path[0];
    if (Math.hypot(sv.visorX - startPt.x, sv.visorY - startPt.y) <= startPt.w * 2.0) {
      app.spiral.active = true;
      app.spiral.startTime = now;
      app.spiral.progress = 0;
      app.spiral.insideSamples = 1;
      app.spiral.totalSamples = 1;
      app.trialStartTime = now;
    }
  }
  try {
    app.canvas.setPointerCapture(e.pointerId);
  } catch {
    // The pointer may already be gone; dragging still works without capture.
  }
}

function onArenaPointerDown(app: LabApp, e: PointerEvent): void {
  if (app.guiPickModeActive) return;
  const now = performance.now();
  const sv = app.scoopVisor;
  if (sv.enabled && sv.isDragging && sv.pointerId !== null && e.pointerId !== sv.pointerId) {
    return;
  }
  unlockOnFirstTouch(app, e);
  if (tapEnablesVoice(app, e)) return;

  app.telemetry.recordDown(e.offsetX, e.offsetY, now);

  // In L1A Zero-Move Center Tap, allow instant hair-trigger tap
  if (app.level === 1 && app.l1Mode === 'zero') {
    app.cursor = { x: e.offsetX, y: e.offsetY };
    app.hits.handleArenaClick(e.offsetX, e.offsetY, now);
    return;
  }

  if (sv.enabled) {
    grabScoopVisor(app, e, now);
  } else {
    app.cursor = { x: e.offsetX, y: e.offsetY };
    app.hits.handleArenaClick(e.offsetX, e.offsetY, now);
  }
}

/** LIFT FINGER TO DROP (`pointerup` on canvas) when Scoop-Visor is active! */
function onArenaPointerUp(app: LabApp, e: PointerEvent): void {
  if (app.guiPickModeActive) return;
  const now = performance.now();
  const sv = app.scoopVisor;
  if (!sv.enabled || !sv.isDragging) return;
  if (sv.pointerId !== null && e.pointerId !== sv.pointerId) return;

  sv.isDragging = false;
  sv.pointerId = null;
  sv.grabOffsetX = 0;
  sv.grabOffsetY = 0;
  try {
    app.canvas.releasePointerCapture(e.pointerId);
  } catch {
    // Capture was never granted or is already released.
  }

  // Visual drop ripple at the upper Scoop Visor crosshairs
  sv.dropRipples.push({ x: sv.visorX, y: sv.visorY, r: sv.visorR, alpha: 1.0 });

  // Evaluate drop strictly at the upper Scoop-Visor crosshairs (visorX, visorY)
  app.layout.updateScoopVisorCandidate();
  if (sv.hoveredCandidate) {
    app.hits.handleArenaClick(sv.visorX, sv.visorY, now);
  } else {
    // Dropped in empty space: return cleanly to Goal Center dock & offer gentle tutor assist if repeated
    app.layout.resetScoopVisorPosition();
    const assist = app.tutor.recordEmptyVisorDrop(app.level, app.reading.uiFontScale);
    if (assist.recommendedFontScale !== null) {
      app.reading.uiFontScale = assist.recommendedFontScale;
      const lbl = maybeById('lblUiScale');
      if (lbl) lbl.textContent = `${Math.round(assist.recommendedFontScale * 100)}%`;
      app.layout.enforceOnScreenGuard();
    }
    if (assist.dutchSpeech) {
      app.hud.showToast('🔭 EVEN HELPEN MET STUREN', assist.dutchSpeech, 'border-cyan-400');
      app.voiceEngine.speakDutchTutor(assist.dutchSpeech, app.activeReadingItem?.target);
    } else {
      app.voiceEngine.playPreset('ASK_GLISS');
    }
  }
}

/** Resets Scoop-Visor drag cleanly if Android/OS cancels the touch (palm rejection, back swipe, fullscreen transition). */
function onArenaPointerCancel(app: LabApp, e: PointerEvent): void {
  const sv = app.scoopVisor;
  if (!sv.isDragging) return;
  if (sv.pointerId !== null && e.pointerId !== sv.pointerId) return;
  sv.isDragging = false;
  sv.pointerId = null;
  sv.grabOffsetX = 0;
  sv.grabOffsetY = 0;
  sv.hoveredCandidate = null;
  app.layout.resetScoopVisorPosition();
}

/** Arena canvas pointer telemetry with the distance-gated ballistic latch and scoop-visor drag/drop. */
export function bindArenaPointer(app: LabApp): void {
  app.canvas.addEventListener('pointermove', (e) => onArenaPointerMove(app, e));
  app.canvas.addEventListener('pointerdown', (e) => onArenaPointerDown(app, e));
  app.canvas.addEventListener('pointerup', (e) => onArenaPointerUp(app, e));
  app.canvas.addEventListener('pointercancel', (e) => onArenaPointerCancel(app, e));
}
