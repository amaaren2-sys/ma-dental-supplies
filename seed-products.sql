-- Initial MA Dental Supplies products
delete from public.products where id in ('p7','p8');
insert into public.products (id,name,slug,brand,category,price,stock,rating,icon,description,featured) values
('p1','Composite Resin','composite-resin','3M','المواد',18,24,4.8,'🧴','مادة كومبوزيت للاستخدامات السريرية والتعليمية. هذه بيانات تجريبية قابلة للتعديل من لوحة التحكم.',true),
('p2','Dental Mirror','dental-mirror','Hu-Friedy','المواد',12,35,4.7,'🔍','مرآة أسنان للاستخدام اليومي. بيانات المنتج الحالية تجريبية ويمكن استبدالها بالمواصفات الفعلية.',true),
('p3','Alginate Impression Material','alginate-impression-material','Dentsply Sirona','المواد',25,18,4.9,'🧪','مادة طبعات ألجينات. يرجى استبدال الوصف بمواصفات المنتج الفعلية قبل النشر.',true),
('p4','Gloves (Nitrile)','nitrile-gloves','Medicom','المواد',8.5,50,4.6,'🧤','قفازات نيتريل. المقاسات والتفاصيل قابلة للإضافة لاحقًا.',true),
('p5','Light Cure Composite','light-cure-composite','Ivoclar','المواد',22,16,4.8,'🦷','كومبوزيت ضوئي. منتج تجريبي للواجهة.',true),
('p6','Dental Explorer','dental-explorer','Hu-Friedy','المواد',10,27,4.7,'🛠️','مسبار أسنان للاستخدامات التعليمية والسريرية.',false)
on conflict (id) do nothing;
