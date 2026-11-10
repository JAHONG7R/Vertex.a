VERTEX — Discipline Celebration Update

Changes:
- Replaced falling confetti with athletic/discipline-themed sticker icons (weights, strength, focus, shield, running, fire, mountain, trophy).
- Replaced external celebration.wav dependency with an original multi-layer Web Audio chime. It uses clean pitched tones and a subtle high shimmer; it is not an exact copy of Apple's notification sound.
- Existing completion and streak milestone trigger functions remain in place.

Install:
Replace index.html, script.js and style.css in the repository with these files.
The chime is synthesized locally by the browser, so it does not need an audio file or internet connection.

Audio fix:
- Fixed sound-layer stop cleanup. A fading layer is now cleaned up even if the same sound is started again before the fade finishes.
- Audio elements are paused and released during cleanup; oscillator/source nodes are stopped and disconnected.
