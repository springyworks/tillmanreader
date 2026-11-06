import type { LabApp } from '../../app/lab-app';
import { bindGlobalPointerTracking } from './global-pointer';
import { bindHeroControls } from './hero-controls';
import { bindExportAndModals } from './export-modals';
import { bindLabDeck } from './lab-deck';
import { bindDrawer } from './drawer';
import { bindSessionControls } from './session-controls';
import { bindArenaPointer } from './arena-pointer';
import { bindHumanTutorAndGuiFeedback } from './human-tutor';

/** Registers every DOM/window listener of the lab (order matches the original registration order). */
export function bindEvents(app: LabApp): void {
  bindGlobalPointerTracking(app);
  bindHeroControls(app);
  bindExportAndModals(app);
  bindLabDeck(app);
  bindDrawer(app);
  bindSessionControls(app);
  bindHumanTutorAndGuiFeedback(app);
  bindArenaPointer(app);
}
