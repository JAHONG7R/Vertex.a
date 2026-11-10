VERTEX — DEVICE MUSIC PLAYER UPDATE

Included files:
- index.html
- script.js
- style.css

What changed:
- Replaced the old “Qo‘shiq qo‘shish” panel with an integrated device music player.
- “Kutubxonani ochish” opens the Android/browser system file picker after the user taps the button (explicit user action/permission flow).
- Users can select multiple audio files; selected files are saved in this browser on this device using IndexedDB.
- Player controls: play/pause, previous/next, seek/progress, elapsed/duration, and volume.
- Existing ambient sound mixer and its controls remain in place.

Important browser privacy limitation:
A website cannot silently scan or directly enumerate every song in Android's media library. Browsers require the user to choose files through the system picker. Only selected files become available to the player. This is the supported privacy-preserving web approach; it does not grant unrestricted background access to the whole device library.

Install:
Replace index.html, script.js, and style.css in the GitHub Pages repository. Keep supabase-config.js and supabase-auth.js unchanged.

Validation:
JavaScript syntax checked with node --check. This package has not been deployed to or tested on the live GitHub Pages site.
