# 🚀 The Tillmann Games — Ground-Truth HCI, Psychomotor & Adaptive Reading Lab

**Live App (Android, iOS & Desktop):** <https://springyworks.github.io/tillmanreader/>

Touch-first psychomotor pointing, Fitts/Effective-Width ($W_e$) telemetry, foreperiod hazard entrainment, and 6-stage adaptive Dutch reading lab built with strict **TypeScript + Vite** (`vite-plugin-singlefile`).

---

## 📱 Playing on Your Android Phone

1. Open **<https://springyworks.github.io/tillmanreader/>** in Chrome on Android.
2. **Instant Launch:** Opens straight into **Tillmann Reader** (Stage 1/6) with zero developer clutter—the telemetry drawer stays tucked down at the bottom (`0: Play`).
3. **First Touch Unlocks Voice & Fullscreen:** Your first touch inside the arena unlocks the zero-WAV WebAudio vocal-tract synthesizer (`"kjiuueehh!"`, `"buh-boing!"`, `"puh-POP!"`) and enters borderless fullscreen.
4. **Anti-Fat-Finger (FFP) Scoop-Visor:** Place your thumb on the lower **Thumb Pad** and drag—the unobstructed **Optical Scoop Visor** floats above your finger so your thumb never hides the letters. Lift your finger over the target bubble to drop!
5. **Inspect Live Telemetry Anytime:** Tap or swipe up the bottom bar (`1: Scopes` or `2: 100-Math`) to inspect the 4 real-time oscilloscopes, GUI Shannon $ID$ registry, and all 100 deterministic mathematical signature metrics while keeping the play arena visible.

---

## 🧠 Core Scientific & Ergonomic Models

### 1. Center-Shooting vs. Rim-Grazing ($W_{\text{nominal}}$ vs. Effective Width $W_e$)

Standard Fitts's Law assumes full utilization of nominal target width $W_{\text{nominal}} = 2R$:

$$ID_{\text{nominal}} = \log_2\left(\frac{D}{W_{\text{nominal}}} + 1\right)$$

Users who aim tightly for the bullseye center compress their effective dispersion ($W_e \ll W_{\text{nominal}}$), paying a **Self-Imposed Precision Tax**:

$$\Delta ID = ID_{\text{effective}} - ID_{\text{nominal}} = \log_2\left(\frac{W_{\text{nominal}}}{W_e}\right)$$

### 2. Anti-Fat-Finger (FFP) Offset Scoop-Visor Rig

Touchscreens lack hover events and suffer from finger occlusion. The Scoop-Visor places a tactile thumb handle `58–88px` below a transparent crosshair visor connected by dual struts:

- Dragging streams continuous 60–120 Hz 2D complex velocity FFT ($v_x + i v_y$), curvature $\kappa(s)$, ballistic surge, and Meyer corrective homing telemetry.
- Multi-touch pointer isolation and `pointercancel` guards prevent accidental palm touches or Android system gestures from hijacking an active drag.

### 3. Zero-WAV Parametric Vocal-Tract & Phonetic Joke Synthesizer

Synthesizes 3 parallel resonant vocal-tract bandpass formants ($F_1, F_2, F_3$) with glottal vibrato, vocal fry, and buccal fricatives directly in WebAudio:

- **`q`**: `"kjiuueehh!"` (velar burst `k` + palatal glide `j` + rounded `uu` + comical slide `eehh!`)
- **`b` / `d` / `p`**: `"buh-boing!"`, `"duh-deng! tok-tok!"`, `"puh-POP!"`
- **Digraphs & Words**: `"ui... Hatsjoe!"`, `"vis... blub-blub!"`, `"bos... koekoek!"`, `"vliegtuig... niii-aouw!"`

---

## 🛠️ Local Development & Verification

Requires **Node.js >= 22.12** (`.nvmrc` pins Node 22).

```bash
# Install dependencies
npm install

# Start local hot-reloading dev server (http://localhost:5173)
npm run dev

# Run full verification gate (strict tsc + type-aware ESLint + Prettier + Vitest)
npm run check

# Build self-contained single-file production bundle (dist/index.html)
npm run build

# Run Playwright E2E suite (Desktop Chrome + Android Pixel 7)
npm run test:e2e
```

---

## 🗂️ Project Structure

- `src/app/` — `LabApp` coordinator, safe-arena `LayoutController`, `LevelFlow`, `TrialSpawner`, and `HitProcessor`
- `src/engines/` — Pure mathematical & domain engines (`ComplexFFT`, `TelemetryEngine`, `ForeperiodHazardEngine`, `AdaptiveReadingEngine`, `GestureDecoder`, `GuiAffordanceDoodleEngine`, `Signature100Engine`, `LongitudinalPersistenceEngine`, `session-snapshot`) + Vitest unit tests (`*.test.ts`)
- `src/audio/` — Zero-WAV parametric 3-formant WebAudio vocal-tract synthesizer
- `src/render/` — Canvas renderers for the play arena, Scoop-Visor rig, and 3 real-time oscilloscopes
- `src/ui/` — HUD updates, 100-metric & GUI registry panels, and modular DOM/pointer event binders
- `src/export/` — Telemetry JSON payload builder and standalone single-HTML state baker
- `e2e/` — Playwright end-to-end tests across Desktop Chrome and Android Pixel 7 viewports
- `.github/workflows/deploy.yml` — Automated CI check and GitHub Pages deployment
