const $=s=>document.querySelector(s);
const money=n=>"$"+Number(n).toFixed(2);
let products=[], cart=JSON.parse(localStorage.getItem("ma_cart")||"[]");
async function getProducts(params=""){
  let q="",category="",featured=false;
  try{const u=new URLSearchParams(params.startsWith("?")?params.slice(1):params);q=u.get("q")||"";category=u.get("category")||"";featured=u.get("featured")==="1";}catch(e){}
  let query=sb.from("products").select("id,name,slug,brand,category,price,stock,rating,icon,description,featured").order("created_at",{ascending:false});
  if(q) query=query.or(`name.ilike.%${q}%,brand.ilike.%${q}%,category.ilike.%${q}%`);
  if(category) query=query.eq("category",category);
  if(featured) query=query.eq("featured",true);
  const {data,error}=await query;if(error)throw error;products=data||[];return {products,categories:[...new Set(products.map(p=>p.category))]};
}
async function getProduct(id){const {data,error}=await sb.from("products").select("id,name,slug,brand,category,price,stock,rating,icon,description,featured").or(`id.eq.${id},slug.eq.${id}`).limit(1).maybeSingle();if(error)throw error;return data;}
function saveCart(){localStorage.setItem("ma_cart",JSON.stringify(cart));updateCartCount()}
function updateCartCount(){$("#cartCount")&&($("#cartCount").textContent=cart.reduce((s,i)=>s+i.qty,0))}
function add(id){const p=products.find(x=>x.id===id);if(!p)return;const x=cart.find(i=>i.id===id);if(x)x.qty++;else cart.push({id,qty:1});saveCart();renderCart();openDrawer()}
function remove(id){cart=cart.filter(x=>x.id!==id);saveCart();renderCart()}
function change(id,d){const x=cart.find(i=>i.id===id);if(!x)return;x.qty+=d;if(x.qty<1)return remove(id);saveCart();renderCart()}
function renderCart(){const box=$("#cartItems");if(!box)return;const rows=cart.map(i=>{const p=products.find(x=>x.id===i.id);return p?`<div class="cart-item"><div class="ci">${p.icon}</div><div><h4>${p.name}</h4><small>${money(p.price)}</small><div class="qty"><button onclick="change('${p.id}',-1)">−</button><span>${i.qty}</span><button onclick="change('${p.id}',1)">+</button></div></div><button class="small" onclick="remove('${p.id}')">حذف</button></div>`:""}).join("");box.innerHTML=rows||"<p style='text-align:center;padding:35px;color:#887f98'>السلة فارغة حاليًا 🛒</p>";const total=cart.reduce((s,i)=>{const p=products.find(x=>x.id===i.id);return s+(p?p.price*i.qty:0)},0);if($("#cartTotal"))$("#cartTotal").textContent=money(total)}
function openDrawer(){$("#drawer")?.classList.add("open");$("#overlay")?.classList.add("show")}
function closeDrawer(){$("#drawer")?.classList.remove("open");$("#overlay")?.classList.remove("show")}
function productCard(p){return `<article class="product"><a href="product.html?id=${encodeURIComponent(p.id)}"><div class="pimg">${p.icon}${p.featured?'<span class="tag">الأكثر طلبًا</span>':''}</div><h3>${p.name}</h3></a><div class="brand">${p.brand}</div><div class="price">${money(p.price)}</div><div class="rating">★★★★★ <span>(${p.rating})</span></div><button class="btn primary" onclick="add('${p.id}')">أضف للسلة 🛒</button></article>`}
function loadSocialLinks(){const c=window.MA_CONFIG||{};const wa=c.WHATSAPP_URL||(c.WHATSAPP_NUMBER&&c.WHATSAPP_NUMBER.indexOf('X')<0?`https://wa.me/${c.WHATSAPP_NUMBER}`:'#');const map={socialWhatsapp:wa,socialTelegram:c.TELEGRAM_URL,socialFacebook:c.FACEBOOK_URL,socialInstagram:c.INSTAGRAM_URL,communityWhatsapp:wa,communityTelegram:c.TELEGRAM_URL,communityFacebook:c.FACEBOOK_URL,communityInstagram:c.INSTAGRAM_URL};Object.entries(map).forEach(([id,url])=>{const el=document.getElementById(id);if(el&&url&&url!=="#")el.href=url;});}
document.addEventListener("DOMContentLoaded",async()=>{updateCartCount();loadSocialLinks();if($("#cartItems")){try{await getProducts();renderCart()}catch(e){console.error(e)}}$("#cartButton")?.addEventListener("click",openDrawer);$("#closeDrawer")?.addEventListener("click",closeDrawer);$("#overlay")?.addEventListener("click",closeDrawer);$("#searchInput")?.addEventListener("keydown",e=>{if(e.key==="Enter")location.href="shop.html?q="+encodeURIComponent(e.target.value)});$(".search button")?.addEventListener("click",()=>{const i=$("#searchInput");if(i)location.href="shop.html?q="+encodeURIComponent(i.value)});if($("#featuredGrid")){try{const d=await getProducts("?featured=1");$("#featuredGrid").innerHTML=d.products.map(productCard).join("")}catch(e){console.error(e)}}});
