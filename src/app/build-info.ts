export interface BuildInfo {
  readonly tag: string;
  readonly commitHash: string;
  readonly committedAtISO: string;
  readonly description: string;
}

/**
 * Build metadata injected by Vite (see `define` in `vite.config.ts`):
 * package version, short git commit and commit date. It labels saved
 * checkpoints and is exported in telemetry payloads as `gitCheckpointMeta`.
 */
export const BUILD_INFO: BuildInfo = Object.freeze({
  tag: `v${__APP_VERSION__}`,
  commitHash: __GIT_COMMIT__,
  committedAtISO: __BUILD_DATE__,
  description: 'The Tillmann Games — Ground-Truth HCI & Adaptive Reading Lab',
});
