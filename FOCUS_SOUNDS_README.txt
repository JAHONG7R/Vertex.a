VERTEX — FOCUS SOUNDS UPDATE

This update adds a persistent Focus Sounds mixer to the existing Vertex project.

Included layers:
- Rain and soft wind: generated ambient noise
- Birdsong and whale ambience: gentle synthesized sound effects (not field recordings)
- Binaural 10 Hz: 200 Hz left / 210 Hz right stereo tones; stereo headphones are needed to hear the beat effect
- 40 Hz: low-frequency tone

Features:
- Multiple layers can play together
- Separate volume for each active layer and a master volume
- Mixer stays mounted while navigating between Vertex sections
- Mixer can be used while the Pomodoro page/timer is open
- Save and reload named presets (stored in this browser's localStorage)
- Stop all layers or collapse the floating panel

Important:
- Tap a sound button to start audio; browsers require a user gesture before playback.
- This implementation is designed to continue during internal Vertex navigation. It does not guarantee playback after the browser/app is closed or the phone suspends the page.
- Sound layers are synthesized in the browser; whale/bird sounds are not authentic wildlife recordings.
- Keep volume comfortable. Binaural audio is an optional listening effect, not a treatment or a proven way to improve focus.

Files changed:
- index.html
- script.js
- style.css

All other project files from Vertex_Real_Time_Reminders.zip are retained.
