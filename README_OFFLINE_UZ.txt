VERTEX — OFFLINE / PWA YANGILANISHI
==================================

NIMA QO'SHILDI?
- PWA manifest: Vertex'ni telefon yoki kompyuterga ilova sifatida o'rnatish uchun.
- Service Worker: asosiy sahifa, CSS, JavaScript, fon rasmlari va ikonalarni keshlaydi.
- Keshdagi fayllar orqali internet bo'lmaganda ham Vertex interfeysi ochiladi.
- Supabase JS kutubxonasi va Google Fonts birinchi marta internetda yuklangach keshga olinadi.

GITHUB'GA JOYLASH:
1. ZIP ichidagi mavjud index.html, style.css, script.js va fon rasmlarini o'zingizdagi fayllar bilan almashtiring.
2. Yangi service-worker.js, manifest.webmanifest va icons papkasini ham repository root'iga yuklang.
3. supabase-config.js, supabase-auth.js va boshqa mavjud loyiha fayllarini o'chirmang yoki almashtirmang.
4. GitHub Pages HTTPS orqali ishlashi kerak. Oddiy file:// orqali ochilganda Service Worker ishlamaydi.
5. Saytni internet bor paytda bir marta to'liq ochib turing. Keyin qayta ochib, samolyot rejimida sinab ko'ring.

OFFLINE CHEGARALARI:
- Odatlar, belgilashlar, vazifalar, taymer va sozlamalar mavjud brauzer xotirasida (localStorage) saqlanadi.
- Supabase login, bulutga sinxronlash, serverdagi ma'lumotlar, push bildirishnomalar va boshqa server talab qiladigan amallar internet bo'lmasa ishlamaydi.
- Offline kiritilgan o'zgarishlar shu qurilmaning lokal ma'lumotlarida qoladi. Internet qaytganda bulutga avtomatik yuborilishi mavjud Supabase sync kodiga bog'liq; ushbu paket alohida sync-queue qo'shmaydi.
- Bir qurilmada saqlangan localStorage ma'lumotlari boshqa qurilmaga avtomatik o'tmaydi. Mavjud JSON backup/import funksiyasidan foydalaning.
- Birinchi marta yuklash va yangi versiya keshi uchun internet kerak. Sayt yangilanganda yangi Service Worker keyingi yuklanishda yangilanadi.

XAVFSIZLIK:
- Supabase API so'rovlari va autentifikatsiya endpointlari keshlanmaydi.
- Faqat app shell, statik fayllar va kerakli statik CDN/font resurslari keshlanadi.


BACKGROUND YANGILANISHI:
- Desktop fon endi telefon versiyasidagi ayni artwork asosida tayyorlangan 1672x941 landscape formatda.
- Desktop ekranda avvalgi 16:9 full-screen cover o‘lchamida ko‘rinadi.
- Telefonda alohida 1024x1536 portrait fon saqlangan.
