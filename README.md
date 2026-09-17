# MA Dental Supplies — Professional v2

نسخة احترافية تعمل مع GitHub Pages + Supabase.

## أهم الميزات
- كتالوج كبير مع بحث وفلاتر وترتيب وPagination.
- مواد وبكجات، صور المنتجات، المخزون والأسعار.
- سلة مشتريات وCheckout.
- إنشاء طلب آمن عبر Supabase RPC مع خصم المخزون.
- أرقام طلبات متسلسلة MA-1, MA-2...
- صفحة تتبع الطلب برقم الطلب ورقم الهاتف.
- لوحة تحكم للمنتجات والطلبات والمخزون وحالات الطلب.
- حذف الطلبات والمنتجات.
- رفع صور المنتجات إلى Supabase Storage.
- استيراد وتصدير المنتجات CSV لإدارة مئات المنتجات.
- مفضلة المنتجات.
- استعادة كلمة مرور الإدارة.
- FAQ وروابط التواصل.

## النشر
1. ارفع الملفات إلى GitHub Pages في جذر المستودع.
2. احتفظ بملف `config.js` العامل لديك ولا تستبدله بنسخة placeholder إذا كان يحتوي إعدادات Supabase.
3. في Supabase SQL Editor شغّل `supabase-schema.sql` مرة واحدة.
4. أنشئ مستخدم الإدارة في Supabase Authentication.
5. اجعل Site URL في Supabase هو رابط GitHub Pages.

## مهم
النسخة لا تضع `service_role` في الواجهة. مفتاح Supabase المستخدم في `config.js` يجب أن يكون publishable/anon فقط.

### Scalability note
The shop uses database-side pagination (24 products per page) and database-side filtering/sorting, so adding hundreds of products does not require downloading the whole catalog to the browser. Favorites remain local to each visitor's browser via `localStorage` and do not create Supabase rows or affect order capacity.


## V3 setup
Before publishing, edit only `config.js` to add your real WhatsApp number and social links. Keep the existing Supabase URL and publishable key unchanged.
