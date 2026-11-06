// @ts-nocheck
// TODO(typing): temporary entry point for the mechanical split; replaced by the typed bootstrap.
import './styles/index.css';
import { LabApp } from './app/lab-app';
import { RuntimeWatchdog } from './diagnostics/runtime-watchdog';

RuntimeWatchdog.init();

function start() {
  window.labApp = new LabApp();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
