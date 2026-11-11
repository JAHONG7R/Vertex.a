VERTEX — PHASE 16: EXPANDED PDF ANALYTICS REPORT

WHAT CHANGED
The PDF/print report available in Settings > Ma'lumotlar > Analytics hisobotlari now includes:
1) Summary cards: completion rate, total completions, active days, and active habit count.
2) Comparison with the previous 30-day period: completion-rate change and active-day comparison.
3) Per-habit details: category, completions, completion rate, change against the previous 30 days, and longest streak observed within the current 30-day window.
4) Category breakdown: number of habits, completions, and completion rate per category.
5) Weekday activity: number of dates observed and average completions per weekday.
6) Daily activity log for all 30 days: date, weekday, completed habits, and daily completion percentage.

WHERE TO FIND
Settings > Ma'lumotlar > Analytics hisobotlari > “Hisobotni PDF shaklida saqlash” > “Hisobotni tayyorlash”.

INSTALLATION
Replace these files in the existing GitHub Pages repository:
- index.html
- script.js
- style.css

Keep these existing files unchanged:
- supabase-config.js
- supabase-auth.js

No database schema or storage-key changes were made. The report is generated locally in the browser and uses existing habit history only.
