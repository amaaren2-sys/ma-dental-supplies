# نشر MA Dental Supplies على الإنترنت

النسخة مجهزة للنشر على Render + PostgreSQL (مثل Supabase).

## قاعدة البيانات
1. أنشئ مشروع PostgreSQL.
2. من لوحة قاعدة البيانات انسخ `DATABASE_URL` المناسب للخادم.
3. لا تضع بيانات قاعدة البيانات داخل الكود.
4. الخادم ينشئ الجداول تلقائيًا عند أول تشغيل ويزرع المنتجات التجريبية إذا كانت قاعدة المنتجات فارغة.

## الاستضافة
1. ارفع المشروع إلى GitHub كمستودع خاص.
2. في Render اختر New → Web Service ثم المستودع.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Health Check: `/api/health`

## متغيرات البيئة
- `DATABASE_URL`
- `ADMIN_PASSWORD`
- `WHATSAPP_NUMBER`
- `INSTAGRAM_URL`
- `FACEBOOK_URL`
- `TELEGRAM_URL`
- `WHATSAPP_URL`

## HTTPS والدومين
Render يوفر عنوانًا عامًا ويصدر TLS/HTTPS تلقائيًا. لإضافة دومين خاص: Settings → Custom Domains ثم اضبط DNS عند مزود الدومين.

## لوحة التحكم
`https://YOUR-DOMAIN/admin.html`

كلمة مرور لوحة التحكم تأتي من `ADMIN_PASSWORD`.
