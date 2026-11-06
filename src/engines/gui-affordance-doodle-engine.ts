// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import { drawRoundRect } from '../render/draw-utils';

/*************************************************************************
 * 3. SELF-REFERENTIAL GUI-ELEMENT ID, LIVE SHANNON DI, EYE-PROXY GAZE
 *    & GUI-ELEMENT DOODLING ENGINE (`GuiAffordanceDoodleEngine`)
 *************************************************************************/
export class GuiAffordanceDoodleEngine {
  constructor(onDoodleCallback) {
    this.onDoodle = onDoodleCallback;
    this.xrayEnabled = false; // Default OFF for calm, distraction-free Tillmann Games play
    this.registry = new Map(); // guiId -> { id, label, el, rect, cx, cy, w, h, effW, liveID, distPx, dwellMs, visits, clicks, doodles, struggleRatio, scale }
    this.samples = []; // Recent 680ms window pointer samples { x, y, t, vx, vy, speed }
    this.doodleRibbons = []; // Visual trails on full-window overlay
    this.activeFocusId = 'NONE';
    this.nearestGui = null;
    this.secondNearestGui = null;
    this.lastDoodleSummary = 'NONE';
    this.totalDoodleEvents = 0;
    this.orbitCount = 0;
    this.underlineCount = 0;
    this.scratchCount = 0;
    this.hesitationCount = 0;
    this.lastTriggerMs = 0;
    this.lastPos = null;
    this.approachStartPoint = null;
    this.approachStartTime = 0;
    this.approachTargetId = null;
  }

  scanDOMElements() {
    const nodes = document.querySelectorAll('[data-gui-id]');
    nodes.forEach((el) => {
      const id = el.dataset.guiId;
      const label = el.dataset.guiLabel || id;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const effW = Math.max(16, Math.min(r.width, r.height));
      if (!this.registry.has(id)) {
        this.registry.set(id, {
          id,
          label,
          el,
          rect: r,
          cx,
          cy,
          w: r.width,
          h: r.height,
          effW,
          liveID: 0,
          distPx: 0,
          dwellMs: 0,
          gazeScanMs: 0,
          visits: 0,
          clicks: 0,
          doodles: 0,
          struggleRatio: 1.0,
          scale: 1.0,
          isHovered: false,
        });
      } else {
        const item = this.registry.get(id);
        item.el = el;
        item.rect = r;
        item.cx = cx;
        item.cy = cy;
        item.w = r.width;
        item.h = r.height;
        item.effW = Math.max(16, Math.min(r.width, r.height));
      }
    });
  }

  pushWindowPointer(clientX, clientY, now, rt0Ms = 220, motorSlopeB = 180) {
    let dt = 11;
    let vx = 0,
      vy = 0,
      speed = 0;
    if (this.lastPos) {
      dt = Math.max(1, now - this.lastPos.t);
      vx = ((clientX - this.lastPos.x) / dt) * 1000;
      vy = ((clientY - this.lastPos.y) / dt) * 1000;
      speed = Math.hypot(vx, vy);
    }
    this.lastPos = { x: clientX, y: clientY, t: now };

    this.samples.push({ x: clientX, y: clientY, t: now, vx, vy, speed });
    const cutoff = now - 680;
    while (this.samples.length > 0 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }

    // Refresh bounding boxes periodically or use cached
    let best = null;
    let second = null;
    let minDist = Infinity;
    let secondDist = Infinity;

    for (const item of this.registry.values()) {
      if (item.w < 4 || item.h < 4) continue;
      // Distance from pointer to element center & edge
      const dCenter = Math.hypot(clientX - item.cx, clientY - item.cy);
      item.distPx = dCenter;
      // True Shannon Index of Difficulty to reach this GUI element from current cursor position:
      // ID_GUI = log2(D / W_eff + 1)
      item.liveID = Math.log2(dCenter / Math.max(12, item.effW) + 1);

      const inside =
        clientX >= item.rect.left - 8 &&
        clientX <= item.rect.right + 8 &&
        clientY >= item.rect.top - 8 &&
        clientY <= item.rect.bottom + 8;

      if (inside) {
        if (!item.isHovered) {
          item.isHovered = true;
          item.visits++;
          // Evaluate approach struggle ratio if user was moving toward this element
          if (this.approachStartPoint && this.approachStartTime > 0) {
            const startD = Math.hypot(
              item.cx - this.approachStartPoint.x,
              item.cy - this.approachStartPoint.y,
            );
            const startID = Math.log2(startD / Math.max(12, item.effW) + 1);
            const expectedMt = rt0Ms + motorSlopeB * startID;
            const actualMt = Math.max(80, now - this.approachStartTime);
            if (startD > 45 && actualMt < 5000) {
              item.struggleRatio = Number(
                (0.7 * item.struggleRatio + 0.3 * (actualMt / Math.max(120, expectedMt))).toFixed(
                  2,
                ),
              );
            }
          }
        }
        if (dt < 120) {
          item.dwellMs += dt;
          // Eye-proxy reading scan speed: 35 to 360 px/s
          if (speed >= 35 && speed <= 360) {
            item.gazeScanMs += dt;
          }
        }
      } else {
        item.isHovered = false;
      }

      if (dCenter < minDist) {
        secondDist = minDist;
        second = best;
        minDist = dCenter;
        best = item;
      } else if (dCenter < secondDist) {
        secondDist = dCenter;
        second = item;
      }
    }

    if (speed > 450 && (!this.approachStartPoint || now - this.approachStartTime > 900)) {
      this.approachStartPoint = { x: clientX, y: clientY };
      this.approachStartTime = now;
    }

    this.nearestGui = best;
    this.secondNearestGui = second;
    this.activeFocusId = best && best.distPx < 180 ? best.id : 'ARENA_PLAY';

    // Decode GUI-Element Doodling Patterns (Orbit, Underline, Scratch-Out, Stray Hesitation)
    if (best && best.distPx < 145 && this.samples.length >= 14 && now - this.lastTriggerMs > 950) {
      this.detectGuiDoodle(best, now);
    }
  }

