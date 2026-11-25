/* Gift Haveli — front-end (clean URLs, product pages, box builder).
   Catalogue, orders and tracking go through the Apps Script backend (D.api). */
(() => {
  const D = window.GH, $ = (s, r = document) => r.querySelector(s), app = $("#app");
  const rs = n => "Rs " + Number(n).toLocaleString("en-PK");
  const icon = (k, cls = "") => `<svg viewBox="0 0 64 64" class="${cls}">${D.icons[k] || D.icons.box}</svg>`;
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const slug = t => String(t).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const catIcon = c => D.catIcons[c] || "box";
  const askWa = t => `https://wa.me/${D.whatsapp}?text=${encodeURIComponent(t)}`;
  const freeLine = () => D.freeAbove ? `Rs ${D.delivery} per order. Free on orders above ${rs(D.freeAbove)}.` : `Rs ${D.delivery} per order.`;
  const price = p => p && p.price ? rs(p.price) : "Rs 0000";
  const SITE = "https://gifthaveli.navifexpro.com";
  // image ref: "p/..." = file on this site, anything else = Drive file ID shared by link
  const src = (ref, w = 900) => !ref ? "" : /^(p|assets)\//.test(ref) ? "/" + ref : /^https?:/.test(ref) ? ref : `https://lh3.googleusercontent.com/d/${ref}=w${w}`;
  const mainImg = x => x && x.gallery && x.gallery[0] ? src(x.gallery[0]) : "";
  const pic = (x, ic, alt) => mainImg(x) ? `<img src="${mainImg(x)}" alt="${esc(alt || x.name)}" loading="lazy">` : icon(ic || "box");
  const store = {
    get() { try { return JSON.parse(localStorage.getItem("gh_cart") || "[]"); } catch (e) { return mem; } },
    set(v) { mem = v; try { localStorage.setItem("gh_cart", JSON.stringify(v)); } catch (e) {} updCount(); }
  };
  let mem = [];
  const updCount = () => { const c = $("#cartCount"); if (c) c.textContent = store.get().length; };
  const toast = t => { const el = $("#toast"); el.textContent = t; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2200); };
  const photos = {};   // cart photos live in memory only (too big for browser storage)
  let ready = false, loadErr = "";

  /* ---------- lookups ---------- */
  const all = () => [...D.products, ...D.boxes, ...D.fillers, ...D.addons];
  const byId = id => all().find(x => x.id === id);
  const pslug = p => slug(p.name) + (all().filter(x => slug(x.name) === slug(p.name)).length > 1 ? "-" + p.id.toLowerCase() : "");
  const pUrl = p => "/product/" + pslug(p);
  const rUrl = r => "/ready/" + slug(r.name);
  const bUrl = b => "/box/" + pslug(b);
  const readyList = () => (D.ready || []).filter(r => D.boxes.some(b => b.id === r.box));
  const rParts = r => r.items.map(byId).filter(Boolean);
  const rTotal = r => { const xs = [byId(r.box), ...rParts(r)]; return xs.every(x => x && x.price) ? xs.reduce((s, x) => s + x.price, 0) : 0; };
  const customLabel = c => ({ photo: "Add a photo", text: "Add a name", both: "Photo + name", none: "Ready to gift" })[c] || "Gift";
  const descFor = p => p.desc || ({
    photo: `Upload your photo and we print it on your ${p.name.toLowerCase()}. You will see a preview before you order.`,
    text: `Add a name or short message and we make your ${p.name.toLowerCase()} just for them. You will see a preview before you order.`,
    both: `Add a photo, a name or a short message and we make your ${p.name.toLowerCase()} just for them. You will see a preview before you order.`,
    none: `${p.name} from Gift Haveli, ready to gift.`
  })[p.custom] || "";

  /* ---------- page meta (title, description, canonical, JSON-LD) ---------- */
  function meta(title, desc, path, ld, img) {
    document.title = title;
    const set = (sel, attr, val, mk) => { let el = document.head.querySelector(sel); if (!el) { el = document.createElement(mk[0]); Object.entries(mk[1]).forEach(([k, v]) => el.setAttribute(k, v)); document.head.appendChild(el); } el.setAttribute(attr, val); };
    set('meta[name="description"]', "content", desc, ["meta", { name: "description" }]);
    set('link[rel="canonical"]', "href", SITE + path, ["link", { rel: "canonical" }]);
    set('meta[property="og:title"]', "content", title, ["meta", { property: "og:title" }]);
    set('meta[property="og:description"]', "content", desc, ["meta", { property: "og:description" }]);
    set('meta[property="og:url"]', "content", SITE + path, ["meta", { property: "og:url" }]);
    set('meta[property="og:image"]', "content", img ? (img.startsWith("http") ? img : SITE + img) : SITE + "/hero-hamper.jpg", ["meta", { property: "og:image" }]);
    let s = document.getElementById("ld-page");
    if (!s) { s = document.createElement("script"); s.type = "application/ld+json"; s.id = "ld-page"; document.head.appendChild(s); }
    s.textContent = ld ? JSON.stringify(ld) : "{}";
  }
  const crumbs = list => ({ "@type": "BreadcrumbList", itemListElement: list.map(([n, u], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: SITE + u })) });
  const productLd = (p, url) => ({ "@context": "https://schema.org", "@graph": [{
    "@type": "Product", name: p.name, sku: p.id, category: p.cat, description: descFor(p), image: (p.gallery || []).map(g => { const u = src(g); return u.startsWith("http") ? u : SITE + u; }),
    brand: { "@type": "Brand", name: "Gift Haveli" },
    ...(p.price ? { offers: { "@type": "Offer", priceCurrency: "PKR", price: p.price, availability: "https://schema.org/InStock", url: SITE + url } } : {})
  }, crumbs([["Home", "/"], ["Customize", "/customize"], ...(p.cat ? [[p.cat, "/category/" + slug(p.cat)]] : []), [p.name, url]])] });

  /* ---------- cards ---------- */
  const card = (p, tag) => `<a class="prod" href="${pUrl(p)}"><div class="ph">${pic(p, catIcon(p.cat))}</div><div class="in">
    <span class="tag">${esc(tag || p.cat || customLabel(p.custom))}</span><h3>${esc(p.name)}</h3><span class="price">${price(p)}</span>
    <span class="btn sm" style="margin-top:auto">${p.custom === "none" ? "View" : "Customize"}</span></div></a>`;
  const rCard = r => `<a class="prod" href="${rUrl(r)}"><div class="ph">${r.gallery && r.gallery[0] ? `<img src="${src(r.gallery[0])}" alt="${esc(r.name)} gift box" loading="lazy">` : boxSvg(byId(r.box), r.items)}</div><div class="in">
    <span class="tag">Ready-made box</span><h3>${esc(r.name)}</h3><p class="muted" style="font-size:.88rem;margin:0">${esc(rParts(r).map(x => x.name).join(", "))}</p>
    <span class="price">${rTotal(r) ? rs(rTotal(r)) : "Rs 0000"}</span><span class="btn sm" style="margin-top:auto">View box</span></div></a>`;
  const loading = () => `<p class="muted">${loadErr || "Loading…"}</p>`;

  /* ---------- box drawing (top view, items inside) ---------- */
  const boxColor = n => /red/i.test(n) ? "#8E1F35" : /white/i.test(n) ? "#EFE3CF" : /black/i.test(n) ? "#2B0F17" : /gold/i.test(n) ? "#B8913F" : /blue/i.test(n) ? "#2E4A7A" : "#6A1B2E";
  function boxSvg(box, items, text) {
    if (!box) return icon("box");
    const col = boxColor(box.name), heart = box.shape === "heart", n = items.length;
    const cols = n <= 4 ? 2 : 3, rows = Math.max(1, Math.ceil(n / cols)), W = 320, H = heart ? 230 : 210, x0 = 100, y0 = heart ? 95 : 75;
    const cw = W / cols, ch = Math.min(H / rows, cw);
    const tiles = items.map((id, i) => {
      const it = byId(id); if (!it) return "";
      const cx = x0 + cw * (i % cols) + cw / 2, cy = y0 + ch * Math.floor(i / cols) + ch / 2 + (H - ch * rows) / 2, r = Math.min(cw, ch) / 2 - 8;
      const im = mainImg(it);
      return `<g class="item-pop"><clipPath id="c${i}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="#FAF3E7" stroke="#C9A24B" stroke-width="2"/>
        ${im ? `<image href="${im}" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c${i})"/>` : `<g transform="translate(${cx - 18} ${cy - 18}) scale(.56)" fill="none" stroke="#6A1B2E" stroke-width="3">${D.icons[it.icon || catIcon(it.cat)] || D.icons.box}</g>`}</g>`;
    }).join("");
    const shape = heart
      ? `<path d="M260 345 C95 255 60 120 160 80 C215 60 250 95 260 125 C270 95 305 60 360 80 C460 120 425 255 260 345Z" fill="${col}" stroke="#C9A24B" stroke-width="3"/><path d="M260 325 C120 245 92 135 165 102 C212 84 246 112 260 145 C274 112 308 84 355 102 C428 135 400 245 260 325Z" fill="rgba(0,0,0,.18)"/>`
      : `<rect x="70" y="45" width="380" height="270" rx="16" fill="${col}" stroke="#C9A24B" stroke-width="3"/><rect x="86" y="61" width="348" height="238" rx="10" fill="rgba(0,0,0,.2)"/><path d="M86 61 L434 61" stroke="rgba(255,255,255,.15)"/>`;
    const paper = heart ? "" : Array.from({ length: 18 }, (_, i) => `<path d="M${96 + (i * 37) % 330} ${70 + (i * 53) % 220} q8 -6 16 0 t16 0" stroke="#E9C9C3" stroke-width="2" fill="none" opacity=".35"/>`).join("");
    return `<svg viewBox="0 0 520 380" role="img" aria-label="${esc(box.name)} with ${n} items">${shape}${paper}${tiles}
      ${text ? `<text x="260" y="370" text-anchor="middle" font-family="Fraunces" font-style="italic" font-size="22" fill="#C9A24B">${esc(text)}</text>` : ""}</svg>`;
  }

  /* ---------- pages ---------- */
  const pages = {
    "/": () => {
      meta("Gift Haveli — Personalised Gifts & Gift Boxes, Delivered All Over Pakistan",
        "Ready-made gift boxes, build your own gift box, and customized mugs, frames, lamps and Nikkah gifts. Delivery anywhere in Pakistan — overseas Pakistanis welcome.", "/",
        { "@context": "https://schema.org", "@type": "WebSite", name: "Gift Haveli", url: SITE + "/" });
      const featured = D.products.filter(p => /hamper|box|bouquet|basket/i.test(p.cat));
      return `
      <section class="hero"><div class="hero-bg"></div>
        <div class="wrap">
          <p class="eyebrow fade-up">Customized gifts · Delivery all over Pakistan</p>
          <h1 class="fade-up d1">Gifts that feel like home.</h1>
          <p class="fade-up d2">Choose a box, fill it with things they love, add a name, a photo or a few words — and we deliver it to their door, anywhere in Pakistan.</p>
          <div class="actions fade-up d3"><a class="btn gold" href="/build">Build your gift box</a><a class="btn ghost" href="/customize">Customize a gift</a></div>
        </div>
      </section>
      <section class="block"><div class="wrap">
        <div class="two-cats">
          <a class="big-cat" href="/boxes"><img src="/hero-hamper.jpg" alt="Premium gift box with gold ribbon" loading="lazy"><span><b>Gift Boxes</b><small>Ready-made boxes, or make your own</small></span></a>
          <a class="big-cat" href="/customize"><img src="/p/g/GH-062-5.jpg" alt="Customized 3D illusion lamp with a name" loading="lazy" style="object-position:center 15%"><span><b>Customized Gifts</b><small>Add a name, a photo or a few words</small></span></a>
        </div>
      </div></section>
      <section class="block" style="padding-top:0"><div class="wrap">
        <p class="eyebrow">Gift boxes</p><h2>Ready-made gift boxes</h2>
        <p class="muted" style="max-width:60ch">Complete gift boxes, already put together. Nothing to choose — just order and we deliver. Or build your own box.</p>
        <div class="grid prods" style="margin-top:26px">${ready || D.products.length ? readyList().map(rCard).join("") : loading()}</div>
        <p style="margin-top:22px"><a class="btn" href="/build">Build your own box</a></p>
      </div></section>
      <section class="block" style="padding-top:0"><div class="wrap split">
        <img src="/hero-bouquet.jpg" alt="Red rose and chocolate bouquet wrapped in maroon and cream paper" loading="lazy">
        <div><p class="eyebrow">Build a box</p><h2>Make it entirely theirs</h2>
          <ol class="steps"><li><div><b>Pick a box</b><br><span class="muted">Heart, square, suit or cube.</span></div></li>
          <li><div><b>Fill it</b><br><span class="muted">Eatables, flowers, perfumes and customized items.</span></div></li>
          <li><div><b>Make it personal</b><br><span class="muted">A name, a photo, a message card.</span></div></li>
          <li><div><b>We deliver</b><br><span class="muted">Anywhere in Pakistan.</span></div></li></ol>
          <a class="btn" href="/build">Start building</a></div>
      </div></section>
      <section class="block band"><div class="wrap">
        <p class="eyebrow">From anywhere to home</p><h2>Far from family? We'll take it home for you.</h2>
        <p style="max-width:60ch">Living in the UK, USA, Gulf or anywhere else — order online and we deliver your gift to your loved ones in Pakistan, with your message inside.</p>
        <div class="grid three" style="margin-top:28px">
          <div class="card"><h3>Delivery all over Pakistan</h3><p>${freeLine()}</p></div>
          <div class="card"><h3>Keep it a surprise</h3><p>Tick "keep sender secret" and we won't reveal who sent it.</p></div>
          <div class="card"><h3>Track every step</h3><p>Use your Order ID to see when it's made, shipped and delivered.</p></div>
        </div></div></section>
`;
    },

    "/customize": (q, rest) => {
      const cat = rest[0] || "all", c = D.categories.find(x => x.id === cat);
      const list = D.products.filter(p => cat === "all" || slug(p.cat) === cat);
      const name = c ? c.name : "Customized gifts";
      meta(c ? `${c.name} — Customized ${c.name} in Pakistan | Gift Haveli` : "Customized Gifts in Pakistan — Mugs, Frames, Lamps & More | Gift Haveli",
        c ? `Customized ${c.name.toLowerCase()} with your name or photo. See a preview before you order. Delivery all over Pakistan.` : "Customized mugs, frames, lamps, cushions, jewellery, Nikkah items and more. Add a name or photo, see a preview, and we deliver all over Pakistan.",
        c ? "/category/" + cat : "/customize", { "@context": "https://schema.org", "@graph": [{ "@type": "CollectionPage", name }, crumbs([["Home", "/"], ["Customize", "/customize"], ...(c ? [[c.name, "/category/" + cat]] : [])])] });
      return `<section class="page-head"><div class="wrap"><p class="eyebrow">Customize</p><h1>${esc(name)}</h1>${ready ? "" : `<p class="note">${loadErr || "Loading gifts…"}</p>`}</div></section>
      <section style="padding-bottom:70px"><div class="wrap">
        <nav class="tabs" aria-label="Categories"><a class="tab ${cat === "all" ? "on" : ""}" href="/customize">All</a>${D.categories.map(x => `<a class="tab ${cat === x.id ? "on" : ""}" href="/category/${x.id}">${esc(x.name)}</a>`).join("")}</nav>
        <div class="grid prods">${list.map(p => card(p)).join("")}</div>
      </div></section>`;
    },

    "/product": (q, rest) => {
      const p = all().find(x => pslug(x) === rest[0]);
      if (!p) return ready ? notFound() : `<section class="page-head"><div class="wrap">${loading()}</div></section>`;
      const url = pUrl(p);
      meta(`${p.name}${p.custom !== "none" ? " — Customized" : ""} | Gift Haveli Pakistan`, descFor(p).slice(0, 155), url, productLd(p, url), mainImg(p));
      const g = (p.gallery || []).length ? p.gallery : [];
      const custom = p.custom !== "none";
      return `<section class="pdp"><div class="wrap">
        <nav class="crumbs"><a href="/">Home</a> / <a href="/customize">Customize</a>${p.cat && D.categories.some(c => c.name === p.cat) ? ` / <a href="/category/${slug(p.cat)}">${esc(p.cat)}</a>` : ""}</nav>
        <div class="pdp-grid">
          <div class="gal">
            <div class="gal-main">${g.length ? `<img id="galMain" src="${src(g[0], 1200)}" alt="${esc(p.name)}">` : icon(catIcon(p.cat), "big")}</div>
            ${g.length > 1 ? `<div class="gal-thumbs">${g.map((x, i) => `<button class="${i ? "" : "on"}" data-g="${esc(src(x, 1200))}" aria-label="Photo ${i + 1}"><img src="${src(x, 300)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
          </div>
          <div class="pdp-info">
            <span class="tag">${esc(p.cat || "")}</span><h1>${esc(p.name)}</h1>
            <p class="price big">${price(p)}</p>
            ${p.size ? `<p class="muted">Size: ${esc(p.size)} inches</p>` : ""}
            <p>${esc(descFor(p))}</p>
            ${custom ? `<div class="custom card">
              <h3>Customize it</h3>
              ${p.custom === "photo" || p.custom === "both" ? `<div class="field"><label for="ph">Upload a photo</label><input type="file" id="ph" accept="image/*"><span class="warn" id="pw"></span></div>` : ""}
              ${p.custom === "text" || p.custom === "both" ? `<div class="field"><label for="tx">Name or short text</label><input id="tx" maxlength="30" placeholder="e.g. Ayesha"></div>` : ""}
              <p class="eyebrow" style="margin:6px 0">Your preview</p>
              <canvas id="cv" width="800" height="800" aria-label="Preview of your customized ${esc(p.name)}"></canvas>
              <p class="muted" style="font-size:.82rem;margin-top:6px">Preview only. The Gift Haveli mark is not printed on your gift.</p></div>` : ""}
            <div class="actions" style="margin-top:16px"><button class="btn" id="addP">Add to basket</button>
              <a class="btn ghost" target="_blank" rel="noopener" id="waP" href="${askWa(`Assalam o Alaikum, I want to order ${p.name} (${p.id}).`)}">Order on WhatsApp</a></div>
            <ul class="perks"><li>Delivery all over Pakistan</li><li>Overseas orders welcome</li><li>Preview before you order</li></ul>
          </div></div>
        ${related(p)}
      </div></section>`;
    },

    "/ready": (q, rest) => {
      if (!rest[0]) {
        meta("Ready-Made Gift Boxes — Delivered All Over Pakistan | Gift Haveli", "Complete gift boxes, already put together. Pick one and we deliver it anywhere in Pakistan.", "/boxes",
          { "@context": "https://schema.org", "@graph": [crumbs([["Home", "/"], ["Ready-made boxes", "/boxes"]])] });
        return `<section class="page-head"><div class="wrap"><p class="eyebrow">Ready-made boxes</p><h1>Ready-made gift boxes</h1><p class="muted">Complete gift boxes, already put together. Nothing to choose — just order and we deliver.</p></div></section>
        <section style="padding-bottom:70px"><div class="wrap"><div class="grid prods">${readyList().length ? readyList().map(rCard).join("") : loading()}</div>
        <p style="margin-top:26px"><a class="btn" href="/build">Or make your own box</a></p></div></section>`;
      }
      const r = readyList().find(x => slug(x.name) === rest[0]);
      if (!r) return ready ? notFound() : `<section class="page-head"><div class="wrap">${loading()}</div></section>`;
      const box = byId(r.box), parts = rParts(r), url = rUrl(r), t = rTotal(r);
      meta(`${r.name} Gift Box — Ready-Made Gift | Gift Haveli Pakistan`, (r.desc || `${r.name} gift box with ${parts.map(x => x.name).join(", ")}.`).slice(0, 155), url,
        { "@context": "https://schema.org", "@graph": [{ "@type": "Product", name: r.name + " Gift Box", sku: r.id, description: r.desc, brand: { "@type": "Brand", name: "Gift Haveli" }, image: (r.gallery || []).map(g => SITE + src(g)) }, crumbs([["Home", "/"], ["Ready-made boxes", "/boxes"], [r.name, url]])] }, r.gallery && r.gallery[0] ? src(r.gallery[0]) : "");
      const g = r.gallery || [];
      return `<section class="pdp"><div class="wrap"><nav class="crumbs"><a href="/">Home</a> / <a href="/boxes">Ready-made boxes</a></nav>
        <div class="pdp-grid">
          <div class="gal"><div class="gal-main">${g.length ? `<img id="galMain" src="${src(g[0], 1200)}" alt="${esc(r.name)} gift box with items inside">` : boxSvg(box, r.items)}</div>
            <div class="gal-thumbs">${g.map((x, i) => `<button class="${i ? "" : "on"}" data-g="${esc(src(x, 1200))}"><img src="${src(x, 300)}" alt="" loading="lazy"></button>`).join("")}</div></div>
          <div class="pdp-info"><span class="tag">Ready-made box</span><h1>${esc(r.name)}</h1><p class="price big">${t ? rs(t) : "Rs 0000"}</p>
            <p>${esc(r.desc || "")}</p>
            <h3 style="margin-top:18px">What's inside</h3>
            <div class="inside">${[box, ...parts].map(x => `<a href="${pUrl(x)}">${pic(x, x.icon || catIcon(x.cat))}<span>${esc(x.name)}</span></a>`).join("")}</div>
            <div class="field" style="margin-top:14px"><label for="rbText">Message for the card (optional)</label><input id="rbText" maxlength="60" placeholder="e.g. Happy Birthday Ammi"></div>
            <div class="actions"><button class="btn" id="addR" data-r="${esc(r.id)}">Add to basket</button><a class="btn ghost" href="/box/${pslug(box)}?from=${esc(r.id)}">Change items</a></div>
          </div></div></div></section>`;
    },

    "/build": (q, rest) => {
      if (!rest[0]) {
        meta("Make Your Own Gift Box — Customized Gift Boxes in Pakistan | Gift Haveli", "Pick a gift box, fill it with chocolates, flowers, perfumes and customized items, add a message, and we deliver all over Pakistan.", "/build",
          { "@context": "https://schema.org", "@graph": [crumbs([["Home", "/"], ["Build a box", "/build"]])] });
        return `<section class="page-head"><div class="wrap"><p class="eyebrow">Make your box · Step 1</p><h1>Choose your box</h1><p class="muted">Pick a box. Next, you fill it with the things they love.</p></div></section>
        <section style="padding-bottom:70px"><div class="wrap"><div class="grid prods">${D.boxes.length ? D.boxes.map(b => `<a class="prod" href="${bUrl(b)}"><div class="ph">${pic(b, "box")}</div><div class="in"><span class="tag">${esc(b.size ? b.size + " in" : "Gift box")} · up to ${b.slots} items</span><h3>${esc(b.name)}</h3><span class="price">${price(b)}</span><span class="btn sm" style="margin-top:auto">Choose this box</span></div></a>`).join("") : loading()}</div></div></section>`;
      }
      const box = D.boxes.find(b => pslug(b) === rest[0]);
      if (!box) return ready ? notFound() : `<section class="page-head"><div class="wrap">${loading()}</div></section>`;
      meta(`${box.name} — Build Your Gift Box | Gift Haveli`, `Fill the ${box.name} with chocolates, flowers, perfumes and customized gifts. Delivery all over Pakistan.`, bUrl(box),
        { "@context": "https://schema.org", "@graph": [crumbs([["Home", "/"], ["Build a box", "/build"], [box.name, bUrl(box)]])] });
      return `<section class="page-head" style="padding-bottom:6px"><div class="wrap"><nav class="crumbs"><a href="/build">Build a box</a> / Step 2</nav><h1>Fill your ${esc(box.name)}</h1></div></section>
      <section style="padding-bottom:70px"><div class="wrap bb">
        <div class="stage" id="stage"></div>
        <div class="bb-cats" id="bbCats"><p class="eyebrow">Categories</p>${boxCats().map((c, i) => `<button class="bb-cat${i ? "" : " on"}" data-cat="${esc(c)}">${icon(catIcon(c) === "box" ? ({ Eatables: "star", Flowers: "flower", Perfumes: "lamp", "Customized Items": "frame", "Extras": "balloon" })[c] || "box" : catIcon(c))}<span>${esc(c)}</span></button>`).join("")}</div>
        <div class="bb-items" id="bbItems"></div>
        <div class="bb-foot"><div class="field"><label for="boxText">Name or message for the box (optional)</label><input id="boxText" maxlength="40" placeholder="e.g. Happy Birthday Ammi"></div>
          <button class="btn" id="addBox">Add box to basket</button></div>
      </div></section>`;
    },

    "/finder": () => {
      meta("Gift Finder — Gift Ideas for Every Occasion | Gift Haveli", "Not sure what to gift? Pick the occasion, who it is for and your budget, and get customized gift ideas. Delivery all over Pakistan.", "/finder");
      return `<section class="page-head"><div class="wrap"><p class="eyebrow">Gift Finder</p><h1>Find the right gift</h1><p class="muted">Answer three quick questions.</p></div></section>
      <section style="padding-bottom:70px"><div class="wrap two grid">
        <form class="card" id="finder">
          <div class="field"><label>Occasion</label><div class="chips" data-g="occ">${["Birthday", "Anniversary", "Eid", "Nikkah / Wedding", "Thank you", "Just because"].map(x => `<button type="button" class="chip">${x}</button>`).join("")}</div></div>
          <div class="field"><label>Who is it for?</label><div class="chips" data-g="rel">${["Wife", "Husband", "Mother", "Father", "Sister", "Brother", "Friend", "Child", "Boss / Client"].map(x => `<button type="button" class="chip">${x}</button>`).join("")}</div></div>
          <div class="field"><label for="budget">Budget</label><select id="budget"><option value="2000">Up to Rs 2,000</option><option value="4000">Rs 2,000 – 4,000</option><option value="8000" selected>Rs 4,000 – 8,000</option><option value="99999">Above Rs 8,000</option></select></div>
          <button class="btn">Show gift ideas</button>
        </form>
        <div id="ideas"></div></div></section>`;
    },

    "/cart": () => {
      meta("Your Basket | Gift Haveli", "Your Gift Haveli basket.", "/cart");
      const c = store.get(), sub = c.reduce((s, i) => s + (i.price || 0), 0), tbc = c.some(i => !i.price), del = !c.length || (D.freeAbove && sub >= D.freeAbove) ? 0 : D.delivery;
      return `<section class="page-head"><div class="wrap"><p class="eyebrow">Your basket</p><h1>Almost there</h1></div></section>
      <section style="padding-bottom:70px"><div class="wrap grid two">
        <div>${c.length ? c.map((i, n) => `<div class="line"><div><b>${esc(i.name)}</b><br><small class="muted">${esc(i.detail || "")}${i.hasPhoto && !photos[i.uid] ? ` <span class="warn">Photo lost after page reload — remove and add again.</span>` : ""}</small></div><div>${i.price ? rs(i.price) : "Rs 0000"} <button class="btn sm ghost" data-del="${n}">Remove</button></div></div>`).join("") : `<p class="muted">Your basket is empty. <a href="/customize">Find a gift</a>.</p>`}
          ${c.length ? `<form id="order" class="card" style="margin-top:26px">
            <h3>Sender</h3>
            <div class="field"><label>Your name</label><input name="senderName" required></div>
            <div class="field"><label>Your WhatsApp number</label><input name="senderPhone" required inputmode="tel" placeholder="+44… or 03…"></div>
            <div class="field"><label>Your country</label><input name="country" placeholder="Pakistan, UK, UAE…"></div>
            <h3 style="margin-top:10px">Receiver (in Pakistan)</h3>
            <div class="field"><label>Receiver name</label><input name="recName" required></div>
            <div class="field"><label>Receiver phone</label><input name="recPhone" required></div>
            <div class="field"><label>City</label><input name="city" required></div>
            <div class="field"><label>Full address</label><textarea name="address" rows="2" required></textarea></div>
            <div class="field"><label>Delivery date</label><input type="date" name="date" required></div>
            <div class="field"><label>Occasion</label><select name="occasion"><option>Birthday</option><option>Anniversary</option><option>Eid</option><option>Nikkah / Wedding</option><option>Thank you</option><option>Other</option></select></div>
            <div class="field"><label>Gift message card</label><textarea name="message" rows="2" maxlength="200"></textarea></div>
            <label class="check"><input type="checkbox" name="secret"> Keep sender secret (receiver won't be told who sent it)</label>
            <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
            <button class="btn" id="placeBtn" style="margin-top:16px">Place order</button><p class="warn" id="orderErr"></p></form>` : ""}
        </div>
        <aside class="sum"><div class="row"><span>Items</span><span>${tbc ? (sub ? rs(sub) + " + to confirm" : "To confirm") : rs(sub)}</span></div>
          <div class="row"><span>Delivery</span><span>${del ? rs(del) : (c.length ? "Free" : "—")}</span></div>
          <hr style="border:0;border-top:1px solid rgba(106,27,46,.15)"><div class="row"><span>Total</span><span class="grand">${tbc ? "To confirm" : rs(sub + del)}</span></div>
          ${tbc ? `<p class="muted" style="font-size:.85rem">Some prices will be confirmed on WhatsApp after you place the order.</p>` : ""}</aside>
      </div></section>`;
    },

    "/thanks": q => { meta("Thank you | Gift Haveli", "Order received.", "/thanks");
      return `<section class="block"><div class="wrap" style="text-align:center;max-width:640px">
      <p class="eyebrow">Order received</p><h1>Thank you!</h1><p>Your Order ID is</p><h2>${esc(q.get("id"))}</h2>
      <p class="muted">We're opening WhatsApp so you can send us your order. Keep this ID to track your gift.</p>
      <a class="btn" href="${esc(lastWa || ("https://wa.me/" + D.whatsapp))}" target="_blank" rel="noopener">Open WhatsApp</a></div></section>`; },

    "/track": () => { meta("Track Your Order | Gift Haveli", "Track your Gift Haveli order with your Order ID.", "/track");
      return `<section class="page-head"><div class="wrap"><p class="eyebrow">Track order</p><h1>Where is my gift?</h1></div></section>
      <section style="padding-bottom:80px"><div class="wrap" style="max-width:560px"><form class="card" id="track">
      <div class="field"><label for="tid">Order ID</label><input id="tid" placeholder="GH-2611-0001" required></div>
      <div class="field"><label for="tph">Last 4 digits of your WhatsApp number</label><input id="tph" inputmode="numeric" maxlength="4" required></div><button class="btn">Check status</button><div id="tres" style="margin-top:18px"></div></form></div></section>`; },

    "/corporate": () => { meta("Corporate Gifts in Pakistan — Eid Hampers, Branded Mugs & Awards | Gift Haveli", "Corporate and bulk gifts: Eid hampers for staff, client gifts with your logo, shields and awards. Delivered to many addresses across Pakistan.", "/corporate");
      return `<section class="page-head"><div class="wrap"><p class="eyebrow">Corporate gifting</p><h1>Gifts your team and clients remember</h1></div></section>
      <section style="padding-bottom:80px"><div class="wrap split"><img src="/hero-hamper.jpg" alt="Premium cream gift hamper with gold ribbon" style="aspect-ratio:4/3">
      <div><ul class="steps"><li>Eid and festive hampers for staff</li><li>Client gifts with your logo on mugs, pens and boxes</li><li>Wooden shields and awards</li><li>Delivery to many addresses across Pakistan</li></ul>
      <a class="btn" href="${askWa("Assalam o Alaikum, I want to discuss corporate / bulk gifts.")}" target="_blank" rel="noopener">Talk to us on WhatsApp</a></div></div></section>`; },

    "/faq": () => {
      const qa = [["Where do you deliver?", "All over Pakistan."], ["How much is delivery?", freeLine()], ["I live abroad. Can I order?", "Yes. Order here and we deliver to your family in Pakistan."],
        ["Are the flowers real?", "We use high-quality artificial flowers, so they stay beautiful."], ["How do I add a photo?", "Open a product, upload your photo in the Customize box and see your preview before you add it to the basket."]];
      meta("Questions — Delivery, Overseas Orders & Customization | Gift Haveli", "Answers about delivery across Pakistan, ordering from abroad, artificial flowers and adding your photo to a gift.", "/faq",
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
      return `<section class="page-head"><div class="wrap"><p class="eyebrow">Questions</p><h1>Good to know</h1></div></section>
      <section style="padding-bottom:80px"><div class="wrap" style="max-width:760px">${qa.map(([q, a]) => `<details class="card" style="margin-bottom:12px"><summary><b>${q}</b></summary><p style="margin-top:10px">${a}</p></details>`).join("")}</div></section>`;
    }
  };

  /* ---------- info & policy pages ---------- */
  const infoPage = (key, eyebrow, title, desc, body) => { pages[key] = () => { meta(title + " | Gift Haveli", desc, key, { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", name: title }, crumbs([["Home", "/"], [title, key]])] });
    return `<section class="page-head"><div class="wrap"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div></section><section style="padding-bottom:80px"><div class="wrap prose">${body()}</div></section>`; }; };
  const wa = () => `<a href="https://wa.me/${D.whatsapp}" target="_blank" rel="noopener">WhatsApp 0313-0111349</a>`;
  const mail = `<a href="mailto:thegifthaveli@gmail.com">thegifthaveli@gmail.com</a>`;
  const updated = `<p class="muted" style="font-size:.85rem">Last updated: 22 November 2026</p>`;
  infoPage("/about", "Our story", "About Gift Haveli", "Gift Haveli makes customized gifts, gift boxes, hampers and bouquets in Lahore and delivers them all over Pakistan.", () => `
    <p>Gift Haveli is a Lahore-based gift shop. We make customized gifts — gift boxes, hampers, chocolate bouquets, printed mugs, photo frames, lamps, jewellery and Nikkah keepsakes — and deliver them all over Pakistan.</p>
    <p>Every gift is made for one person. You choose the gift, add a name, a photo or a message, and we put it together by hand.</p>
    <p>Many of our customers live abroad. You can order here from anywhere and we deliver your gift to your family in Pakistan, with your message inside.</p>
    <h2>Talk to us</h2><p>${wa()} · ${mail}</p>`);
  infoPage("/contact", "Contact", "Contact Us", "Contact Gift Haveli on WhatsApp 0313-0111349 or email thegifthaveli@gmail.com for orders, bulk and corporate gifts.", () => `
    <div class="grid two" style="gap:20px"><div class="card"><h3>WhatsApp</h3><p>The fastest way to reach us for orders, prices and order updates.</p><p>${wa()}</p></div>
    <div class="card"><h3>Email</h3><p>For corporate and bulk orders, or anything else.</p><p>${mail}</p></div></div>
    <p style="margin-top:20px">Based in Lahore · Delivery all over Pakistan.</p>`);
  infoPage("/shipping-policy", "Policies", "Shipping & Delivery Policy", "Gift Haveli delivers all over Pakistan. Delivery charges, delivery dates and order tracking explained.", () => `${updated}
    <h2>Where we deliver</h2><p>We deliver all over Pakistan. We do not deliver outside Pakistan, but you can order from anywhere in the world for someone in Pakistan.</p>
    <h2>Delivery charges</h2><p>Delivery is ${freeLine()} The delivery charge is shown in your basket before you place the order.</p>
    <h2>Delivery date</h2><p>Every gift is made to order. You choose a delivery date when you order. We confirm the date with you on WhatsApp after we check your order. If we cannot make it on that date, we will tell you before we start.</p>
    <h2>Tracking</h2><p>You get an Order ID when you place your order. Use it on the <a href="/track">Track Order</a> page to see when your gift is confirmed, being made, shipped and delivered.</p>
    <h2>Wrong address</h2><p>Please check the receiver's name, phone number and address. If the address is wrong or the receiver cannot be reached, delivery may be late and extra delivery charges may apply.</p>
    <h2>Questions</h2><p>${wa()} · ${mail}</p>`);
  infoPage("/refund-policy", "Policies", "Returns & Refund Policy", "Gift Haveli returns and refund policy for customized and ready-made gifts.", () => `${updated}
    <h2>Customized gifts</h2><p>Customized gifts are made only for you, with your name, photo or message. Because of this, we cannot take them back or refund them if you change your mind.</p>
    <h2>Damaged or wrong item</h2><p>If your gift arrives damaged, or it is not what you ordered, message us on ${wa()} as soon as you receive it, with photos of the gift and the packaging. We will check it and remake the item or give you a refund for that item.</p>
    <h2>Mistakes in your details</h2><p>We print exactly the name, text and photo you send. Please check spelling and photo quality before you order. We cannot remake a gift for free if the mistake was in the details sent to us.</p>
    <h2>Cancelling an order</h2><p>You can cancel before we start making your gift. Once we have started, we cannot cancel a customized order.</p>
    <h2>How refunds are paid</h2><p>If a refund is approved, we send it back the same way you paid, or by bank transfer. We will confirm the details with you on WhatsApp.</p>`);
  infoPage("/privacy-policy", "Policies", "Privacy Policy", "How Gift Haveli collects, uses and protects your personal information and photos.", () => `${updated}
    <h2>What we collect</h2><p>When you order, we collect your name, WhatsApp number and country, the receiver's name, phone number and address, the delivery date, your gift message, and any photo or text you add to a customized gift.</p>
    <h2>How we use it</h2><p>We use this information only to make, deliver and support your order, and to talk to you about it on WhatsApp. We do not sell your information.</p>
    <h2>Your photos</h2><p>Photos you upload are saved privately with your order so we can make your gift. We do not post your photos or your gift on our social media without your permission.</p>
    <h2>Who we share it with</h2><p>We share the receiver's name, phone number and address only with the delivery company, so they can deliver the gift.</p>
    <h2>Keeping it safe</h2><p>Order details are kept in our private order records. Only the Gift Haveli team can see them.</p>
    <h2>Your basket</h2><p>Your basket is saved in your own browser so it is still there when you come back. We do not use advertising cookies on this website.</p>
    <h2>Your choices</h2><p>You can ask us to show, correct or delete your information at any time: ${wa()} · ${mail}</p>`);
  infoPage("/terms", "Policies", "Terms & Conditions", "Terms for ordering customized gifts from Gift Haveli.", () => `${updated}
    <h2>Orders</h2><p>When you place an order, we confirm it with you on WhatsApp. Your order is final once we confirm it with you.</p>
    <h2>Prices</h2><p>Prices are in Pakistani Rupees (PKR). If a product shows Rs 0000, its price is not set yet and we will tell you the price on WhatsApp before we confirm your order.</p>
    <h2>Your content</h2><p>You must have the right to use any photo, name or text you send us. We do not print content that is hateful, offensive or that copies someone else's brand or artwork.</p>
    <h2>Product photos</h2><p>Photos on this website show examples. Every gift is handmade, so colours, flowers and packaging may look a little different.</p>
    <h2>Flowers</h2><p>We use high-quality artificial flowers so your gift stays beautiful.</p>
    <h2>Delivery, returns and privacy</h2><p>See our <a href="/shipping-policy">Shipping & Delivery Policy</a>, <a href="/refund-policy">Returns & Refund Policy</a> and <a href="/privacy-policy">Privacy Policy</a>.</p>
    <h2>Contact</h2><p>${wa()} · ${mail}</p>`);
  pages["/category"] = pages["/customize"]; pages["/boxes"] = q => pages["/ready"](q, []); pages["/box"] = (q, rest) => rest[0] ? pages["/build"](q, rest) : notFound();
  const notFound = () => { meta("Page not found | Gift Haveli", "This page could not be found.", location.pathname); return `<section class="block"><div class="wrap" style="text-align:center"><h1>We couldn't find that page</h1><p class="muted">It may have moved.</p><a class="btn" href="/">Go to home</a></div></section>`; };
  const related = p => { const r = D.products.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
    return r.length ? `<div style="margin-top:56px"><h2>More ${esc(p.cat || "gifts")}</h2><div class="grid prods" style="margin-top:18px">${r.map(x => card(x)).join("")}</div></div>` : ""; };
  const boxCats = () => [...new Set([...D.fillers.map(f => f.cat || "Other"), ...(D.addons.length ? ["Extras"] : [])])];

  /* ---------- router (clean URLs) ---------- */
  function route(push) {
    let path = location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "").replace(/\/+$/, "") || "/";
    const moved = { "/finder": "/customize", "/corporate": "/customize" };
    if (moved[path]) { history.replaceState(null, "", moved[path]); path = moved[path]; }
    const q = new URLSearchParams(location.search), parts = path.split("/").filter(Boolean);
    const key = parts.length ? "/" + parts[0] : "/", rest = parts.slice(1);
    app.innerHTML = (pages[key] || notFound)(q, rest);
    document.querySelectorAll(".links a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === key || (key === "/category" && a.getAttribute("href") === "/customize") || (key === "/box" && a.getAttribute("href") === "/build") || ((key === "/ready" || key === "/boxes") && a.getAttribute("href") === "/boxes")));
    $("#links").classList.remove("open");
    if (push !== false) window.scrollTo(0, 0);
    if (key === "/box" && rest[0]) initBuilder(q.get("from"));
    if (key === "/product") initProduct(rest[0]);
    bind();
  }
  // in-site links change the page without reloading
  document.addEventListener("click", e => {
    const a = e.target.closest("a"); if (!a || a.target || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const href = a.getAttribute("href"); if (!href || !href.startsWith("/") || href.startsWith("//") || /\.(pdf|jpg|png|xml|txt)$/.test(href)) return;
    e.preventDefault(); history.pushState(null, "", href); route();
  });
  window.addEventListener("popstate", () => route(false));
  const go = u => { history.pushState(null, "", u); route(); };

  /* ---------- product page: gallery + live preview ---------- */
  function initProduct(s) {
    const p = all().find(x => pslug(x) === s); if (!p) return;
    document.querySelectorAll(".gal-thumbs button").forEach(b => b.onclick = () => { $("#galMain").src = b.dataset.g; document.querySelectorAll(".gal-thumbs button").forEach(x => x.classList.toggle("on", x === b)); });
    const cv = $("#cv"); let img = null, photo = null;
    const getT = () => (($("#tx") || {}).value || "").trim();
    const draw = () => cv && drawMock(cv, p, img, getT());
    if (cv) { draw(); document.fonts && document.fonts.ready.then(draw); }
    const tx = $("#tx"); if (tx) tx.oninput = () => { draw(); waLink(); };
    const ph = $("#ph");
    if (ph) ph.onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { const i = new Image(); i.onload = () => { img = i; photo = shrink(i); $("#pw").textContent = (i.width < 800 || i.height < 800) ? "This photo is small and may print blurry. A bigger photo will look better." : ""; draw(); }; i.src = r.result; };
      r.readAsDataURL(f);
    };
    const waLink = () => { const w = $("#waP"); if (w) w.href = askWa(`Assalam o Alaikum, I want to order ${p.name} (${p.id}).${getT() ? `\nText: ${getT()}` : ""}${photo ? "\nI will send my photo here." : ""}`); };
    $("#addP").onclick = () => {
      const t = getT();
      if (p.custom === "photo" && !photo) return toast("Please upload a photo first");
      if (p.custom === "text" && !t) return toast("Please type the name or text first");
      const type = D.products.includes(p) ? "product" : "item";
      addCart({ type, id: p.id, name: p.name, price: p.price, text: t, detail: [t && `Text: ${t}`, photo && "Photo added"].filter(Boolean).join(" · ") }, photo);
    };
  }

  /* product mock-ups for the preview (drawn, so every product gets one) */
  function drawMock(cv, p, img, t) {
    const x = cv.getContext("2d"), W = 800, kind = mockKind(p);
    x.clearRect(0, 0, W, W); const g = x.createRadialGradient(400, 360, 50, 400, 400, 560); g.addColorStop(0, "#fbf4e8"); g.addColorStop(1, "#ecdcc4"); x.fillStyle = g; x.fillRect(0, 0, W, W);
    const fit = (X, Y, w, h, r) => { x.save(); x.beginPath(); x.roundRect(X, Y, w, h, r || 0); x.clip();
      if (img) { const s = Math.max(w / img.width, h / img.height); x.drawImage(img, X + w / 2 - img.width * s / 2, Y + h / 2 - img.height * s / 2, img.width * s, img.height * s); }
      else { x.fillStyle = "#f3e6d3"; x.fillRect(X, Y, w, h); x.fillStyle = "#b69a6b"; x.font = "500 26px 'DM Sans'"; x.textAlign = "center"; x.fillText(p.custom === "text" ? "" : "Your photo", X + w / 2, Y + h / 2 + 8); }
      x.restore(); };
    const text = (s, X, Y, size, col, font) => { if (!s) return; x.fillStyle = col || "#6A1B2E"; x.textAlign = "center"; x.font = font || `italic 600 ${size}px Fraunces, serif`; x.fillText(s, X, Y); };
    const T = t || (p.custom === "photo" ? "" : "Your name");
    const shadow = () => { x.shadowColor = "rgba(43,15,23,.25)"; x.shadowBlur = 30; x.shadowOffsetY = 14; }, noShadow = () => { x.shadowColor = "transparent"; x.shadowBlur = 0; x.shadowOffsetY = 0; };
    if (kind === "mug") {
      shadow(); x.fillStyle = "#fff"; x.beginPath(); x.roundRect(190, 190, 380, 440, 26); x.fill(); noShadow();
      x.lineWidth = 40; x.strokeStyle = "#fff"; x.beginPath(); x.arc(580, 400, 100, -1.1, 1.1); x.stroke(); x.lineWidth = 3; x.strokeStyle = "#e4d5bd"; x.beginPath(); x.roundRect(190, 190, 380, 440, 26); x.stroke();
      if (p.custom !== "text") fit(225, 235, 310, 260, 14); text(T, 380, img || p.custom !== "text" ? 570 : 430, 46);
    } else if (kind === "cushion") {
      shadow(); x.fillStyle = "#fff"; x.beginPath(); x.moveTo(150, 170); x.quadraticCurveTo(400, 130, 650, 170); x.quadraticCurveTo(690, 400, 650, 630); x.quadraticCurveTo(400, 670, 150, 630); x.quadraticCurveTo(110, 400, 150, 170); x.fill(); noShadow();
      if (p.custom !== "text") fit(215, 215, 370, 300, 30); text(T, 400, img || p.custom !== "text" ? 585 : 420, 50);
    } else if (kind === "clock") {
      shadow(); x.fillStyle = "#2b2b2b"; x.beginPath(); x.arc(400, 400, 290, 0, 7); x.fill(); noShadow();
      x.save(); x.beginPath(); x.arc(400, 400, 265, 0, 7); x.clip(); fit(135, 135, 530, 530); x.restore();
      x.strokeStyle = "#fff"; x.lineWidth = 10; x.lineCap = "round"; x.beginPath(); x.moveTo(400, 400); x.lineTo(400, 250); x.moveTo(400, 400); x.lineTo(500, 450); x.stroke();
      text(T, 400, 600, 40, "#fff");
    } else if (kind === "lamp") {
      x.fillStyle = "#7a4f2c"; x.beginPath(); x.roundRect(220, 610, 360, 70, 12); x.fill();
      x.save(); x.shadowColor = "rgba(255,214,140,.9)"; x.shadowBlur = 60; x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.roundRect(250, 150, 300, 470, 16); x.fill(); x.restore();
      x.globalAlpha = .9; fit(270, 175, 260, 300, 10); x.globalAlpha = 1; text(T, 400, 550, 40);
    } else if (kind === "shirt") {
      shadow(); x.fillStyle = "#fff"; x.beginPath(); x.moveTo(300, 140); x.lineTo(180, 200); x.lineTo(130, 330); x.lineTo(220, 360); x.lineTo(240, 300); x.lineTo(240, 690); x.lineTo(560, 690); x.lineTo(560, 300); x.lineTo(580, 360); x.lineTo(670, 330); x.lineTo(620, 200); x.lineTo(500, 140); x.quadraticCurveTo(400, 210, 300, 140); x.fill(); noShadow();
      if (p.custom !== "text") fit(300, 260, 200, 220, 8); text(T, 400, p.custom !== "text" ? 540 : 420, 40);
    } else if (kind === "engrave") {
      shadow(); const gg = x.createLinearGradient(200, 300, 600, 500); gg.addColorStop(0, "#e9cf8a"); gg.addColorStop(.5, "#c9a24b"); gg.addColorStop(1, "#a9822f");
      x.fillStyle = gg; x.beginPath(); x.roundRect(170, 330, 460, 150, 75); x.fill(); noShadow();
      if (img) { x.save(); x.beginPath(); x.arc(250, 405, 58, 0, 7); x.clip(); fit(192, 347, 116, 116); x.restore(); }
      text(T, img ? 440 : 400, 425, 52, "#5a3d10");
    } else if (kind === "neon") {
      x.fillStyle = "#1d1014"; x.fillRect(0, 0, W, W); x.save(); x.shadowColor = "#ff6ec7"; x.shadowBlur = 40; text(T, 400, 430, 110, "#ffd6f0"); x.restore();
    } else if (kind === "bouquet") {
      x.fillStyle = "#6A1B2E"; x.beginPath(); x.moveTo(250, 180); x.lineTo(550, 180); x.lineTo(430, 650); x.lineTo(370, 650); x.closePath(); x.fill();
      for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? "#a3172f" : "#7a3b16"; x.beginPath(); x.arc(290 + (i % 5) * 55, 190 + Math.floor(i / 5) * 55, 38, 0, 7); x.fill(); }
      x.fillStyle = "#FAF3E7"; x.beginPath(); x.roundRect(280, 420, 240, 90, 10); x.fill(); text(T, 400, 478, 34);
    } else if (kind === "box") {
      shadow(); x.fillStyle = "#6A1B2E"; x.beginPath(); x.roundRect(150, 180, 500, 450, 18); x.fill(); noShadow();
      x.fillStyle = "#C9A24B"; x.fillRect(385, 180, 30, 450); if (p.custom !== "text") fit(210, 240, 380, 260, 12); text(T, 400, 580, 44, "#FAF3E7");
    } else { // frame and other flat prints
      shadow(); x.fillStyle = "#2b1a14"; x.fillRect(180, 120, 440, 560); noShadow(); x.fillStyle = "#fff"; x.fillRect(205, 145, 390, 510);
      if (p.custom !== "text") fit(230, 170, 340, 380); text(T, 400, p.custom !== "text" ? 615 : 420, 40);
    }
    // watermark (preview only)
    x.save(); x.translate(400, 400); x.rotate(-0.5); x.globalAlpha = 0.14; x.fillStyle = "#6A1B2E"; x.textAlign = "center"; x.font = "600 34px 'DM Sans', sans-serif";
    for (let y = -560; y < 560; y += 110) x.fillText("GIFT HAVELI  ·  PREVIEW  ·  GIFT HAVELI  ·  PREVIEW", 0, y);
    x.restore();
  }
  const mockKind = p => {
    const n = (p.name + " " + p.cat).toLowerCase();
    if (/mug/.test(n)) return "mug"; if (/cushion/.test(n)) return "cushion"; if (/clock/.test(n)) return "clock"; if (/neon/.test(n)) return "neon";
    if (/lamp/.test(n)) return "lamp"; if (/shirt|cap|hood|apparel/.test(n)) return "shirt"; if (/bouquet/.test(n)) return "bouquet";
    if (/jewel|locket|ring|bracelet|pendant|pen|wallet|watch|keychain|brooch|case|men/.test(n)) return "engrave";
    if (/box|hamper|jar/.test(n)) return "box"; return "frame";
  };

  /* ---------- box builder (box | categories | items) ---------- */
  let B = { box: null, items: [], addons: [], cat: null };
  function initBuilder(from) {
    const box = D.boxes.find(b => pslug(b) === location.pathname.split("/").filter(Boolean)[1]); if (!box) return;
    const r = from && readyList().find(x => x.id === from);
    B = { box: box.id, items: r ? r.items.filter(id => D.fillers.some(f => f.id === id)).slice(0, box.slots) : [], addons: [], cat: boxCats()[0] };
    renderItems(); renderStage();
  }
  function renderItems() {
    const list = B.cat === "Extras" ? D.addons : D.fillers.filter(f => (f.cat || "Other") === B.cat);
    $("#bbItems").innerHTML = `<p class="eyebrow">${esc(B.cat || "")}</p>` + (list.length ? list.map(f => { const on = (B.cat === "Extras" ? B.addons : B.items).includes(f.id);
      return `<button class="bb-item${on ? " on" : ""}" data-it="${f.id}">${pic(f, f.icon)}<span><b>${esc(f.name)}</b><small>${price(f)}${f.custom && f.custom !== "none" ? " · " + customLabel(f.custom) : ""}</small></span><i>${on ? "✓" : "+"}</i></button>`; }).join("") : `<p class="muted">Nothing here yet.</p>`);
    document.querySelectorAll("[data-it]").forEach(b => b.onclick = () => {
      const id = b.dataset.it, box = byId(B.box);
      if (B.cat === "Extras") B.addons = B.addons.includes(id) ? B.addons.filter(x => x !== id) : [...B.addons, id];
      else if (B.items.includes(id)) B.items = B.items.filter(x => x !== id);
      else if (B.items.length < box.slots) B.items.push(id); else return toast(`This box holds ${box.slots} items. Remove one, or choose a bigger box.`);
      renderItems(); renderStage();
    });
  }
  function renderStage() {
    const box = byId(B.box), parts = [box, ...B.items.map(byId), ...B.addons.map(byId)], priced = parts.every(x => x.price), sub = parts.reduce((s, x) => s + (x.price || 0), 0);
    $("#stage").innerHTML = boxSvg(box, B.items, ($("#boxText") || {}).value || "") +
      `<div class="total"><span>${esc(box.name)} · ${B.items.length}/${box.slots} items${B.addons.length ? ` + ${B.addons.length} extra` : ""}</span><b>${priced ? rs(sub) : "Rs 0000"}</b></div>
      ${B.items.length ? `<div class="chips-in">${B.items.map(id => `<button data-rm="${id}">${esc(byId(id).name)} ×</button>`).join("")}</div>` : `<p class="muted-l" style="margin:8px 0 0">Pick a category, then tap items to put them in the box.</p>`}`;
    document.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { B.items = B.items.filter(x => x !== b.dataset.rm); renderItems(); renderStage(); });
    B.total = sub; B.priced = priced;
  }

  /* ---------- cart & order ---------- */
  function shrink(i) {
    const k = Math.min(1, 2000 / Math.max(i.width, i.height)), c = document.createElement("canvas");
    c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
    c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
    return { type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.9).split(",")[1] };
  }
  function addCart(item, photo) {
    item.uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (photo) { photos[item.uid] = photo; item.hasPhoto = true; }
    store.set([...store.get(), item]); toast("Added to your basket");
  }
  let lastWa = "";
  async function placeOrder(form) {
    const fd = Object.fromEntries(new FormData(form)), btn = $("#placeBtn"), err = $("#orderErr"), c = store.get();
    if (c.some(i => i.hasPhoto && !photos[i.uid])) { err.textContent = "A photo was lost when the page reloaded. Please remove that item and add it again."; return; }
    btn.disabled = true; btn.textContent = "Placing your order…"; err.textContent = "";
    const body = { action: "order", website: fd.website || "", form: { ...fd, secret: !!fd.secret },
      items: c.map(i => i.type === "box" ? { type: "box", box: i.box, items: i.items, addons: i.addons, text: i.text, ready: i.ready }
        : { type: i.type || "product", id: i.id, text: i.text, photo: photos[i.uid] }) };
    try {
      const j = await (await fetch(D.api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) })).json();
      if (!j.ok) throw new Error(j.error || "Order failed");
      lastWa = `https://wa.me/${j.whatsapp || D.whatsapp}?text=${encodeURIComponent(j.message)}`;
      store.set([]); Object.keys(photos).forEach(k => delete photos[k]);
      go(`/thanks?id=${encodeURIComponent(j.id)}`);
      setTimeout(() => { location.href = lastWa; }, 1800);
    } catch (e) {
      err.textContent = (e && e.message && !/fetch|network|JSON/i.test(e.message)) ? e.message : "We couldn't reach our order system. Please try again, or message us on WhatsApp.";
      btn.disabled = false; btn.textContent = "Place order";
    }
  }

  /* ---------- gift finder ---------- */
  function finder(form) {
    const pick = g => [...form.querySelectorAll(`[data-g="${g}"] .chip.on`)].map(c => c.textContent);
    const occ = pick("occ")[0] || "", rel = pick("rel")[0] || "", budget = +$("#budget").value;
    const prefs = { Wife: ["Bouquets", "Jewellery", "Lamps"], Husband: ["Mens Gifts", "Lamps", "Mugs"], Mother: ["Bouquets", "Frames", "Cushions"], Father: ["Mens Gifts", "Frames", "Mugs"],
      Sister: ["Jewellery", "Bouquets", "Mugs"], Brother: ["Mens Gifts", "Mugs", "Neon Signs"], Friend: ["Mugs", "Gift Boxes & Hampers", "Neon Signs"], Child: ["Neon Signs", "Cushions", "Personal Accessories"], "Boss / Client": ["Corporate & Awards", "Mens Gifts", "Frames"] };
    let cats = prefs[rel] || ["Gift Boxes & Hampers", "Bouquets", "Frames"];
    if (occ.startsWith("Nikkah")) cats = ["Wedding & Nikkah", ...cats];
    const list = D.products.filter(p => cats.includes(p.cat) && (!p.price || p.price <= budget)).sort((a, b) => cats.indexOf(a.cat) - cats.indexOf(b.cat)).slice(0, 6);
    $("#ideas").innerHTML = `<h3>Ideas for ${esc(rel || "them")}${occ ? " · " + esc(occ) : ""}</h3>` + (list.length ? `<div class="grid prods">${list.map(p => card(p)).join("")}</div>` : `<p class="muted">Try a higher budget, or <a href="/build">build a custom box</a>.</p>`);
  }

  /* ---------- chat ---------- */
  const chatReply = t => {
    t = t.toLowerCase();
    if (/deliver|delivery|shipping|kitne din|city/.test(t)) return `We deliver all over Pakistan. Delivery: ${freeLine()}`;
    if (/price|kitna|cost|rate/.test(t)) return "Prices are shown on each product. You can also tap 'Order on WhatsApp' and we will confirm the price.";
    if (/track|status|order id|gh-/.test(t)) return "Open Track Order and enter your Order ID to see the status.";
    if (/bulk|corporate|company|office/.test(t)) return `For bulk or corporate gifts, message us on WhatsApp: wa.me/${D.whatsapp}`;
    if (/abroad|uk|usa|dubai|overseas|bahar/.test(t)) return "Yes! Order from anywhere — we deliver to your family in Pakistan.";
    if (/idea|suggest|what.*give|kya doon|gift for/.test(t)) return "Pick a ready gift box, build your own box, or customize a gift with a name or photo. Need help? Message us on WhatsApp.";
    return `I can help with gifts, prices, delivery and orders. For anything else, WhatsApp us at 0313-0111349.`;
  };
  function chatSay(text, who) { const b = $("#chatBody"); b.insertAdjacentHTML("beforeend", `<div class="msg ${who}"></div>`); b.lastElementChild.textContent = text; b.scrollTop = b.scrollHeight; }

  /* ---------- events ---------- */
  function bind() {
    const ar = $("#addR"); if (ar) ar.onclick = () => {
      const r = readyList().find(x => x.id === ar.dataset.r), box = byId(r.box), parts = rParts(r), t = ($("#rbText") || {}).value || "";
      addCart({ type: "box", ready: r.id, box: box.id, items: r.items.filter(id => D.fillers.some(f => f.id === id)), addons: [], text: t, name: `${r.name} gift box`, price: rTotal(r), detail: [...parts.map(x => x.name), t && `Message: ${t}`].filter(Boolean).join(", ") });
    };
    document.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { B.cat = b.dataset.cat; document.querySelectorAll("[data-cat]").forEach(x => x.classList.toggle("on", x === b)); renderItems(); $("#bbItems").scrollIntoView({ behavior: "smooth", block: "nearest" }); });
    const bt = $("#boxText"); if (bt) bt.oninput = renderStage;
    const ab = $("#addBox"); if (ab) ab.onclick = () => {
      const box = byId(B.box); if (!B.items.length) return toast("Add at least one item");
      addCart({ type: "box", box: box.id, items: [...B.items], addons: [...B.addons], text: bt.value, name: `${box.name} gift box`, price: B.priced ? B.total : 0,
        detail: [...B.items.map(id => byId(id).name), ...B.addons.map(id => byId(id).name), bt.value && `Text: ${bt.value}`].filter(Boolean).join(", ") });
    };
    document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { const c = store.get(); const [gone] = c.splice(+b.dataset.del, 1); if (gone) delete photos[gone.uid]; store.set(c); route(false); });
    const o = $("#order"); if (o) o.onsubmit = e => { e.preventDefault(); placeOrder(o); };
    const f = $("#finder"); if (f) {
      f.querySelectorAll(".chips").forEach(g => g.querySelectorAll(".chip").forEach(c => c.onclick = () => { g.querySelectorAll(".chip").forEach(x => x.classList.remove("on")); c.classList.add("on"); }));
      f.onsubmit = e => { e.preventDefault(); finder(f); };
    }
    const tr = $("#track"); if (tr) tr.onsubmit = async e => {
      e.preventDefault(); const out = $("#tres"); out.innerHTML = `<p class="muted">Checking…</p>`;
      try {
        const j = await (await fetch(`${D.api}?action=track&id=${encodeURIComponent($("#tid").value.trim())}&ph=${encodeURIComponent($("#tph").value.trim())}`)).json();
        if (!j.ok) { out.innerHTML = `<p class="warn">${esc(j.error)}</p>`; return; }
        const steps = ["Confirmed", "Making", "Shipped", "Delivered"], at = steps.indexOf(j.status);
        out.innerHTML = j.status === "Cancelled" ? `<p><b>${esc(j.id)}</b> was cancelled. Message us on WhatsApp if this is a mistake.</p>`
          : `<p><b>${esc(j.id)}</b> · ${esc(j.city)} · delivery date ${esc(j.date)}</p><ol class="track">${steps.map((s, i) => `<li class="${i <= at ? "done" : ""}">${s}</li>`).join("")}</ol>`;
      } catch (x) { out.innerHTML = `<p class="warn">We couldn't check right now. Please try again or message us on WhatsApp.</p>`; }
    };
  }

  $("#menuBtn").onclick = () => $("#links").classList.toggle("open");
  $("#chatFab").onclick = () => { const c = $("#chat"); c.hidden = !c.hidden; if (!c.hidden && !$("#chatBody").children.length) chatSay("Assalam o Alaikum! Welcome to Gift Haveli. How can I help you today?", "bot"); };
  $("#chatClose").onclick = () => $("#chat").hidden = true;
  $("#chatForm").onsubmit = e => { e.preventDefault(); const v = $("#chatInput").value.trim(); if (!v) return; chatSay(v, "me"); $("#chatInput").value = ""; setTimeout(() => chatSay(chatReply(v), "bot"), 450); };

  function useCatalog(c) {
    D.whatsapp = (c.settings && c.settings.whatsapp) || D.whatsapp; if (c.settings) { D.delivery = c.settings.delivery; D.freeAbove = c.settings.freeAbove; }
    D.products = c.products; D.boxes = c.boxes; D.fillers = c.fillers; D.addons = c.addons; D.ready = c.ready || [];
    [...D.products, ...D.boxes, ...D.fillers, ...D.addons].forEach(x => { if (!x.gallery || !x.gallery.length) x.gallery = (D.gallery && D.gallery[x.id]) || []; });
    D.ready.forEach(r => { if (!r.gallery || !r.gallery.length) r.gallery = (D.gallery && D.gallery[r.id]) || []; });
    const names = [...new Set(c.products.map(p => p.cat))].sort((a, b) => (D.catOrder.indexOf(a) + 1 || 99) - (D.catOrder.indexOf(b) + 1 || 99));
    D.categories = names.map(n => ({ id: slug(n), name: n, icon: catIcon(n) }));
  }
  async function load() {
    // 1) fast: catalogue snapshot saved with the site; 2) fresh: live from the sheet
    try { const s = await (await fetch("/catalog.json", { cache: "no-cache" })).json(); useCatalog(s); ready = true; route(false); } catch (e) {}
    try {
      const j = await (await fetch(D.api)).json(); if (!j.ok) throw new Error();
      useCatalog(j.data); ready = true;
      const ok = store.get().filter(i => i.type === "box" || byId(i.id)); if (ok.length !== store.get().length) store.set(ok);
      if (!$("#cv") && !$("#bbItems") && !$("#order")) route(false); // don't wipe what the customer is typing
    } catch (e) { if (!ready) { loadErr = "We couldn't load our gifts right now. Please refresh, or message us on WhatsApp."; route(false); } }
  }
  updCount(); if (!window.__PRERENDER_ONLY__) { route(false); load(); }
  window.__gh = { route, useCatalog, ready: () => { ready = true; } };
})();

// footer credit (also fixes older pre-rendered pages)
(function(){function c(){var f=document.querySelector('.foot-bottom');if(f&&!f.querySelector('.credit')){var t=f.innerHTML;if(t.indexOf('<span')<0)f.innerHTML='<span>'+t+'</span>';var s=document.createElement('span');s.className='credit';s.innerHTML='Created by <a href="https://navifexpro.com" target="_blank" rel="noopener">Navifex Pro</a>';f.appendChild(s);}}if(document.readyState!='loading')c();else document.addEventListener('DOMContentLoaded',c);})();
