/// <reference types="vite/client" />

import type { LabApp } from './app/lab-app';

declare global {
  const __APP_VERSION__: string;
  const __GIT_COMMIT__: string;
  const __BUILD_DATE__: string;

  interface Window {
    /** The running lab; assigned once by `main.ts`, also used by the e2e tests and the dev console. */
    labApp?: LabApp;
    /** Session snapshot baked into exported standalone copies of the app. */
    __BAKED_TILLMANN_STATE__?: unknown;
    /** Safari < 14.1 prefix for the Web Audio context constructor. */
    webkitAudioContext?: typeof AudioContext;
  }

  /** Safari < 16.4 only ships the prefixed Fullscreen API, which `lib.dom` does not describe. */
  interface Document {
    readonly webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?(): void;
  }

  interface HTMLElement {
    webkitRequestFullscreen?(): void;
  }
}
