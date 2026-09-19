const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":'&quot;',"'":'&#39;'}[c]));
const money=n=>"$"+Number(n).toFixed(2);
let products=[], cart=JSON.parse(localStorage.getItem("ma_cart")||"[]");
async function getProducts(params=""){
  let q="",category="",featured=false,page=null,perPage=24,brand="",sort="new";
  try{
    const u=new URLSearchParams(params.startsWith("?")?params.slice(1):params);
    q=u.get("q")||""; category=u.get("category")||""; featured=u.get("featured")==="1";
    brand=u.get("brand")||""; sort=u.get("sort")||"new";
    page=u.has("page")?Math.max(1,Number(u.get("page"))||1):null;
    perPage=Math.min(100,Math.max(1,Number(u.get("perPage"))||24));
  }catch(e){}
  const cols="id,name,slug,brand,category,price,stock,rating,icon,image_url,description,featured";
  let query=sb.from("products").select(cols,{count:"exact"});
  const term=q.replace(/[%,()]/g," ").trim();
  const brandTerm=brand.replace(/[%,()]/g," ").trim();
  if(term) query=query.or(`name.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`);
  if(category) query=query.eq("category",category);
  if(brandTerm) query=query.ilike("brand",`%${brandTerm}%`);
  if(featured) query=query.eq("featured",true);
  if(sort==="priceAsc") query=query.order("price",{ascending:true});
  else if(sort==="priceDesc") query=query.order("price",{ascending:false});
  else if(sort==="name") query=query.order("name",{ascending:true});
  else if(sort==="stock") query=query.order("stock",{ascending:false});
  else query=query.order("created_at",{ascending:false});
  if(page!==null) query=query.range((page-1)*perPage,page*perPage-1);
  else if(featured) query=query.limit(12);
  const {data,error,count}=await query;
  if(error)throw error;
  products=data||[];
  return {products,categories:[...new Set(products.map(p=>p.category))],count:count??products.length};
}
async function getProductsByIds(ids){
  const unique=[...new Set((ids||[]).filter(Boolean))];
  if(!unique.length)return [];
  const cols="id,name,slug,brand,category,price,stock,rating,icon,image_url,description,featured";
  const {data,error}=await sb.from("products").select(cols).in("id",unique);
  if(error)throw error;
  const map=new Map((data||[]).map(p=>[p.id,p]));
  return unique.map(id=>map.get(id)).filter(Boolean);
}
async function getProduct(id){const {data,error}=await sb.from("products").select("id,name,slug,brand,category,price,stock,rating,icon,image_url,description,featured").or(`id.eq.${id},slug.eq.${id}`).limit(1).maybeSingle();if(error)throw error;return data;}
function saveCart(){localStorage.setItem("ma_cart",JSON.stringify(cart));updateCartCount()}
function updateCartCount(){$("#cartCount")&&($("#cartCount").textContent=cart.reduce((s,i)=>s+i.qty,0))}
function updateFavoriteCount(){const n=favorites().length;document.querySelectorAll("#favoriteCount").forEach(el=>el.textContent=n)}
function favorites(){return JSON.parse(localStorage.getItem("ma_favorites")||"[]")}
function toggleFavorite(id){let f=favorites();f=f.includes(id)?f.filter(x=>x!==id):[...f,id];localStorage.setItem("ma_favorites",JSON.stringify(f));document.querySelectorAll(`[data-fav="${id}"]`).forEach(b=>{b.classList.toggle("active",f.includes(id));b.textContent=f.includes(id)?"♥":"♡"});updateFavoriteCount();if(typeof renderFavoritesPage==="function")renderFavoritesPage()}
function add(id){const p=products.find(x=>x.id===id);if(!p)return;if(Number(p.stock)<=0)return alert("هذا المنتج غير متوفر حاليًا");const x=cart.find(i=>i.id===id);if(x){if(x.qty>=Number(p.stock))return alert("وصلت للكمية المتوفرة حاليًا");x.qty++}else cart.push({id,qty:1});saveCart();renderCart();openDrawer()}
function remove(id){cart=cart.filter(x=>x.id!==id);saveCart();renderCart()}
function change(id,d){const x=cart.find(i=>i.id===id);if(!x)return;const p=products.find(v=>v.id===id);if(d>0&&p&&x.qty>=Number(p.stock))return alert("وصلت للكمية المتوفرة حاليًا");x.qty+=d;if(x.qty<1)return remove(id);saveCart();renderCart()}
function renderCart(){const box=$("#cartItems");if(!box)return;const rows=cart.map(i=>{const p=products.find(x=>x.id===i.id);return p?`<div class="cart-item"><div class="ci">${p.image_url?`<img src="${p.image_url}" alt="${p.name}">`:(p.icon||"🦷")}</div><div><h4>${p.name}</h4><small>${money(p.price)}</small><div class="qty"><button onclick="change('${p.id}',-1)">−</button><span>${i.qty}</span><button onclick="change('${p.id}',1)">+</button></div></div><button class="small" onclick="remove('${p.id}')">حذف</button></div>`:""}).join("");box.innerHTML=rows||"<p style='text-align:center;padding:35px;color:#887f98'>السلة فارغة حاليًا 🛒</p>";const total=cart.reduce((s,i)=>{const p=products.find(x=>x.id===i.id);return s+(p?p.price*i.qty:0)},0);if($("#cartTotal"))$("#cartTotal").textContent=money(total)}
function openDrawer(){$("#drawer")?.classList.add("open");$("#overlay")?.classList.add("show")}
function closeDrawer(){$("#drawer")?.classList.remove("open");$("#overlay")?.classList.remove("show")}
function productCard(p){const fav=favorites().includes(p.id);const stock=Number(p.stock||0);const stockHtml=stock<=0?`<div class="stock-badge stock-out">غير متوفر</div>`:(stock<=5?`<div class="stock-badge stock-low">متبقي ${stock} فقط</div>`:`<div class="stock-badge stock-ok">متوفر</div>`);const visual=p.image_url?`<img src="${p.image_url}" alt="${p.name}" loading="lazy">`:(p.icon||"🦷");return `<article class="product"><a href="product.html?id=${encodeURIComponent(p.id)}"><div class="pimg"><button class="fav-btn ${fav?"active":""}" data-fav="${p.id}" onclick="event.preventDefault();toggleFavorite('${p.id}')">${fav?"♥":"♡"}</button>${visual}</div><h3>${p.name}</h3></a><div class="brand">${p.brand}</div><div class="price">${money(p.price)}</div><div class="rating">★★★★★ <span>(${p.rating})</span></div>${stockHtml}<button class="btn primary" ${stock<=0?"disabled":""} onclick="add('${p.id}')">أضف للسلة 🛒</button></article>`}
function loadSocialLinks(){const c=window.MA_CONFIG||{};const wa=c.WHATSAPP_URL||(c.WHATSAPP_NUMBER&&c.WHATSAPP_NUMBER.indexOf('X')<0?`https://wa.me/${c.WHATSAPP_NUMBER}`:'#');const map={socialWhatsapp:wa,socialTelegram:c.TELEGRAM_URL,socialFacebook:c.FACEBOOK_URL,socialInstagram:c.INSTAGRAM_URL,communityWhatsapp:wa,communityTelegram:c.TELEGRAM_URL,communityFacebook:c.FACEBOOK_URL,communityInstagram:c.INSTAGRAM_URL};Object.entries(map).forEach(([id,url])=>{const el=document.getElementById(id);if(el){ if(url&&url!=="#"){el.href=url;el.classList.remove("disabled-social");el.removeAttribute("aria-disabled");}else{el.href="#";el.classList.add("disabled-social");el.setAttribute("aria-disabled","true");el.addEventListener("click",e=>e.preventDefault(),{once:false});} }});}
document.addEventListener("DOMContentLoaded",async()=>{updateCartCount();updateFavoriteCount();loadSocialLinks();if($("#cartItems")){try{products=await getProductsByIds(cart.map(i=>i.id));renderCart()}catch(e){console.error(e)}}$("#cartButton")?.addEventListener("click",openDrawer);$("#closeDrawer")?.addEventListener("click",closeDrawer);$("#overlay")?.addEventListener("click",closeDrawer);$("#searchInput")?.addEventListener("keydown",e=>{if(e.key==="Enter")location.href="shop.html?q="+encodeURIComponent(e.target.value)});$(".search button")?.addEventListener("click",()=>{const i=$("#searchInput");if(i)location.href="shop.html?q="+encodeURIComponent(i.value)});if($("#featuredGrid")){try{const d=await getProducts("?featured=1");$("#featuredGrid").innerHTML=d.products.map(productCard).join("")}catch(e){console.error(e)}}});
