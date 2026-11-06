// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import type { LabApp } from '../../app/lab-app';

/** Hero bar: level arrows, fullscreen/pop-out, voice toggle and the phonetic soundboards. */
export function bindHeroControls(app: LabApp): void {
  // Hero Prev / Next Level Buttons
  document.getElementById('btnPrevLevel').addEventListener('click', () => app.flow.stepLevel(-1));
  document.getElementById('btnNextLevel').addEventListener('click', () => app.flow.stepLevel(1));

  // Giant Top Fullscreen & Borderless Breakout Button
  const btnFullscreen = document.getElementById('btnFullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', (e) => {
      e.stopPropagation();
      app.standalone.toggleTrueFullscreenOrBreakout();
    });
  }
  const btnPopoutNow = document.getElementById('btnPopoutBorderlessNow');
  if (btnPopoutNow) {
    btnPopoutNow.addEventListener('click', () => {
      app.standalone.popoutBorderlessWindow();
    });
  }
  document.addEventListener('fullscreenchange', () => {
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    const fsTxt = document.getElementById('fsText');
    if (fsTxt) fsTxt.textContent = isFs ? 'EXIT FULL' : 'FULLSCREEN';
    setTimeout(() => {
      app._cachedSafeCenter = null;
      app.layout.setupCanvases();
      app.layout.clampActiveTargetsToSafeView();
    }, 120);
  });

  // Big Top Hero Audio Button (Default OFF -> Toggles Parametric Human Vocal-Tract & Animal Imitation Synthesizer)
  const btnHeroAudio = document.getElementById('btnHeroAudio');
  if (btnHeroAudio) {
    btnHeroAudio.addEventListener('click', () => {
      const isOn = app.voiceEngine.toggleAudio();
      btnHeroAudio.classList.toggle('audio-on', isOn);
      document.getElementById('heroAudioIcon').textContent = isOn ? '🔊' : '🔇';
      document.getElementById('heroAudioText').textContent = isOn
        ? 'VOICE & FX: ON'
        : 'AUDIO: OFF (TAP FOR VOICE!)';
      app.hud.showToast(
        isOn ? '🔊 HUMAN VOCAL-TRACT SYNTH: ON!' : '🔇 AUDIO MUTED (OFF)',
        isOn
          ? 'Formant glissandos, asking prosody, tok-tok chicken, frog skeee & grrr active!'
          : 'Audio returned to silent default.',
        isOn ? 'border-amber-400' : 'border-rose-500',
      );
    });
  }

  // Vocal-Tract Soundboard Test Buttons inside Lab Drawer
  document.querySelectorAll('.vfx-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!app.voiceEngine.enabled) {
        app.voiceEngine.enabled = true;
        const heroBtn = document.getElementById('btnHeroAudio');
        if (heroBtn) heroBtn.classList.add('audio-on');
        document.getElementById('heroAudioIcon').textContent = '🔊';
        document.getElementById('heroAudioText').textContent = 'VOICE & FX: ON';
      }
      const preset = btn.dataset.vfx;
      app.voiceEngine.playPreset(preset);
      app.hud.showToast(
        `🗣️ VOCAL TRACT: ${preset}`,
        'Synthesized via 3-Formant (F1/F2/F3) glottal + buccal filter bank (Zero WAVs).',
        'border-amber-400',
      );
    });
  });

  // Funny Phonetic Letter & Word Audition Buttons (Q -> kjiuueehh!, b -> buh-boing!, etc.)
  document.querySelectorAll('.phon-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!app.voiceEngine.enabled) {
        app.voiceEngine.enabled = true;
        const heroBtn = document.getElementById('btnHeroAudio');
        if (heroBtn) heroBtn.classList.add('audio-on');
        document.getElementById('heroAudioIcon').textContent = '🔊';
        document.getElementById('heroAudioText').textContent = 'VOICE & FX: ON';
      }
      const phon = btn.dataset.phon;
      const jokeCaption = app.voiceEngine.speakGraphemeOrWord(phon, 'CELEBRATE');
      app.hud.showToast(
        `🤪 PHONETIC JOKE: "${phon}"`,
        jokeCaption || `Articulated "${phon}"`,
        'border-amber-400',
      );
    });
  });
}
