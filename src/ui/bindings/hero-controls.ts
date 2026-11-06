import type { LabApp } from '../../app/lab-app';
import { isVocalPresetName } from '../../audio/vocal-tract-formant-engine';
import { byId, maybeById, onClick } from '../../util/dom';

/** Hero bar: level arrows, fullscreen/pop-out, voice toggle and the phonetic soundboards. */
export function bindHeroControls(app: LabApp): void {
  // Hero Prev / Next Level Buttons
  byId('btnPrevLevel').addEventListener('click', () => app.flow.stepLevel(-1));
  byId('btnNextLevel').addEventListener('click', () => app.flow.stepLevel(1));

  // Tiny Level Up (▲) / Down (▼) Stepper right of the top-left arrow keys
  onClick('btnLevelUp', () => app.flow.stepCurriculumRung(1), { stopPropagation: true });
  onClick('btnLevelDown', () => app.flow.stepCurriculumRung(-1), { stopPropagation: true });
  window.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      app.flow.stepCurriculumRung(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      app.flow.stepCurriculumRung(-1);
    }
  });

  // Giant Top Fullscreen & Borderless Breakout Button
  onClick(
    'btnFullscreen',
    () => {
      void app.standalone.toggleTrueFullscreenOrBreakout();
    },
    { stopPropagation: true },
  );
  onClick('btnPopoutBorderlessNow', () => app.standalone.popoutBorderlessWindow());
  document.addEventListener('fullscreenchange', () => {
    const isFs = Boolean(document.fullscreenElement ?? document.webkitFullscreenElement);
    const fsTxt = maybeById('fsText');
    if (fsTxt) fsTxt.textContent = isFs ? 'EXIT FULL' : 'FULLSCREEN';
    setTimeout(() => {
      app.layout.invalidateSafeCache();
      app.layout.setupCanvases();
      app.layout.clampActiveTargetsToSafeView();
    }, 120);
  });

  // Big Top Hero Audio Button (Default OFF -> Toggles Parametric Human Vocal-Tract & Animal Imitation Synthesizer)
  onClick('btnHeroAudio', (btnHeroAudio) => {
    const isOn = app.voiceEngine.toggleAudio();
    btnHeroAudio.classList.toggle('audio-on', isOn);
    byId('heroAudioIcon').textContent = isOn ? '🔊' : '🔇';
    byId('heroAudioText').textContent = isOn ? 'VOICE & FX: ON' : 'AUDIO: OFF (TAP FOR VOICE!)';
    app.hud.showToast(
      isOn ? '🔊 HUMAN VOCAL-TRACT SYNTH: ON!' : '🔇 AUDIO MUTED (OFF)',
      isOn
        ? 'Formant glissandos, asking prosody, tok-tok chicken, frog skeee & grrr active!'
        : 'Audio returned to silent default.',
      isOn ? 'border-amber-400' : 'border-rose-500',
    );
  });

  /** The soundboards switch the voice on (and the hero button with it) before they play. */
  const enableVoiceFromSoundboard = (): void => {
    if (app.voiceEngine.enabled) return;
    app.voiceEngine.enabled = true;
    maybeById('btnHeroAudio')?.classList.add('audio-on');
    byId('heroAudioIcon').textContent = '🔊';
    byId('heroAudioText').textContent = 'VOICE & FX: ON';
  };

  // Vocal-Tract Soundboard Test Buttons inside Lab Drawer
  document.querySelectorAll<HTMLElement>('.vfx-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      enableVoiceFromSoundboard();
      const preset = btn.dataset.vfx;
      if (!isVocalPresetName(preset)) return;
      app.voiceEngine.playPreset(preset);
      app.hud.showToast(
        `🗣️ VOCAL TRACT: ${preset}`,
        'Synthesized via 3-Formant (F1/F2/F3) glottal + buccal filter bank (Zero WAVs).',
        'border-amber-400',
      );
    });
  });

  // Funny Phonetic Letter & Word Audition Buttons (Q -> kjiuueehh!, b -> buh-boing!, etc.)
  document.querySelectorAll<HTMLElement>('.phon-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      enableVoiceFromSoundboard();
      const phon = btn.dataset.phon ?? '';
      const jokeCaption = app.voiceEngine.speakGraphemeOrWord(phon, 'CELEBRATE');
      app.hud.showToast(
        `🤪 PHONETIC JOKE: "${phon}"`,
        jokeCaption || `Articulated "${phon}"`,
        'border-amber-400',
      );
    });
  });
}
