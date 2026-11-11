VERTEX — PHASE 19 (PHASE 18 + AUDIO RESUME)

Ushbu versiya Phase 18 dagi 365 kunlik faollik taqvimini saqlaydi va Phase 17 qurilmadan musiqa ijro etish qismini yangilaydi.

Yangi imkoniyatlar:
1) Qurilmadan tanlangan qo‘shiq IndexedDB kutubxonasida saqlanadi.
2) Ijro holati, qo‘shiq identifikatori va oxirgi ijro vaqti localStorage’da muntazam saqlanadi.
3) Sahifa qayta yuklangach, sayt avvalgi qo‘shiqni va vaqtini topib, avtomatik davom ettirishga urinadi.
4) Brauzer autoplay'ni bloklasa, qo‘shiq tayyor holatda qoladi; ▶ tugmasini bir marta bosish bilan saqlangan joyidan davom etadi.
5) Phase 18 dagi 365 kunlik activity calendar va mavjud boshqa funksiyalar saqlangan.

MUHIM BRAUZER CHEKLOVI:
Sahifa to‘liq qayta yuklanganda brauzer eski audio oqimini majburan to‘xtatadi. Sayt qayta ochilgach avtomatik ijro brauzer ruxsat bersa boshlanadi; autoplay siyosati bloklasa, foydalanuvchining bir marta ▶ bosishi talab qilinadi. Oddiy veb-sahifa JavaScript'i bu cheklovni chetlab o‘ta olmaydi va 1–2 soniya uzilishni ham kafolatli yo‘qota olmaydi.

O‘rnatish:
- ZIP ichidagi index.html, script.js, style.css fayllarini GitHub loyihasidagi mos fayllar bilan almashtiring.
- assets/audio papkasini, supabase-config.js va supabase-auth.js fayllarini o‘chirmang; ular ZIP ichida bo‘lmasa, mavjud loyihada qoldiring.

Tekshiruv: script.js node --check va ZIP arxiv yaxlitligi tekshirilgan. GitHub Pages jonli muhitida sinovdan o‘tkazilmagan.
