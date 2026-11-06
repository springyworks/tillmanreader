// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import { GIT_CHECKPOINT_META } from '../app/build-info';

export const VSCodeProjectScaffold = {
  buildReadme(payload) {
    return `# 🚀 The Tillmann Games — Ground-Truth HCI, Psychomotor & Adaptive Reading Lab

**Checkpoint Tag:** \`${GIT_CHECKPOINT_META.tag}\` (\`${GIT_CHECKPOINT_META.commitHash}\`)  
**Exported At:** \`${payload.timestampISO}\` (\`unixMs: ${payload.unixTimestampMs}\`)  
**Recorded Trials in Snapshot:** \`${payload.trials.length}\` trials • **Reading Stage:** \`Stage ${payload.adaptiveReadingStage}/6\`

---

## 📦 What Is Inside This ZIP Archive

1. **\`index.html\`** — The complete, self-contained, zero-CDN playable application (**The Tillmann Reader & Telemetry Lab**) with your latest calibration state baked in. Can be opened directly in any browser or deployed straight to GitHub Pages (\`https://<username>.github.io/tillmanreader/\`).
2. **\`README.md\`** — Complete documentation of the mathematical models, Crossman–Welford–MacKenzie Effective Target Width ($W_e$), Anti-Fat-Finger (FFP) Offset Scoop-Visor, Parametric Formant Vocal-Tract Synthesizer (\`"kjiuueehh!"\`), and local VS Code TypeScript development setup.
3. **\`package.json\` & \`tsconfig.json\`** — Ready-to-run **Vite + TypeScript** configuration for local development in VS Code.
4. **\`src/types/telemetry.ts\`** — Full TypeScript interfaces for the 100 Deterministic Mathematical Metrics, PUT Foreperiod Hazard records, Fitts/Tillman trials, and GUI-Element Shannon ID registry.
5. **\`src/main.ts\`** — Modular TypeScript entry point & typed bridge to \`window.labApp\`.
6. **\`telemetry-ground-truth.json\`** — Your complete exported JSON dataset (${payload.trials.length} trials, 100 signature metrics, and PUT foreperiod records).

---

## 🛠️ Quick Start in VS Code (Local TypeScript Project)

\`\`\`bash
# 1. Unzip this folder and open it in VS Code:
code .

# 2. Install Vite & TypeScript dev dependencies:
npm install

# 3. Start the local hot-reloading dev server (http://localhost:5173):
npm run dev

# 4. Type-check your TypeScript code:
npm run typecheck
\`\`\`

---

## 🧠 Core Scientific & Ergonomic Innovations

### 1. Center-Shooting vs. Rim-Grazing ($W_{\\text{nominal}}$ vs. Effective Width $W_e$)
Standard Fitts's Law assumes the user utilizes the full nominal width $W_{\\text{nominal}} = 2R$:
$$ID_{\\text{nominal}} = \\log_2\\left(\\frac{D}{W_{\\text{nominal}}} + 1\\right)$$
However, users with an intrinsic drive to shoot for the **bullseye center** compress their effective target dispersion ($W_e \\ll W_{\\text{nominal}}$), voluntarily paying a **Self-Imposed Precision Tax**:
$$\\Delta ID = ID_{\\text{effective}} - ID_{\\text{nominal}} = \\log_2\\left(\\frac{W_{\\text{nominal}}}{W_e}\\right)$$
In your recorded telemetry snapshot:
- **Mean Radial Hit Offset ($r/R$):** \`${(payload.signature100Metrics[67]?.raw || 18.6).toFixed(1)}% R\`
- **Effective Width Ratio ($W_e / W$):** \`${(payload.signature100Metrics[68]?.raw || 0.25).toFixed(2)}x\`
- **Self-Imposed Precision Tax ($\\Delta ID$):** \`+${(payload.signature100Metrics[69]?.raw || 2.0).toFixed(2)} bits\`

### 2. Anti-Fat-Finger (FFP) Offset Scoop-Visor Rig
On mobile touchscreens, a child's or adult's finger obscures the target being tapped, and touchscreens lack mouse-hover events. The **Scoop-Visor Rig** places a tactile **Thumb Pad** \`86px\` *below* a transparent **Optical Scoop Visor** connected by dual carbon-cyan struts:
- Dragging the lower pad streams continuous 60–120Hz 2D velocity FFT ($v_x + i v_y$), curvature $\\kappa(s)$, and Meyer corrective homing telemetry.
- Lifting the finger (\`pointerup\`) drops the upper visor onto the letter bubble with sub-pixel accuracy.

### 3. Zero-WAV Parametric Human Vocal-Tract & Funny Phonetic Joke Engine
Synthesizes 3 parallel resonant vocal-tract bandpass formants ($F_1, F_2, F_3$) + glottal vibrato/vocal-fry + buccal fricatives:
- **\`q\`**: Phonetically articulated as **\`"kjiuueehh!"\`** (velar plosive burst \`k\` + palatal glide \`j\` $\\rightarrow$ rounded \`uu\` + comical slide-whistle \`eehh!\` + lip-pop).
- **\`b\` / \`d\` / \`p\`**: \`"buh-boing!"\`, \`"duh-deng! tok-tok!"\`, \`"puh-POP!"\`.
- **Digraphs & Words**: \`"ui... Hatsjoe!"\`, \`"vis... blub-blub!"\`, \`"bos... koekoek!"\`, \`"vliegtuig... niii-aouw!"\`.

---

## 🐙 Deploying to GitHub Pages (\`github.io\`)

\`\`\`bash
git init
git add .
git commit -m "Initial commit: Tillmann Reader (${GIT_CHECKPOINT_META.tag})"
git branch -M main
git remote add origin https://github.com/<your-username>/tillmanreader.git
git push -u origin main
\`\`\`
Then in GitHub **Settings → Pages**, set Branch to \`main\` (\`/root\`). Your fullscreen game will be live at \`https://<your-username>.github.io/tillmanreader/\`.
`;
  },

  buildPackageJson() {
    return JSON.stringify(
      {
        name: 'tillmann-reader-hci-lab',
        version: '2.6.0',
        private: true,
        description:
          'The Tillmann Games — Ground-Truth HCI, Psychomotor Fitts/We & Adaptive Reading Tutor',
        type: 'module',
        scripts: {
          dev: 'vite --open',
          build: 'tsc && vite build',
          preview: 'vite preview',
          typecheck: 'tsc --noEmit',
        },
        devDependencies: {
          typescript: '^5.6.3',
          vite: '^5.4.10',
        },
      },
      null,
      2,
    );
  },

  buildTsConfig() {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          useDefineForClassFields: true,
          module: 'ESNext',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          isolatedModules: true,
          moduleDetection: 'force',
          noEmit: true,
          strict: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
          noFallthroughCasesInSwitch: true,
        },
        include: ['src'],
      },
      null,
      2,
    );
  },

  buildTelemetryTypesTs() {
    return `/**
 * @file src/types/telemetry.ts
 * Strongly-typed TypeScript interfaces for The Tillmann Games & Ground-Truth HCI Telemetry Lab.
 */

export typeMetricCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface SignatureMetric {
  id: number;
  cat: typeMetricCategory;
  name: string;
  unit: string;
  value: string | number;
  raw: number;
}

export type ForeperiodDistribution =
  | 'AUTO_ADAPT'
  | 'ISOCHRONOUS'
  | 'EXPONENTIAL'
  | 'UNIFORM'
  | 'BIMODAL'
  | 'WEIBULL';

export type AimStrategy = 'NATURAL' | 'BULLSEYE' | 'RIM_GRAZE';

export type TrialRegime =
  | 'MOTOR_LOCKED'
  | 'COGNITIVE_SEARCH'
  | 'TELEMETRY_INSPECTION'
  | 'AFFECTIVE_GESTURE'
  | 'AWAY_PAUSE';

export interface ForeperiodRecord {
  tw: number;
  rt: number;
  dist: ForeperiodDistribution;
  hazard: number;
  premature: boolean;
  phaseErrorMs: number;
  t: number;
  unixMs?: number;
  perfNowUs?: number;
  isoTime?: string;
}

export interface TillmannTrialRecord {
  id: number;
  mt: number;
  hw: number;
  brain: number;
  ballistic: number;
  homing: number;
  motorMt: number;
  regime: TrialRegime;
  dockInspectionMs?: number;
  gestureTagged?: string | null;
  tw?: number;
  fpDist?: ForeperiodDistribution;
  radialErrPx?: number;
  normRadiusPct?: number;
  hitAngleRad?: number;
  goalPeeks?: number;
  goalHoverMs?: number;
  goalMemoryMode?: string;
  semanticMorphActive?: boolean;
  unixMs: number;
  perfNowUs: number;
  isoTime: string;
}

export interface GuiAffordanceElement {
  id: string;
  label: string;
  liveShannonID: number;
  dwellMs: number;
  eyeProxyReadingScanMs: number;
  visits: number;
  clicks: number;
  doodles: number;
  struggleRatio: number;
  adaptedScale: number;
}

export interface GroundTruthTelemetryPayload {
  gitCheckpointMeta: {
    tag: string;
    commitHash: string;
    committedAtISO: string;
    description: string;
  };
  unixTimestampMs: number;
  perfNowMicroseconds: number;
  timestampISO: string;
  deviceClassification: string;
  estimatedPollingHz: number;
  pollingJitterMs: number;
  inputToPhotonLagMs: number;
  calibratedGroundTruthRT0Ms: number;
  multiManifoldRegression: {
    a: number;
    b: number;
    tpTotal: string;
    tpMotor: string;
  };
  adaptiveReadingStage: number;
  signature100Metrics: SignatureMetric[];
  trials: TillmannTrialRecord[];
}
`;
  },

  buildMainTs() {
    return `/**
 * @file src/main.ts
 * TypeScript companion entry point for local VS Code development.
 * Provides typed access to the running Tillmann Games engine on window.labApp.
 */
import type { GroundTruthTelemetryPayload, TillmannTrialRecord } from './types/telemetry';

declare global {
  interface Window {
    labApp?: {
      buildPayloadObject: () => GroundTruthTelemetryPayload;
      exportVsCodeZipProject: () => void;
      exportStandaloneHTMLApp: () => void;
      stepLevel: (delta: number) => void;
      telemetry: {
        trials: TillmannTrialRecord[];
        meanNormRadiusPct: number;
        effectiveWidthRatio: number;
        selfImposedTaxBits: number;
      };
    };
  }
}

export function inspectLiveTelemetry(): GroundTruthTelemetryPayload | null {
  if (!window.labApp) return null;
  const payload = window.labApp.buildPayloadObject();
  console.info(
    \`[Tillmann TS Bridge] Active Stage: \${payload.adaptiveReadingStage}/6 | Trials: \${payload.trials.length} | Hit Offset: \${(window.labApp.telemetry.meanNormRadiusPct * 100).toFixed(1)}% R\`
  );
  return payload;
}
`;
  },
};
