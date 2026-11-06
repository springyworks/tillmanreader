import './styles/index.css';
import { LabApp } from './app/lab-app';
import { RuntimeWatchdog } from './diagnostics/runtime-watchdog';

RuntimeWatchdog.init();

function start(): void {
  window.labApp = new LabApp();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
