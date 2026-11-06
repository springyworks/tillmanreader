/**
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
    `[Tillmann TS Bridge] Active Stage: ${payload.adaptiveReadingStage}/6 | Trials: ${payload.trials.length} | Hit Offset: ${(window.labApp.telemetry.meanNormRadiusPct * 100).toFixed(1)}% R`
  );
  return payload;
}
