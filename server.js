const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 10000);
const HOST = "0.0.0.0";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "";
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const SEED_FILE = path.join(ROOT, "data", "products.json");

if (!process.env.DATABASE_URL) console.warn("DATABASE_URL is missing. Configure an online PostgreSQL database before production use.");
if (!ADMIN_PASSWORD) console.warn("ADMIN_PASSWORD is missing. Admin login will be disabled.");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  ssl: process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000
});

const social = {
  instagram: process.env.INSTAGRAM_URL || "#",
  facebook: process.env.FACEBOOK_URL || "#",
  telegram: process.env.TELEGRAM_URL || "#",
  whatsapp: process.env.WHATSAPP_URL || (WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}` : "#")
};

function json(res, status, value, extra={}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", ...extra});
  res.end(body);
}
function parseBody(req) {
  return new Promise((resolve,reject)=>{
    let raw=""; req.on("data",c=>{ raw += c; if(raw.length > 1024*1024) req.destroy(); });
    req.on("end",()=>{ try { resolve(raw ? JSON.parse(raw) : {}); } catch(e) { reject(e); } });
    req.on("error",reject);
  });
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie||"").split(";").filter(Boolean).map(x=>{
    const i=x.indexOf("="); return [x.slice(0,i).trim(), decodeURIComponent(x.slice(i+1).trim())];
  }));
}
function signToken(exp) {
  const data = `admin.${exp}`;
  const sig = crypto.createHmac("sha256", ADMIN_PASSWORD).update(data).digest("hex");
  return `${data}.${sig}`;
}
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const token = cookies(req).admin_token || "";
  const parts = token.split(".");
  if(parts.length !== 3 || parts[0] !== "admin") return false;
  const exp = Number(parts[1]);
  if(!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = signToken(exp).split(".")[2];
  return crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected));
}
function requireAdmin(req,res) { if(!isAdmin(req)){ json(res,401,{error:"غير مصرح"}); return false; } return true; }
function slugify(s) { return String(s||"").toLowerCase().trim().replace(/[^\w\u0600-\u06ff]+/g,"-").replace(/^-|-$/g,""); }
function normalizeProduct(p) {
  return { id:p.id, name:p.name, slug:p.slug, brand:p.brand||"", category:p.category||"المواد", price:Number(p.price)||0, stock:Number(p.stock)||0, rating:Number(p.rating)||5, icon:p.icon||"🦷", description:p.description||"", featured:!!p.featured };
}

async function initDb() {
  if (!process.env.DATABASE_URL) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, brand TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'المواد', price NUMERIC(12,2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0, rating NUMERIC(3,2) NOT NULL DEFAULT 5,
      icon TEXT DEFAULT '🦷', description TEXT DEFAULT '', featured BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), status TEXT NOT NULL DEFAULT 'جديد',
      customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_location TEXT NOT NULL,
      notes TEXT DEFAULT '', total NUMERIC(12,2) NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL, product_name TEXT NOT NULL, price NUMERIC(12,2) NOT NULL, qty INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
  `);
  const {rows} = await pool.query("SELECT COUNT(*)::int AS count FROM products");
  if(rows[0].count === 0 && fs.existsSync(SEED_FILE)) {
    const seeds = JSON.parse(fs.readFileSync(SEED_FILE,"utf8")).map(normalizeProduct);
    for(const p of seeds) await pool.query(`INSERT INTO products(id,name,slug,brand,category,price,stock,rating,icon,description,featured) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`, [p.id,p.name,p.slug||slugify(p.name),p.brand,p.category,p.price,p.stock,p.rating,p.icon,p.description,p.featured]);
  }
}

async function getProducts(q="", category="", featured=false) {
  const params=[]; const where=[];
  if(q){ params.push(`%${q.toLowerCase()}%`); where.push(`LOWER(name || ' ' || brand || ' ' || category) LIKE $${params.length}`); }
  if(category){ params.push(category); where.push(`category=$${params.length}`); }
  if(featured) where.push("featured=TRUE");
  const sql = `SELECT id,name,slug,brand,category,price,stock,rating,icon,description,featured FROM products ${where.length?"WHERE "+where.join(" AND "):""} ORDER BY created_at DESC`;
  const {rows}=await pool.query(sql,params); return rows;
}
function orderView(order, items) {
  return { id:order.id, createdAt:order.created_at, status:order.status, customer:{name:order.customer_name,phone:order.customer_phone,location:order.customer_location}, notes:order.notes||"", total:Number(order.total), items:items.map(i=>({id:i.product_id,name:i.product_name,price:Number(i.price),qty:i.qty})) };
}
async function getOrder(id) {
  const o=(await pool.query("SELECT * FROM orders WHERE id=$1",[id])).rows[0];
  if(!o) return null;
  const items=(await pool.query("SELECT * FROM order_items WHERE order_id=$1 ORDER BY id",[id])).rows;
  return orderView(o,items);
}

