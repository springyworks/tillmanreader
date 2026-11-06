import type { LabApp } from '../app/lab-app';
import type { ForeperiodDistribution } from '../types/telemetry';
import { byId } from '../util/dom';

const DIST_COLOR: Partial<Record<ForeperiodDistribution, string>> = {
  ISOCHRONOUS: '#38bdf8',
  EXPONENTIAL: '#10b981',
  UNIFORM: '#f59e0b',
  BIMODAL: '#a855f7',
  WEIBULL: '#ec4899',
};

/** Draws the three lab scope canvases (Fitts law, foreperiod hazard and the scope-3 modes). */
export class ScopeRenderer {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  renderScope1(): void {
    const ctx = this.app.s1Ctx;
    const w = this.app.s1Canvas.clientWidth || 240;
    const h = this.app.s1Canvas.clientHeight || 120;
    ctx.clearRect(0, 0, w, h);

    const y60 = h - (16.67 / 40) * h;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, y60);
    ctx.lineTo(w, y60);
    ctx.stroke();

    const dts = this.app.telemetry.dtHistory;
    if (dts.length < 2) return;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < dts.length; i++) {
      const x = (i / (dts.length - 1)) * w;
      const y = Math.max(4, h - (Math.min(40, dts[i]) / 40) * h);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  renderScope2(): void {
    const ctx = this.app.s2Ctx;
    const w = this.app.s2Canvas.clientWidth || 240;
    const h = this.app.s2Canvas.clientHeight || 120;
    ctx.clearRect(0, 0, w, h);

    const spec = this.app.telemetry.fftSpectrum;
    const maxVal = Math.max(10, ...spec);
    const barW = w / 48;
    for (let k = 1; k < 48; k++) {
      const ratio = spec[k] / maxVal;
      const bh = Math.max(2, ratio * (h - 10));
      ctx.fillStyle = k <= 5 ? '#10b981' : k <= 14 ? '#f59e0b' : '#f43f5e';
      ctx.fillRect((k - 1) * barW, h - bh, Math.max(1, barW - 1), bh);
    }
  }

  renderScope3(): void {
    if (this.app.scope3Mode === 'BULLSEYE_MAP') {
      byId('scope3Title').textContent = '3. Bullseye Center Bias & We Map';
      this.renderScope3BullseyeMap();
    } else if (this.app.scope3Mode === 'PUT_HAZARD') {
      byId('scope3Title').textContent = '3. PUT Wait tw vs RT & Hazard';
      this.renderScope3PutHazard();
    } else {
      byId('scope3Title').textContent = '3. Nominal vs Effective ID_eff Fitts';
      this.renderScope3Fitts();
    }
  }

  /**
   * Renders the Normalized Target Bullseye Hit Map (Left) + Radial Hit Density Histogram (Right)
   * proving how the user shoots for the center (We << W_nominal) vs. rim grazing.
   */
  renderScope3BullseyeMap(): void {
    const ctx = this.app.s3Ctx;
    const w = this.app.s3Canvas.clientWidth || 240;
    const h = this.app.s3Canvas.clientHeight || 120;
    ctx.clearRect(0, 0, w, h);

    const cx = Math.min(w * 0.34, h * 0.52);
    const cy = h * 0.5;
    const maxR = Math.max(24, Math.min(cx - 8, h * 0.43));

    // 1. Outer Nominal Target Boundary (100% R = W_nominal)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. 65% Mid Ring & 30% Bullseye Core Ring
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Crossman-Welford Effective Width Ring (We / W_nominal)
    const weR = Math.min(maxR, maxR * this.app.telemetry.effectiveWidthRatio);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, weR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 4. Plot Every Trial's Normalized Hit Coordinate (r/R, theta)
    const bins = [0, 0, 0, 0, 0]; // 0-20%, 20-40%, 40-60%, 60-80%, 80-100% R
    for (const t of this.app.telemetry.trials) {
      const nr = Math.min(1.0, Math.max(0.02, t.normRadiusPct || 0.22));
      const ang = t.hitAngleRad || 0;
      const bIdx = Math.min(4, Math.floor(nr * 5));
      bins[bIdx]++;

      const px = cx + nr * maxR * Math.cos(ang);
      const py = cy + nr * maxR * Math.sin(ang);
      ctx.fillStyle = nr <= 0.3 ? '#fbbf24' : nr <= 0.65 ? '#34d399' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Right Side: 5-Zone Radial Hit Histogram (Center Core -> Outer Rim)
    const histX = cx + maxR + 14;
    const histW = Math.max(50, w - histX - 8);
    const maxBin = Math.max(1, ...bins);
    const labels = ['0-20% Core', '20-40% In', '40-60% Mid', '60-80% Out', '80-100% Rim'];
    const colors = ['#fbbf24', '#10b981', '#22d3ee', '#818cf8', '#f43f5e'];
    const rowH = (h - 16) / 5;

    for (let i = 0; i < 5; i++) {
      const y = 8 + i * rowH;
      const bw = (bins[i] / maxBin) * (histW * 0.58);
      ctx.fillStyle = colors[i];
      ctx.fillRect(histX, y + 2, Math.max(2, bw), Math.max(4, rowH - 5));

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${labels[i]} (${bins[i]})`, histX + bw + 4, y + rowH / 2);
    }
  }

  renderScope3PutHazard(): void {
    const ctx = this.app.s3Ctx;
    const w = this.app.s3Canvas.clientWidth || 240;
    const h = this.app.s3Canvas.clientHeight || 120;
    ctx.clearRect(0, 0, w, h);

    const plotW = w * 0.78;
    const kdeX0 = plotW + 4;
    const kdeW = Math.max(16, w - kdeX0 - 2);

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
    ctx.beginPath();
    ctx.moveTo(plotW, 0);
    ctx.lineTo(plotW, h);
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const tw = 350 + (i / 40) * 2850;
      const haz = this.app.fpEngine.instantaneousHazard(tw, this.app.fpEngine.activeDist);
      const x = ((tw - 350) / 2850) * (plotW - 12) + 6;
      const y = h - 8 - Math.min(1, haz / 5.0) * (h - 20);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    const stats = this.app.fpEngine.computeStats();
    const meanY = stats.mu + stats.tau;
    const yAt500 = meanY - stats.slopeMsPerSec * 0.5;
    const yAt2800 = meanY + stats.slopeMsPerSec * 1.8;
    const mapY = (rt: number) => h - 8 - Math.min(1, Math.max(0, (rt - 140) / 1450)) * (h - 20);
    const mapX = (tw: number) =>
      ((Math.min(3200, Math.max(350, tw)) - 350) / 2850) * (plotW - 12) + 6;

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mapX(500), mapY(yAt500));
    ctx.lineTo(mapX(2800), mapY(yAt2800));
    ctx.stroke();

    for (const r of this.app.fpEngine.records) {
      const x = mapX(r.tw);
      const y = r.rt > 1600 ? 7 : mapY(r.rt);
      if (r.premature) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x - 3.5, y - 3.5);
        ctx.lineTo(x + 3.5, y + 3.5);
        ctx.moveTo(x + 3.5, y - 3.5);
        ctx.lineTo(x - 3.5, y + 3.5);
        ctx.stroke();
      } else {
        ctx.fillStyle = DIST_COLOR[r.dist] || '#10b981';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = 'rgba(16, 185, 129, 0.24)';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(kdeX0, h - 6);
    for (let py = h - 6; py >= 6; py -= 3) {
      const rt = 140 + ((h - 8 - py) / (h - 20)) * 1450;
      const z = (rt - stats.mu) / Math.max(15, stats.sigma);
      const gauss = Math.exp(-0.5 * z * z);
      const tail = rt > stats.mu ? Math.exp(-(rt - stats.mu) / Math.max(40, stats.tau)) : 0;
      const dens = Math.min(1, 0.55 * gauss + 0.45 * tail);
      ctx.lineTo(kdeX0 + dens * kdeW, py);
    }
    ctx.lineTo(kdeX0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  renderScope3Fitts(): void {
    const ctx = this.app.s3Ctx;
    const w = this.app.s3Canvas.clientWidth || 240;
    const h = this.app.s3Canvas.clientHeight || 120;
    ctx.clearRect(0, 0, w, h);

    const maxID = 7.5;
    const linearMaxY = 4800;
    const bandH = 22;

    ctx.fillStyle = 'rgba(88, 28, 135, 0.22)';
    ctx.fillRect(0, 0, w, bandH);

    const mapX = (id: number) => Math.min(w - 8, Math.max(8, (id / maxID) * (w - 16) + 8));
    const mapY = (mt: number) => {
      if (mt <= linearMaxY) {
        return h - 6 - (mt / linearMaxY) * (h - bandH - 10);
      }
      return Math.max(5, bandH - 4 - Math.log10(mt / linearMaxY) * 12);
    };

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(
      mapX(0.5),
      mapY(this.app.telemetry.regTotal.a + this.app.telemetry.regTotal.b * 0.5),
    );
    ctx.lineTo(
      mapX(7.0),
      mapY(this.app.telemetry.regTotal.a + this.app.telemetry.regTotal.b * 7.0),
    );
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
    ctx.beginPath();
    ctx.moveTo(
      mapX(0.5),
      mapY(this.app.telemetry.regMotor.a + this.app.telemetry.regMotor.b * 0.5),
    );
    ctx.lineTo(
      mapX(7.0),
      mapY(this.app.telemetry.regMotor.a + this.app.telemetry.regMotor.b * 7.0),
    );
    ctx.stroke();
    ctx.restore();

    for (const t of this.app.telemetry.trials) {
      const x = mapX(t.id);
      const y = mapY(t.mt);

      if (t.motorMt > 25 && t.id > 0.5) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.45)';
        ctx.beginPath();
        ctx.arc(x, mapY(t.motorMt), 2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t.regime === 'MOTOR_LOCKED') {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.regime === 'COGNITIVE_SEARCH') {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(x, y - 3.5);
        ctx.lineTo(x + 3.5, y + 3);
        ctx.lineTo(x - 3.5, y + 3);
        ctx.closePath();
        ctx.fill();
      } else if (t.regime === 'TELEMETRY_INSPECTION') {
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x, y + 4);
        ctx.lineTo(x - 4, y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }
  }
}
