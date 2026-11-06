// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import type { LabApp } from '../../app/lab-app';

/** Arena canvas pointer telemetry with the distance-gated ballistic latch and scoop-visor drag/drop. */
export function bindArenaPointer(app: LabApp): void {
  const drawer = document.getElementById('telemetryDrawer');
  const btnHeroAudio = document.getElementById('btnHeroAudio');

  // Arena Pointer Telemetry (With Distance-Gated Ballistic Surge Latch & Anti-FFP Scoop-Visor Drag)
  app.canvas.addEventListener('pointermove', (e) => {
    const now = performance.now();
    const sv = app.scoopVisor;

    // Update Anti-FFP Scoop-Visor coordinates if dragging (or following mouse when button is down)
    if (sv.enabled && sv.isDragging) {
      const { safeLeft, safeTop, safeRight, safeBottom } = app.layout.getSafeArenaCenter();
      const prevVx = sv.visorX,
        prevVy = sv.visorY;
      sv.handleX = Math.max(safeLeft + 16, Math.min(safeRight - 16, e.offsetX));
      sv.handleY = Math.max(safeTop + sv.offsetY + 14, Math.min(safeBottom - 10, e.offsetY));
      sv.visorX = sv.handleX;
      sv.visorY = sv.handleY - sv.offsetY;
      sv.dragPathLen += Math.hypot(sv.visorX - prevVx, sv.visorY - prevVy);
      app.layout.updateScoopVisorCandidate();
    }

    // Use the upper Scoop Visor as the active aiming coordinate when dragging so Fitts/Tillman & L3 Spiral track the unobstructed visor!
    const aimX = sv.enabled && sv.isDragging ? sv.visorX : e.offsetX;
    const aimY = sv.enabled && sv.isDragging ? sv.visorY : e.offsetY;

    app.cursor = { x: aimX, y: aimY };
    app.telemetry.recordPointerMove(e, now);
    app.gesture.pushSample(aimX, aimY, now);

    const { h } = app.layout.getSafeArenaCenter();
    const nearBottom = h - e.offsetY < 48 && app.telemetry.instSpeed < 380;
    drawer.classList.toggle('proximity-glow', nearBottom);

    // HOVER-TO-REVEAL TOP GOAL SENSOR DETECTOR:
    // Triggered either by cursor OR by steering the upper Scoop Visor into the top goal zone!
    app.hits.updateTopGoalHoverSensor(aimX, aimY, now);

    app.trail.push({ x: aimX, y: aimY, t: now, speed: app.telemetry.instSpeed });
    if (app.trail.length > 75) app.trail.shift();

    if (app.trialStartTime > 0) {
      const distFromStart = Math.hypot(aimX - app.trialStartPos.x, aimY - app.trialStartPos.y);
      let activeTargetObj = app.target;
      if (app.level === 7 && app.readingTargets.length > 0) {
        activeTargetObj = app.readingTargets.find((rt) => rt.isTarget) || app.readingTargets[0];
      }
      const totalTargetChord = activeTargetObj
        ? Math.max(
            45,
            Math.hypot(
              activeTargetObj.x - app.trialStartPos.x,
              activeTargetObj.y - app.trialStartPos.y,
            ),
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

    if (app.level === 3 && app.spiral.active) {
      app.hits.updateSpiralProgress(now);
    }
  });

  app.canvas.addEventListener('pointerdown', (e) => {
    const now = performance.now();
    const sv = app.scoopVisor;

    // KID-FIRST INSTANT ENGAGEMENT:
    // On the very first touch/click inside the game arena:
    // 1) Unlock WebAudio Funny Phonetic Synthesizer & speak the active target letter/word!
    // 2) If on mobile/tablet (and not blocked by an iframe), automatically enter Fullscreen!
    if (!app.firstTouchUnlocked) {
      app.firstTouchUnlocked = true;
      if (app.voiceEngine.enabled) {
        app.voiceEngine.ensureContext();
        const heroAudioText = document.getElementById('heroAudioText');
        if (heroAudioText) heroAudioText.textContent = 'VOICE: ON';
        if (app.level === 7 && app.activeReadingItem) {
          app.voiceEngine.speakReadingItem(app.activeReadingItem, 'ASKING');
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

    // Check if user tapped the floating "🔊 TAP TO ENABLE FUNNY VOICES!" quick-enable pill in the arena
    if (!app.voiceEngine.enabled && app.audioPromptRect) {
      const r = app.audioPromptRect;
      if (
        e.offsetX >= r.x &&
        e.offsetX <= r.x + r.w &&
        e.offsetY >= r.y &&
        e.offsetY <= r.y + r.h
      ) {
        const isOn = app.voiceEngine.toggleAudio();
        const btnHeroAudio = document.getElementById('btnHeroAudio');
        if (btnHeroAudio) btnHeroAudio.classList.toggle('audio-on', isOn);
        document.getElementById('heroAudioIcon').textContent = isOn ? '🔊' : '🔇';
        document.getElementById('heroAudioText').textContent = 'VOICE & FX: ON';
        app.hud.showToast(
          '🔊 FUNNY PHONETIC VOICES ENABLED!',
          'Playing "kjiuueehh!" (q) & expressive human vocal-tract jokes!',
          'border-amber-400',
        );
        return;
      }
    }

    app.telemetry.recordDown(e.offsetX, e.offsetY, now);

    // In L1A Zero-Move Center Tap, allow instant hair-trigger tap OR scoop grab
    if (app.level === 1 && app.l1Mode === 'zero') {
      app.cursor = { x: e.offsetX, y: e.offsetY };
      app.hits.handleArenaClick(e.offsetX, e.offsetY, now);
      return;
    }

    if (sv.enabled) {
      sv.isDragging = true;
      sv.pointerId = e.pointerId;
      sv.dragStartTime = now;
      sv.dragPathLen = 0;

      const distToHandle = Math.hypot(e.offsetX - sv.handleX, e.offsetY - sv.handleY);
      if (distToHandle > sv.handleR * 1.8) {
        const { safeLeft, safeTop, safeRight, safeBottom } = app.layout.getSafeArenaCenter();
        sv.handleX = Math.max(safeLeft + 16, Math.min(safeRight - 16, e.offsetX));
        sv.handleY = Math.max(safeTop + sv.offsetY + 14, Math.min(safeBottom - 10, e.offsetY));
        sv.visorX = sv.handleX;
        sv.visorY = sv.handleY - sv.offsetY;
      }
      app.cursor = { x: sv.visorX, y: sv.visorY };
      // Anchor ballistic chord start to where the Scoop-Visor grab began, and let real drag motion trigger moveOnsetTime!
      app.trialStartPos = { x: sv.visorX, y: sv.visorY };
      if (app.moveOnsetTime === 0 && now - app.trialStartTime > 90) {
        app.moveOnsetTime = now;
      }
      app.trialPeakSpeed = 0;
      app.peakVelTime = 0;
      app.decelOnsetTime = 0;
      app.layout.updateScoopVisorCandidate();

      // In Level 3 Spiral, grabbing & placing the Visor on START immediately activates the spiral run
      if (app.level === 3 && app.spiral.path.length > 0 && !app.spiral.active) {
        const startPt = app.spiral.path[0];
        if (Math.hypot(sv.visorX - startPt.x, sv.visorY - startPt.y) <= startPt.w * 1.8) {
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
      } catch (_) {}
    } else {
      app.cursor = { x: e.offsetX, y: e.offsetY };
      app.hits.handleArenaClick(e.offsetX, e.offsetY, now);
    }
  });

  // LIFT FINGER TO DROP (`pointerup` on canvas) when Scoop-Visor is active!
  app.canvas.addEventListener('pointerup', (e) => {
    const now = performance.now();
    const sv = app.scoopVisor;
    if (sv.enabled && sv.isDragging) {
      sv.isDragging = false;
      try {
        app.canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}

      // Visual drop ripple at the upper Scoop Visor crosshairs
      sv.dropRipples.push({ x: sv.visorX, y: sv.visorY, r: sv.visorR, alpha: 1.0 });

      // If user dragged the Scoop-Visor (or aimed it over a target) and lifted their finger, drop at (visorX, visorY)!
      app.layout.updateScoopVisorCandidate();
      if (sv.hoveredCandidate) {
        app.hits.handleArenaClick(sv.visorX, sv.visorY, now);
      } else if (sv.dragPathLen < 14 && now - sv.dragStartTime < 260) {
        // Quick direct tap fallback if user tapped directly on a target without dragging
        app.hits.handleArenaClick(e.offsetX, e.offsetY, now);
      } else {
        // Dropped in empty space: play gentle questioning glissando
        app.voiceEngine.playPreset('ASK_GLISS');
      }
    }
  });
}
