VERTEX — REGIONAL TIME + AUDIO INITIALIZATION FIX

Replace index.html, script.js and style.css in the GitHub repository with these files.
Keep supabase-config.js and supabase-auth.js in the repository; do not delete them.

This patch initializes audio and regional-time controls independently before the main UI render/event binding, so unrelated UI errors do not prevent these controls from starting. It also guards the regional clock timer and binds the timezone controls once.

After committing, open the site in a private/incognito tab or clear the browser cache / hard refresh so GitHub Pages does not serve an older script.js.