async function api(req,res,url) {
  const parts=url.pathname.split("/").filter(Boolean);
  if(req.method==="GET" && url.pathname==="/api/health") return json(res,200,{ok:true,database:!!process.env.DATABASE_URL});
  if(req.method==="GET" && url.pathname==="/api/config") return json(res,200,{storeName:process.env.STORE_NAME||"MA Dental Supplies",social});

  if(req.method==="GET" && url.pathname==="/api/products") {
    const products=await getProducts(url.searchParams.get("q")||"",url.searchParams.get("category")||"",url.searchParams.get("featured")==="1");
    return json(res,200,{products,categories:[...new Set(products.map(p=>p.category))]});
  }
  if(req.method==="GET" && parts[0]==="api" && parts[1]==="products" && parts[2]) {
    const {rows}=await pool.query("SELECT id,name,slug,brand,category,price,stock,rating,icon,description,featured FROM products WHERE id=$1 OR slug=$1 LIMIT 1",[parts[2]]);
    return rows[0]?json(res,200,rows[0]):json(res,404,{error:"المنتج غير موجود"});
  }

  if(req.method==="POST" && url.pathname==="/api/orders") {
    const data=await parseBody(req);
    if(!data.customer?.name || !data.customer?.phone || !["جامعة دمشق","البرامكة"].includes(data.customer?.location) || !Array.isArray(data.items) || !data.items.length) return json(res,400,{error:"الاسم والهاتف والمكان والمنتجات مطلوبة"});
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const clean=[];
      for(const i of data.items) {
        const {rows}=await client.query("SELECT id,name,price,stock FROM products WHERE id=$1 FOR UPDATE",[i.id]);
        const p=rows[0]; const qty=Math.max(1,Math.floor(Number(i.qty)||1));
        if(!p) continue;
        if(p.stock < qty) throw new Error(`المخزون غير كافٍ للمنتج: ${p.name}`);
        clean.push({id:p.id,name:p.name,price:Number(p.price),qty});
      }
      if(!clean.length) throw new Error("المنتجات غير صالحة");
      const total=clean.reduce((s,i)=>s+i.price*i.qty,0);
      const id="MA-"+Date.now().toString(36).toUpperCase();
      await client.query("INSERT INTO orders(id,status,customer_name,customer_phone,customer_location,notes,total) VALUES($1,'جديد',$2,$3,$4,$5,$6)",[id,data.customer.name,data.customer.phone,data.customer.location,String(data.notes||""),total]);
      for(const i of clean){ await client.query("INSERT INTO order_items(order_id,product_id,product_name,price,qty) VALUES($1,$2,$3,$4,$5)",[id,i.id,i.name,i.price,i.qty]); await client.query("UPDATE products SET stock=stock-$1,updated_at=NOW() WHERE id=$2",[i.qty,i.id]); }
      await client.query("COMMIT");
      const order=await getOrder(id);
      return json(res,201,{order,whatsappNumber:WHATSAPP_NUMBER});
    } catch(e) { await client.query("ROLLBACK"); return json(res,400,{error:e.message||"تعذر إنشاء الطلب"}); }
    finally { client.release(); }
  }

  if(parts[0]==="api" && parts[1]==="admin") {
    if(req.method==="POST" && parts[2]==="login") {
      const data=await parseBody(req);
      if(!ADMIN_PASSWORD || data.password!==ADMIN_PASSWORD) return json(res,401,{error:"كلمة المرور غير صحيحة"});
      const exp=Date.now()+1000*60*60*12; const token=signToken(exp);
      const secure=process.env.NODE_ENV==="production"?"; Secure":"";
      return json(res,200,{ok:true},{"Set-Cookie":`admin_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`});
    }
    if(req.method==="POST" && parts[2]==="logout") return json(res,200,{ok:true},{"Set-Cookie":"admin_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"});
    if(req.method==="GET" && parts[2]==="me") return json(res,200,{authenticated:isAdmin(req)});
    if(!requireAdmin(req,res)) return;
    if(req.method==="GET" && parts[2]==="stats") {
      const [p,o,r,n]=await Promise.all([
        pool.query("SELECT COUNT(*)::int count FROM products"),pool.query("SELECT COUNT(*)::int count FROM orders"),
        pool.query("SELECT COALESCE(SUM(total),0)::numeric revenue FROM orders WHERE status<>'ملغى'"),pool.query("SELECT COUNT(*)::int count FROM orders WHERE status='جديد'")]);
      return json(res,200,{products:p.rows[0].count,orders:o.rows[0].count,pending:n.rows[0].count,revenue:Number(r.rows[0].revenue)});
    }
    if(req.method==="GET" && parts[2]==="orders") {
      const {rows}=await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
      const result=[]; for(const o of rows){const items=(await pool.query("SELECT * FROM order_items WHERE order_id=$1 ORDER BY id",[o.id])).rows; result.push(orderView(o,items));}
      return json(res,200,result);
    }
    if(req.method==="PATCH" && parts[2]==="orders" && parts[3]) {
      const data=await parseBody(req); const allowed=["جديد","قيد التجهيز","جاهز للتسليم","تم التسليم","ملغى"];
      if(!allowed.includes(data.status)) return json(res,400,{error:"حالة غير صالحة"});
      const {rows}=await pool.query("UPDATE orders SET status=$1 WHERE id=$2 RETURNING *",[data.status,parts[3]]); if(!rows[0])return json(res,404,{error:"الطلب غير موجود"});
      return json(res,200,await getOrder(parts[3]));
    }
    if(req.method==="POST" && parts[2]==="products") {
      const data=await parseBody(req); if(!data.name) return json(res,400,{error:"اسم المنتج مطلوب"});
      const p={id:"p"+crypto.randomBytes(5).toString("hex"),name:String(data.name),slug:slugify(data.name)+"-"+Date.now().toString(36),brand:String(data.brand||""),category:data.category==="البكجات"?"البكجات":"المواد",price:Number(data.price)||0,stock:Math.max(0,Math.floor(Number(data.stock)||0)),rating:Number(data.rating)||5,icon:data.icon||"🦷",description:String(data.description||""),featured:!!data.featured};
      const {rows}=await pool.query(`INSERT INTO products(id,name,slug,brand,category,price,stock,rating,icon,description,featured) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[p.id,p.name,p.slug,p.brand,p.category,p.price,p.stock,p.rating,p.icon,p.description,p.featured]); return json(res,201,rows[0]);
    }
    if(req.method==="PATCH" && parts[2]==="products" && parts[3]) {
      const data=await parseBody(req); const current=(await pool.query("SELECT * FROM products WHERE id=$1",[parts[3]])).rows[0]; if(!current)return json(res,404,{error:"المنتج غير موجود"});
      const p={name:data.name!==undefined?String(data.name):current.name,brand:data.brand!==undefined?String(data.brand):current.brand,category:data.category!==undefined?(data.category==="البكجات"?"البكجات":"المواد"):current.category,price:data.price!==undefined?Number(data.price):Number(current.price),stock:data.stock!==undefined?Math.max(0,Math.floor(Number(data.stock)||0)):current.stock,icon:data.icon!==undefined?String(data.icon):current.icon,description:data.description!==undefined?String(data.description):current.description,featured:data.featured!==undefined?!!data.featured:current.featured};
      const {rows}=await pool.query(`UPDATE products SET name=$1,slug=$2,brand=$3,category=$4,price=$5,stock=$6,icon=$7,description=$8,featured=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,[p.name,slugify(p.name)+"-"+parts[3],p.brand,p.category,p.price,p.stock,p.icon,p.description,p.featured,parts[3]]); return json(res,200,rows[0]);
    }
    if(req.method==="DELETE" && parts[2]==="products" && parts[3]) { await pool.query("DELETE FROM products WHERE id=$1",[parts[3]]); return json(res,200,{ok:true}); }
  }
  return json(res,404,{error:"Not found"});
}

const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json"};
const server=http.createServer(async(req,res)=>{
  res.setHeader("X-Content-Type-Options","nosniff"); res.setHeader("X-Frame-Options","SAMEORIGIN"); res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
  const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
  try {
    if(url.pathname.startsWith("/api/")) return await api(req,res,url);
    let filePath=path.join(PUBLIC,url.pathname==="/"?"index.html":url.pathname);
    if(!filePath.startsWith(PUBLIC)) return json(res,403,{error:"Forbidden"});
    if(!fs.existsSync(filePath)||fs.statSync(filePath).isDirectory()) filePath=path.join(PUBLIC,"index.html");
    const ext=path.extname(filePath); res.writeHead(200,{"Content-Type":mime[ext]||"text/plain; charset=utf-8","Cache-Control":ext===".html"?"no-cache":"public,max-age=86400"}); fs.createReadStream(filePath).pipe(res);
  } catch(e) { console.error(e); json(res,500,{error:"Server error"}); }
});

(async()=>{ try { await initDb(); server.listen(PORT,HOST,()=>console.log(`MA Dental Supplies listening on ${HOST}:${PORT}`)); } catch(e) { console.error("Database initialization failed:",e); process.exit(1); } })();
