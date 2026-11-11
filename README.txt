VERTEX — AUDIO PERSISTENCE & LIVE CLOCK (PHASE 17)

O'zgarishlar:
1) Focus Sounds mikserida yoqilgan ambience qatlamlari, har bir qatlam ovoz balandligi va master volume localStorage'da saqlanadi.
2) Sahifa yangilangandan keyin oldingi qatlamlar tiklash uchun navbatga olinadi. Brauzer autoplay siyosati sababli avtomatik ijro bloklansa, sahifaga bir marta teging yoki klaviaturada tugma bosing — ovozlar qayta boshlanadi. Brauzer sahifani qayta yuklash vaqtida audio oqimini uzadi; uzluksiz, bir soniya ham to'xtamasdan ijro etishni oddiy sahifa JavaScript'i kafolatlay olmaydi.
3) Regional clock har soniyada yangilanadi; sahifa qayta ko'ringanda, fokusga qaytganda va pageshow hodisasida darhol sinxronlanadi.

O'rnatish:
- index.html, script.js, style.css fayllarini loyihadagi mos fayllar bilan almashtiring.
- assets/audio papkasini va supabase-config.js / supabase-auth.js fayllarini o'chirmang yoki almashtirmang.

Tekshiruv: script.js node --check va ZIP yaxlitligi.
Jonli GitHub Pages muhitida sinovdan o'tkazilmagan.
