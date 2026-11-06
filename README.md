# 🚀 The Tillmann Games — Ground-Truth HCI, Psychomotor & Adaptive Reading Lab

**Checkpoint Tag:** `v2.6-GITHUB-PAGES-KID-INSTANT-PLAY` (`9b4e7d2`)  
**Exported At:** `2026-11-06T16:17:28.571Z` (`unixMs: 1793981848571`)  
**Recorded Trials in Snapshot:** `85` trials • **Reading Stage:** `Stage 1/6`

---

## 📦 What Is Inside This ZIP Archive

1. **`index.html`** — The complete, self-contained, zero-CDN playable application (**The Tillmann Reader & Telemetry Lab**) with your latest calibration state baked in. Can be opened directly in any browser or deployed straight to GitHub Pages (`https://<username>.github.io/tillmanreader/`).
2. **`README.md`** — Complete documentation of the mathematical models, Crossman–Welford–MacKenzie Effective Target Width ($W_e$), Anti-Fat-Finger (FFP) Offset Scoop-Visor, Parametric Formant Vocal-Tract Synthesizer (`"kjiuueehh!"`), and local VS Code TypeScript development setup.
3. **`package.json` & `tsconfig.json`** — Ready-to-run **Vite + TypeScript** configuration for local development in VS Code.
4. **`src/types/telemetry.ts`** — Full TypeScript interfaces for the 100 Deterministic Mathematical Metrics, PUT Foreperiod Hazard records, Fitts/Tillman trials, and GUI-Element Shannon ID registry.
5. **`src/main.ts`** — Modular TypeScript entry point & typed bridge to `window.labApp`.
6. **`telemetry-ground-truth.json`** — Your complete exported JSON dataset (85 trials, 100 signature metrics, and PUT foreperiod records).

---

## 🛠️ Quick Start in VS Code (Local TypeScript Project)

```bash
# 1. Unzip this folder and open it in VS Code:
code .

# 2. Install Vite & TypeScript dev dependencies:
npm install

# 3. Start the local hot-reloading dev server (http://localhost:5173):
npm run dev

# 4. Type-check your TypeScript code:
npm run typecheck
```

---

## 🧠 Core Scientific & Ergonomic Innovations

### 1. Center-Shooting vs. Rim-Grazing ($W_{\text{nominal}}$ vs. Effective Width $W_e$)
Standard Fitts's Law assumes the user utilizes the full nominal width $W_{\text{nominal}} = 2R$:
$$ID_{\text{nominal}} = \log_2\left(\frac{D}{W_{\text{nominal}}} + 1\right)$$
However, users with an intrinsic drive to shoot for the **bullseye center** compress their effective target dispersion ($W_e \ll W_{\text{nominal}}$), voluntarily paying a **Self-Imposed Precision Tax**:
$$\Delta ID = ID_{\text{effective}} - ID_{\text{nominal}} = \log_2\left(\frac{W_{\text{nominal}}}{W_e}\right)$$
In your recorded telemetry snapshot:
- **Mean Radial Hit Offset ($r/R$):** `21.3% R`
- **Effective Width Ratio ($W_e / W$):** `0.33x`
- **Self-Imposed Precision Tax ($\Delta ID$):** `+1.60 bits`

### 2. Anti-Fat-Finger (FFP) Offset Scoop-Visor Rig
On mobile touchscreens, a child's or adult's finger obscures the target being tapped, and touchscreens lack mouse-hover events. The **Scoop-Visor Rig** places a tactile **Thumb Pad** `86px` *below* a transparent **Optical Scoop Visor** connected by dual carbon-cyan struts:
- Dragging the lower pad streams continuous 60–120Hz 2D velocity FFT ($v_x + i v_y$), curvature $\kappa(s)$, and Meyer corrective homing telemetry.
- Lifting the finger (`pointerup`) drops the upper visor onto the letter bubble with sub-pixel accuracy.

### 3. Zero-WAV Parametric Human Vocal-Tract & Funny Phonetic Joke Engine
Synthesizes 3 parallel resonant vocal-tract bandpass formants ($F_1, F_2, F_3$) + glottal vibrato/vocal-fry + buccal fricatives:
- **`q`**: Phonetically articulated as **`"kjiuueehh!"`** (velar plosive burst `k` + palatal glide `j` $\rightarrow$ rounded `uu` + comical slide-whistle `eehh!` + lip-pop).
- **`b` / `d` / `p`**: `"buh-boing!"`, `"duh-deng! tok-tok!"`, `"puh-POP!"`.
- **Digraphs & Words**: `"ui... Hatsjoe!"`, `"vis... blub-blub!"`, `"bos... koekoek!"`, `"vliegtuig... niii-aouw!"`.

---

## 🐙 Deploying to GitHub Pages (`github.io`)

```bash
git init
git add .
git commit -m "Initial commit: Tillmann Reader (v2.6-GITHUB-PAGES-KID-INSTANT-PLAY)"
git branch -M main
git remote add origin https://github.com/springyworks/tillmanreader.git
git push -u origin main
```
Then in GitHub **Settings → Pages**, set Branch to `main` (`/root`). Your fullscreen game will be live at `https://springyworks.github.io/tillmanreader/`.