  recordGuiClick(guiId) {
    const item = this.registry.get(guiId);
    if (item) {
      item.clicks++;
    }
  }

  detectGuiDoodle(targetGui, now) {
    const pts = this.samples;
    let windingRad = 0;
    let pathLen = 0;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    let vxFlips = 0,
      vyFlips = 0;
    let prevVxSign = 0,
      prevVySign = 0;

    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1],
        p1 = pts[i];
      const dx = p1.x - p0.x,
        dy = p1.y - p0.y;
      pathLen += Math.hypot(dx, dy);
      if (p1.x < minX) minX = p1.x;
      if (p1.x > maxX) maxX = p1.x;
      if (p1.y < minY) minY = p1.y;
      if (p1.y > maxY) maxY = p1.y;

      // Winding angle around GUI element center (cx, cy)
      const a0 = Math.atan2(p0.y - targetGui.cy, p0.x - targetGui.cx);
      const a1 = Math.atan2(p1.y - targetGui.cy, p1.x - targetGui.cx);
      let da = a1 - a0;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      windingRad += da;

      if (Math.abs(p1.vx) > 160) {
        const s = Math.sign(p1.vx);
        if (prevVxSign !== 0 && s !== prevVxSign) vxFlips++;
        prevVxSign = s;
      }
      if (Math.abs(p1.vy) > 160) {
        const s = Math.sign(p1.vy);
        if (prevVySign !== 0 && s !== prevVySign) vyFlips++;
        prevVySign = s;
      }
    }

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const chord = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
    const tortuosity = pathLen / Math.max(10, chord);

    // 1. ENCIRCLE / ORBIT DOODLE (|windingRad| > 4.2 rad around GUI element)
    if (Math.abs(windingRad) > 4.2 && pathLen > 120) {
      this.triggerDoodle('ORBIT_ENCIRCLE', targetGui, '#38bdf8', now, {
        windingDeg: Math.round((Math.abs(windingRad) * 180) / Math.PI),
      });
      return;
    }

    // 2. SCRATCH-OUT / CROSS-OUT DOODLE OVER GUI ELEMENT (High vx + vy reversals)
    if (vxFlips >= 3 && vyFlips >= 2 && pathLen > 190 && targetGui.distPx < 90) {
      this.triggerDoodle('SCRATCH_FRICTION', targetGui, '#f43f5e', now, {
        flips: vxFlips + vyFlips,
      });
      return;
    }

    // 3. UNDERLINE / EYE-PROXY READING SCAN (Horizontal back-and-forth under/over GUI label)
    if (
      vxFlips >= 2 &&
      vyFlips <= 1 &&
      spanX > 55 &&
      spanX > spanY * 2.2 &&
      targetGui.distPx < 95
    ) {
      this.triggerDoodle('UNDERLINE_READ', targetGui, '#fbbf24', now, {
        spanX: Math.round(spanX),
      });
      return;
    }

    // 4. STRAY HESITATION / SEARCHING DOODLE (High tortuosity > 3.6 near control without clicking)
    if (tortuosity > 3.8 && pathLen > 150 && spanX < 110 && spanY < 110 && targetGui.distPx < 120) {
      this.triggerDoodle('HESITATION_SEARCH', targetGui, '#c084fc', now, {
        tortuosity: tortuosity.toFixed(1),
      });
    }
  }

  triggerDoodle(type, targetGui, color, now, meta) {
    this.lastTriggerMs = now;
    this.totalDoodleEvents++;
    targetGui.doodles++;
    if (type === 'ORBIT_ENCIRCLE') this.orbitCount++;
    else if (type === 'UNDERLINE_READ') this.underlineCount++;
    else if (type === 'SCRATCH_FRICTION') {
      this.scratchCount++;
      targetGui.struggleRatio = Number((targetGui.struggleRatio + 0.35).toFixed(2));
      // Self-adapting GUI affordance: enlarge a scratched/struggled GUI button!
      targetGui.scale = Math.min(1.22, targetGui.scale + 0.08);
      if (targetGui.el) {
        targetGui.el.style.transform = `scale(${targetGui.scale})`;
        targetGui.el.classList.add('gui-doodle-struggle');
        setTimeout(
          () => targetGui.el && targetGui.el.classList.remove('gui-doodle-struggle'),
          2200,
        );
      }
    } else if (type === 'HESITATION_SEARCH') {
      this.hesitationCount++;
    }

    if (targetGui.el && type !== 'SCRATCH_FRICTION') {
      targetGui.el.classList.add('gui-doodle-spotlight');
      setTimeout(() => targetGui.el && targetGui.el.classList.remove('gui-doodle-spotlight'), 1800);
    }

    this.lastDoodleSummary = `${type.split('_')[0]} @ ${targetGui.id}`;
    this.doodleRibbons.push({
      pts: this.samples.map((s) => ({ x: s.x, y: s.y })),
      color,
      alpha: 1.0,
      label: `${type}: ${targetGui.id} (ID=${targetGui.liveID.toFixed(1)}b)`,
    });
    this.samples = [];

    if (this.onDoodle) {
      this.onDoodle(type, targetGui, meta);
    }
  }

  renderOverlay(ctx, w, h, cursor) {
    ctx.clearRect(0, 0, w, h);

    // 1. Render active doodle ribbons
    for (let i = this.doodleRibbons.length - 1; i >= 0; i--) {
      const rib = this.doodleRibbons[i];
      if (rib.pts.length > 1) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, rib.alpha);
        ctx.strokeStyle = rib.color;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        for (let j = 0; j < rib.pts.length; j++) {
          if (j === 0) ctx.moveTo(rib.pts[j].x, rib.pts[j].y);
          else ctx.lineTo(rib.pts[j].x, rib.pts[j].y);
        }
        ctx.stroke();

        const lastPt = rib.pts[rib.pts.length - 1];
        ctx.fillStyle = '#020617';
        ctx.strokeStyle = rib.color;
        ctx.lineWidth = 1.5;
        drawRoundRect(ctx, lastPt.x - 95, lastPt.y - 30, 190, 20, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rib.label, lastPt.x, lastPt.y - 20);
        ctx.restore();
      }
      rib.alpha -= 0.014;
      if (rib.alpha <= 0) this.doodleRibbons.splice(i, 1);
    }

    if (!this.xrayEnabled) return;

    // 2. Eye-Proxy Gaze Halo around cursor when scanning slowly (< 360 px/s)
    const speed = this.lastPos ? this.samples[this.samples.length - 1]?.speed || 0 : 0;
    if (cursor && speed < 360) {
      ctx.save();
      const haloR = Math.max(18, 34 - speed * 0.04);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.38)';
      ctx.fillStyle = 'rgba(168, 85, 247, 0.07)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, haloR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw Shannon ID vector from Cursor to Nearest GUI Element + Second Nearest
    const targets = [this.nearestGui, this.secondNearestGui].filter(Boolean);
    for (let idx = 0; idx < targets.length; idx++) {
      const g = targets[idx];
      if (g.distPx > 340) continue;

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = idx === 0 ? 'rgba(56, 189, 248, 0.55)' : 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = idx === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(cursor.x, cursor.y);
      ctx.lineTo(g.cx, g.cy);
      ctx.stroke();
      ctx.restore();

      // Bounding Box + GUI-ID & Live Shannon ID Tag
      ctx.save();
      ctx.strokeStyle =
        g.struggleRatio > 1.35
          ? 'rgba(244, 63, 94, 0.8)'
          : idx === 0
            ? 'rgba(56, 189, 248, 0.75)'
            : 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = idx === 0 ? 1.5 : 1;
      ctx.strokeRect(g.rect.left - 2, g.rect.top - 2, g.rect.width + 4, g.rect.height + 4);

      if (idx === 0) {
        const tagText = `${g.id} • DI:${g.liveID.toFixed(1)}b • ${Math.round(g.dwellMs)}ms`;
        const tagW = Math.max(128, tagText.length * 5.7 + 10);
        const tagX = Math.max(4, Math.min(w - tagW - 4, g.cx - tagW / 2));
        const tagY = g.rect.bottom + 18 < h ? g.rect.bottom + 4 : g.rect.top - 20;

        ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        drawRoundRect(ctx, tagX, tagY, tagW, 16, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, tagX + tagW / 2, tagY + 8);
      }
      ctx.restore();
    }
  }
}
