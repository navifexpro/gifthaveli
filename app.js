/* Gift Haveli — front-end. Catalogue, orders and tracking go through the Apps Script backend (D.api). */
(() => {
  const D = window.GH, $ = (s, r = document) => r.querySelector(s), app = $("#app");
  const rs = n => "Rs " + Number(n).toLocaleString("en-PK");
  const icon = (k, cls = "") => `<svg viewBox="0 0 64 64" class="${cls}">${D.icons[k] || D.icons.box}</svg>`;
  const pic = (id, ic, alt) => D.photos.has(id) ? `<img src="p/${id}.jpg" alt="${String(alt || "").replace(/"/g, "")}" loading="lazy">` : icon(ic);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem("gh_cart") || "[]"); } catch (e) { return mem; } },
    set(v) { mem = v; try { localStorage.setItem("gh_cart", JSON.stringify(v)); } catch (e) {} updCount(); }
  };
  let mem = [];
  const updCount = () => $("#cartCount").textContent = store.get().length;
  const toast = t => { const el = $("#toast"); el.textContent = t; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2200); };
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const price = p => p.price ? rs(p.price) : "Price on request";
  const priceShort = p => p.price ? rs(p.price) : "Price soon";
  const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const catIcon = c => D.catIcons[c] || "box";
  const askWa = t => `https://wa.me/${D.whatsapp}?text=${encodeURIComponent(t)}`;
  const freeLine = () => D.freeAbove ? `Rs ${D.delivery} per order. Free on orders above ${rs(D.freeAbove)}.` : `Rs ${D.delivery} per order.`;
  const photos = {};   // cart photos live in memory only (too big for browser storage)
  let ready = false, loadErr = "";

  /* ---------- pages ---------- */
  const pages = {
    "/": () => `
      <section class="hero"><div class="hero-bg"></div>
        <div class="wrap">
          <p class="eyebrow fade-up">Personalised gifts · Delivery all over Pakistan</p>
          <h1 class="fade-up d1">Gifts that feel like home.</h1>
          <p class="fade-up d2">Choose a box, fill it with things they love, add a name, a photo or a few words — and we deliver it to their door, anywhere in Pakistan.</p>
          <div class="actions fade-up d3"><a class="btn gold" href="#/build">Build your gift box</a><a class="btn ghost" href="#/customize">Personalise a gift</a></div>
        </div>
      </section>
      <section class="block"><div class="wrap">
        <p class="eyebrow">Shop by category</p><h2>Something for every someone</h2>
        <div class="grid cats" style="margin-top:26px">${D.categories.length ? D.categories.map(c => `<a class="cat" href="#/customize?c=${c.id}">${icon(c.icon)}<b>${esc(c.name)}</b></a>`).join("") : `<p class="muted">${loadErr || "Loading…"}</p>`}</div>
      </div></section>
      <section class="block" style="padding-top:0"><div class="wrap split">
        <img src="hero-bouquet.jpg" alt="Red rose and chocolate bouquet wrapped in maroon and cream paper" loading="lazy">
        <div><p class="eyebrow">Build a box</p><h2>Make it entirely theirs</h2>
          <ol class="steps"><li><div><b>Pick a box</b><br><span class="muted">Heart, square, trunk or cube.</span></div></li>
          <li><div><b>Fill it</b><br><span class="muted">Mugs, frames, roses, chocolates, keepsakes — add or remove anything.</span></div></li>
          <li><div><b>Make it personal</b><br><span class="muted">A name, a photo, a message card.</span></div></li>
          <li><div><b>We deliver</b><br><span class="muted">Anywhere in Pakistan. Watch the price update as you go.</span></div></li></ol>
          <a class="btn" href="#/build">Start building</a></div>
      </div></section>
      <section class="block band"><div class="wrap">
        <p class="eyebrow">From anywhere to home</p><h2>Far from family? We'll take it home for you.</h2>
        <p style="max-width:60ch">Living in the UK, USA, Gulf or anywhere else — order online and we deliver your gift to your loved ones in Pakistan, with your message inside.</p>
        <div class="grid three" style="margin-top:28px">
          <div class="card"><h3>Delivery all over Pakistan</h3><p>${freeLine()}</p></div>
          <div class="card"><h3>Keep it a surprise</h3><p>Tick "keep sender secret" and we won't reveal who sent it.</p></div>
          <div class="card"><h3>Track every step</h3><p>Use your Order ID to see when it's made, shipped and delivered.</p></div>
        </div></div></section>
      <section class="block"><div class="wrap split">
        <div><p class="eyebrow">Not sure what to give?</p><h2>Let us help you choose</h2><p class="muted">Tell us the occasion, who it's for and your budget. Our Gift Finder suggests gifts that fit.</p><a class="btn ghost" href="#/finder">Open Gift Finder</a></div>
        <div class="card"><p class="eyebrow">For companies</p><h3>Corporate & bulk gifts</h3><p class="muted">Eid hampers, client gifts, branded mugs, shields and awards — made in bulk and delivered across Pakistan.</p><a class="btn sm" href="#/corporate">Corporate gifting</a></div>
      </div></section>`,

    "/customize": q => {
      const cat = q.get("c") || "all";
      const list = D.products.filter(p => cat === "all" || slug(p.cat) === cat);
      return `<section class="page-head"><div class="wrap"><p class="eyebrow">Personalise</p><h1>Personalised gifts</h1>${ready ? "" : `<p class="note">${loadErr || "Loading gifts…"}</p>`}</div></section>
      <section style="padding-bottom:70px"><div class="wrap">
        <div class="tabs"><button class="tab ${cat === "all" ? "on" : ""}" data-c="all">All</button>${D.categories.map(c => `<button class="tab ${cat === c.id ? "on" : ""}" data-c="${c.id}">${esc(c.name)}</button>`).join("")}</div>
        <div class="grid prods">${list.map(p => `
          <article class="prod"><div class="ph">${pic(p.id, catIcon(p.cat), p.name)}</div><div class="in">
            <span class="tag">${({ photo: "Add a photo", text: "Add a name", both: "Photo + name", none: "Ready to gift" })[p.custom] || "Gift"}</span>
            <h3>${esc(p.name)}</h3><span class="price">${price(p)}</span>
            ${p.price ? `<button class="btn sm" data-p="${p.id}" style="margin-top:auto">${p.custom === "none" ? "Add to basket" : "Personalise"}</button>`
              : `<a class="btn sm ghost" style="margin-top:auto" target="_blank" rel="noopener" href="${askWa(`Assalam o Alaikum, what is the price of ${p.name} (${p.id})?`)}">Ask price on WhatsApp</a>`}</div></article>`).join("")}</div>
      </div></section>`;
    },

    "/build": () => !ready || !D.boxes.length || !D.fillers.length ? `<section class="page-head"><div class="wrap"><p class="eyebrow">Build a box</p><h1>Create your gift box</h1>
        <p class="muted">${!ready ? (loadErr || "Loading…") : "Build a Box is opening soon. Tell us what you want and we'll make it for you."}</p>
        ${ready ? `<a class="btn" target="_blank" rel="noopener" href="${askWa("Assalam o Alaikum, I want a custom gift box.")}">Plan my box on WhatsApp</a>` : ""}</div></section>`
      : `<section class="page-head"><div class="wrap"><p class="eyebrow">Build a box</p><h1>Create your gift box</h1></div></section>
      <section style="padding-bottom:70px"><div class="wrap builder">
        <div class="stage" id="stage"></div>
        <div>
          <h3>1. Start with a ready box, or your own</h3>
          <div class="opt-grid" id="ready">${readyList().map(r => `<button class="opt" data-r="${r.i}"><b>${r.name}</b><small>${r.items.length} items</small></button>`).join("")}<button class="opt" data-r="own"><b>Customize my own</b><small>Start empty</small></button></div>
          <h3>2. Choose the box</h3>
          <div class="opt-grid" id="boxes">${D.boxes.map(b => `<button class="opt" data-b="${b.id}">${D.photos.has(b.id) ? `<img class="oimg" src="p/${b.id}.jpg" alt="" loading="lazy">` : ""}<b>${esc(b.name)}</b><small>${esc(b.size)} in · ${priceShort(b)}</small></button>`).join("")}</div>
          <h3>3. Fill it</h3>
          <div class="opt-grid" id="fillers">${D.fillers.map(f => `<button class="opt" data-f="${f.id}">${D.photos.has(f.id) ? `<img class="oimg" src="p/${f.id}.jpg" alt="" loading="lazy">` : ""}<b>${esc(f.name)}</b><small>${priceShort(f)}</small></button>`).join("")}</div>
          ${D.addons.length ? `<h3>4. Add-ons</h3>
          <div class="opt-grid" id="addons">${D.addons.map(a => `<button class="opt" data-a="${a.id}">${D.photos.has(a.id) ? `<img class="oimg" src="p/${a.id}.jpg" alt="" loading="lazy">` : ""}<b>${esc(a.name)}</b><small>${priceShort(a)}</small></button>`).join("")}</div>` : ""}
          <div class="field"><label>Name or message to print (optional)</label><input id="boxText" maxlength="40" placeholder="e.g. Happy Birthday Ammi"></div>
          <button class="btn" id="addBox">Add box to basket</button>
        </div></div></section>`,

    "/finder": () => `<section class="page-head"><div class="wrap"><p class="eyebrow">Gift Finder</p><h1>Find the right gift</h1><p class="muted">Answer three quick questions.</p></div></section>
      <section style="padding-bottom:70px"><div class="wrap two grid">
        <form class="card" id="finder">
          <div class="field"><label>Occasion</label><div class="chips" data-g="occ">${["Birthday", "Anniversary", "Eid", "Nikkah / Wedding", "Thank you", "Just because"].map(x => `<button type="button" class="chip">${x}</button>`).join("")}</div></div>
          <div class="field"><label>Who is it for?</label><div class="chips" data-g="rel">${["Wife", "Husband", "Mother", "Father", "Sister", "Brother", "Friend", "Child", "Boss / Client"].map(x => `<button type="button" class="chip">${x}</button>`).join("")}</div></div>
          <div class="field"><label>Budget</label><select id="budget"><option value="2000">Up to Rs 2,000</option><option value="4000">Rs 2,000 – 4,000</option><option value="8000" selected>Rs 4,000 – 8,000</option><option value="99999">Above Rs 8,000</option></select></div>
          <div class="field"><label>Tell us more (optional)</label><textarea id="idea" rows="3" placeholder="She loves roses and coffee…"></textarea></div>
          <button class="btn">Show gift ideas</button>

        </form>
        <div id="ideas"></div></div></section>`,

    "/cart": () => {
      const c = store.get(), sub = c.reduce((s, i) => s + i.price, 0), del = !c.length || (D.freeAbove && sub >= D.freeAbove) ? 0 : D.delivery;
      return `<section class="page-head"><div class="wrap"><p class="eyebrow">Your basket</p><h1>Almost there</h1></div></section>
      <section style="padding-bottom:70px"><div class="wrap grid two">
        <div>${c.length ? c.map((i, n) => `<div class="line"><div><b>${esc(i.name)}</b><br><small class="muted">${esc(i.detail || "")}${i.hasPhoto && !photos[i.uid] ? ` <span class="warn">Photo lost after page reload — remove and add again.</span>` : ""}</small></div><div>${rs(i.price)} <button class="btn sm ghost" data-del="${n}">Remove</button></div></div>`).join("") : `<p class="muted">Your basket is empty. <a href="#/customize">Find a gift</a>.</p>`}
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
        <aside class="sum"><div class="row"><span>Items</span><span>${rs(sub)}</span></div>
          <div class="row"><span>Delivery</span><span>${del ? rs(del) : (c.length ? "Free" : "—")}</span></div>
          <hr style="border:0;border-top:1px solid rgba(106,27,46,.15)"><div class="row"><span>Total</span><span class="grand">${rs(sub + del)}</span></div>
          ${D.freeAbove && sub && sub < D.freeAbove ? `<p class="muted" style="font-size:.85rem">Add ${rs(D.freeAbove - sub)} more for free delivery.</p>` : ""}</aside>
      </div></section>`;
    },

    "/thanks": q => `<section class="block"><div class="wrap" style="text-align:center;max-width:640px">
      <p class="eyebrow">Order received</p><h1>Thank you!</h1><p>Your Order ID is</p><h2>${esc(q.get("id"))}</h2>
      <p class="muted">We're opening WhatsApp so you can send us your order. Keep this ID to track your gift.</p>
      <a class="btn" href="${esc(lastWa || ("https://wa.me/" + D.whatsapp))}" target="_blank" rel="noopener">Open WhatsApp</a></div></section>`,

    "/track": () => `<section class="page-head"><div class="wrap"><p class="eyebrow">Track order</p><h1>Where is my gift?</h1></div></section>
      <section style="padding-bottom:80px"><div class="wrap" style="max-width:560px"><form class="card" id="track">
      <div class="field"><label>Order ID</label><input id="tid" placeholder="GH-2611-0001" required></div>
      <div class="field"><label>Last 4 digits of your WhatsApp number</label><input id="tph" inputmode="numeric" maxlength="4" required></div><button class="btn">Check status</button><div id="tres" style="margin-top:18px"></div></form></div></section>`,

    "/corporate": () => `<section class="page-head"><div class="wrap"><p class="eyebrow">Corporate gifting</p><h1>Gifts your team and clients remember</h1></div></section>
      <section style="padding-bottom:80px"><div class="wrap split"><img src="hero-hamper.jpg" alt="Premium cream gift hamper with gold ribbon" style="aspect-ratio:4/3">
      <div><ul class="steps"><li>Eid and festive hampers for staff</li><li>Client gifts with your logo on mugs, pens and boxes</li><li>Wooden shields and awards</li><li>Delivery to many addresses across Pakistan</li></ul>
      <a class="btn" href="https://wa.me/${D.whatsapp}?text=${encodeURIComponent("Assalam o Alaikum, I want to discuss corporate / bulk gifts.")}" target="_blank" rel="noopener">Talk to us on WhatsApp</a></div></div></section>`,

    "/faq": () => `<section class="page-head"><div class="wrap"><p class="eyebrow">Questions</p><h1>Good to know</h1></div></section>
      <section style="padding-bottom:80px"><div class="wrap" style="max-width:760px">${[
        ["Where do you deliver?", "All over Pakistan."],
        ["How much is delivery?", freeLine()],
        ["I live abroad. Can I order?", "Yes. Order here and we deliver to your family in Pakistan."],
        ["Are the flowers real?", "We use high-quality artificial flowers, so they stay beautiful."],
        ["How do I add a photo?", "Choose a product, tap Personalise and upload your photo. You'll see a preview first."]
      ].map(([q, a]) => `<details class="card" style="margin-bottom:12px"><summary><b>${q}</b></summary><p style="margin-top:10px">${a}</p></details>`).join("")}</div></section>`
  };

  /* ---------- router ---------- */
  function route() {
    const [path, qs] = (location.hash.slice(1) || "/").split("?");
    const q = new URLSearchParams(qs || "");
    app.innerHTML = (pages[path] || pages["/"])(q);
    document.querySelectorAll(".links a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + path));
    $("#links").classList.remove("open");
    window.scrollTo(0, 0);
    if (path === "/build") initBuilder();
    bind();
  }

  /* ---------- personalise modal with live canvas preview + watermark ---------- */
  function openProduct(p) {
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = `<div class="sheet"><div class="left"><canvas id="cv" width="800" height="800"></canvas></div>
      <div class="right"><button class="x" aria-label="Close">×</button><p class="tag">${p.id}</p><h2>${esc(p.name)}</h2><p class="price">${price(p)}</p>
      ${p.custom === "photo" || p.custom === "both" ? `<div class="field"><label>Upload a photo</label><input type="file" id="ph" accept="image/*"><span class="warn" id="pw"></span></div>` : ""}
      ${p.custom === "text" || p.custom === "both" ? `<div class="field"><label>Name or short text</label><input id="tx" maxlength="30" placeholder="e.g. Ayesha"></div>` : ""}
      <p class="muted" style="font-size:.85rem">Preview only. The Gift Haveli mark is not printed on your gift.</p>
      <button class="btn" id="add">Add to basket</button></div></div>`;
    document.body.appendChild(m);
    const cv = $("#cv", m), ctx = cv.getContext("2d");
    let img = null, photo = null;
    const draw = () => {
      ctx.fillStyle = "#f6ecdd"; ctx.fillRect(0, 0, 800, 800);
      // product mock: mug-like printable area
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#d9c4a5"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(170, 170, 420, 460, 30); ctx.fill(); ctx.stroke();
      if (catIcon(p.cat) === "mug") { ctx.beginPath(); ctx.lineWidth = 34; ctx.strokeStyle = "#fff"; ctx.arc(600, 400, 90, -1.2, 1.2); ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = "#d9c4a5"; }
      if (img) { ctx.save(); ctx.beginPath(); ctx.roundRect(200, 200, 360, 300, 16); ctx.clip();
        const s = Math.max(360 / img.width, 300 / img.height); ctx.drawImage(img, 380 - img.width * s / 2, 350 - img.height * s / 2, img.width * s, img.height * s); ctx.restore(); }
      const t = ($("#tx", m) || {}).value || "";
      ctx.fillStyle = "#6A1B2E"; ctx.textAlign = "center"; ctx.font = "italic 600 46px Fraunces, serif";
      ctx.fillText(t || (img ? "" : "Your name here"), 380, img ? 570 : 420);
      // watermark (preview only)
      ctx.save(); ctx.translate(400, 400); ctx.rotate(-0.5); ctx.globalAlpha = 0.16; ctx.fillStyle = "#6A1B2E"; ctx.font = "600 40px DM Sans, sans-serif";
      for (let y = -500; y < 500; y += 120) ctx.fillText("GIFT HAVELI  ·  PREVIEW  ·  GIFT HAVELI", 0, y);
      ctx.restore();
    };
    draw();
    m.addEventListener("input", draw);
    const ph = $("#ph", m);
    if (ph) ph.addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { const i = new Image(); i.onload = () => { img = i; photo = shrink(i); $("#pw", m).textContent = (i.width < 800 || i.height < 800) ? "This photo is small and may print blurry. A bigger photo will look better." : ""; draw(); }; i.src = r.result; };
      r.readAsDataURL(f);
    });
    m.addEventListener("click", e => { if (e.target === m || e.target.classList.contains("x")) m.remove(); });
    $("#add", m).onclick = () => {
      const t = ($("#tx", m) || {}).value || "";
      if ((p.custom === "photo") && !photo) return toast("Please upload a photo first");
      addCart({ type: "product", id: p.id, name: p.name, price: p.price, text: t, detail: [t && `Text: ${t}`, photo && "Photo added"].filter(Boolean).join(" · ") }, photo);
      m.remove();
    };
  }

  /* ---------- box builder ---------- */
  let B = { box: null, items: [], addons: [] };
  function initBuilder() { if (!D.boxes.length || !D.fillers.length) return; B = { box: D.boxes[0].id, items: [], addons: [] }; renderStage(); }
  function readyList() { return D.readyBoxes.map((r, i) => ({ ...r, i })).filter(r => D.boxes.some(b => b.id === r.box) && r.items.every(id => D.fillers.some(f => f.id === id))); }
  const boxColor = n => /red/i.test(n) ? "#8E1F35" : /white/i.test(n) ? "#F3E6D3" : /black/i.test(n) ? "#2B0F17" : /gold/i.test(n) ? "#B8913F" : /blue/i.test(n) ? "#2E4A7A" : "#6A1B2E";
  function renderStage() {
    const box = D.boxes.find(b => b.id === B.box);
    const sub = box.price + B.items.reduce((s, id) => s + D.fillers.find(f => f.id === id).price, 0) + B.addons.reduce((s, id) => s + D.addons.find(a => a.id === id).price, 0);
    const slots = B.items.map((id, i) => {
      const f = D.fillers.find(x => x.id === id), col = i % 4, row = Math.floor(i / 4) % 2;
      return `<g class="item-pop" transform="translate(${118 + col * 92} ${150 + row * 80})"><circle r="34" fill="#FAF3E7" stroke="#C9A24B" stroke-width="2"/><g transform="translate(-22 -22) scale(.7)" fill="none" stroke="#6A1B2E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${D.icons[f.icon] || D.icons.box}</g></g>`;
    }).join("");
    const shape = box.shape === "heart"
      ? `<path d="M260 330 C120 250 90 140 170 105 C215 85 250 110 260 140 C270 110 305 85 350 105 C430 140 400 250 260 330Z" fill="${boxColor(box.name)}" stroke="#C9A24B" stroke-width="3"/>`
      : `<rect x="70" y="${box.shape === "trunk" ? 100 : 90}" width="380" height="${box.shape === "trunk" ? 200 : 230}" rx="${box.shape === "trunk" ? 22 : 12}" fill="${boxColor(box.name)}" stroke="#C9A24B" stroke-width="3"/>`;
    const has = re => B.addons.some(id => re.test((D.addons.find(a => a.id === id) || {}).name || ""));
    const bow = has(/ribbon|bow/i) ? `<path d="M260 82 C230 50 200 70 220 92 Z M260 82 C290 50 320 70 300 92 Z" fill="#C9A24B"/><rect x="252" y="80" width="16" height="16" rx="4" fill="#C9A24B"/>` : "";
    const balloons = has(/balloon/i) ? `<g opacity=".9"><ellipse cx="470" cy="70" rx="22" ry="28" fill="#C9A24B"/><ellipse cx="440" cy="50" rx="20" ry="26" fill="#E9C9C3"/><path d="M470 98 L455 200 M440 76 L455 200" stroke="#E7D2A0"/></g>` : "";
    const lights = has(/light/i) ? Array.from({ length: 9 }, (_, i) => `<circle cx="${90 + i * 42}" cy="${340 + (i % 2) * 8}" r="5" fill="#FFE9A8"/>`).join("") : "";
    const text = ($("#boxText") || {}).value || "";
    $("#stage").innerHTML = `<svg viewBox="0 0 520 380">${balloons}${shape}${bow}${slots}${lights}
      ${text ? `<text x="260" y="370" text-anchor="middle" font-family="Fraunces" font-style="italic" font-size="22" fill="#E7D2A0">${text.replace(/[<>&]/g, "")}</text>` : ""}</svg>
      <div class="total"><span>${esc(box.name)} · ${B.items.length}/${box.slots} items</span><b>${rs(sub)}</b></div>`;
    document.querySelectorAll("[data-b]").forEach(b => b.classList.toggle("on", b.dataset.b === B.box));
    document.querySelectorAll("[data-a]").forEach(b => b.classList.toggle("on", B.addons.includes(b.dataset.a)));
    document.querySelectorAll("[data-f]").forEach(b => b.classList.toggle("on", B.items.includes(b.dataset.f)));
    B.total = sub;
    const parts = [box, ...B.items.map(id => D.fillers.find(f => f.id === id)), ...B.addons.map(id => D.addons.find(a => a.id === id))];
    B.unpriced = parts.some(x => !x.price);
    if (B.unpriced) $("#stage .total b").textContent = "Price on WhatsApp";
    const ab = $("#addBox"); if (ab) ab.textContent = B.unpriced ? "Send this box on WhatsApp" : "Add box to basket";
  }

  /* ---------- cart & order ---------- */
  // shrink a photo to max 2000px JPEG so uploads stay small and fast
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
    const fd = Object.fromEntries(new FormData(form)), btn = $("#placeBtn"), err = $("#orderErr");
    const c = store.get();
    if (c.some(i => i.hasPhoto && !photos[i.uid])) { err.textContent = "A photo was lost when the page reloaded. Please remove that item and add it again."; return; }
    btn.disabled = true; btn.textContent = "Placing your order…"; err.textContent = "";
    const body = { action: "order", website: fd.website || "", form: { ...fd, secret: !!fd.secret },
      items: c.map(i => i.type === "box" ? { type: "box", box: i.box, items: i.items, addons: i.addons, text: i.text }
        : { type: "product", id: i.id, text: i.text, photo: photos[i.uid] }) };
    try {
      const r = await fetch(D.api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Order failed");
      lastWa = `https://wa.me/${j.whatsapp || D.whatsapp}?text=${encodeURIComponent(j.message)}`;
      store.set([]); Object.keys(photos).forEach(k => delete photos[k]);
      location.hash = `#/thanks?id=${encodeURIComponent(j.id)}`;
      setTimeout(() => { location.href = lastWa; }, 1800);
    } catch (e) {
      err.textContent = (e && e.message && !/fetch|network|JSON/i.test(e.message)) ? e.message : "We couldn't reach our order system. Please try again, or message us on WhatsApp.";
      btn.disabled = false; btn.textContent = "Place order";
    }
  }

  /* ---------- gift finder (rule-based preview; AI in live site) ---------- */
  function finder(form) {
    const pick = g => [...form.querySelectorAll(`[data-g="${g}"] .chip.on`)].map(c => c.textContent);
    const occ = pick("occ")[0] || "", rel = pick("rel")[0] || "", budget = +$("#budget").value;
    const prefs = { Wife: ["Bouquets", "Jewellery", "Lamps"], Husband: ["Mens Gifts", "Lamps", "Mugs"], Mother: ["Bouquets", "Frames", "Cushions"], Father: ["Mens Gifts", "Frames", "Mugs"],
      Sister: ["Jewellery", "Bouquets", "Mugs"], Brother: ["Mens Gifts", "Mugs", "Neon Signs"], Friend: ["Mugs", "Gift Boxes & Hampers", "Neon Signs"], Child: ["Neon Signs", "Cushions", "Balloon Decor"], "Boss / Client": ["Corporate & Awards", "Mens Gifts", "Frames"] };
    let cats = prefs[rel] || ["Gift Boxes & Hampers", "Bouquets", "Frames"];
    if (occ.startsWith("Nikkah")) cats = ["Wedding & Nikkah", ...cats];
    const list = D.products.filter(p => cats.includes(p.cat) && (!p.price || p.price <= budget)).sort((a, b) => cats.indexOf(a.cat) - cats.indexOf(b.cat) || (b.price > 0) - (a.price > 0)).slice(0, 6);
    $("#ideas").innerHTML = `<h3>Ideas for ${rel || "them"}${occ ? " · " + occ : ""}</h3>` + (list.length ? `<div class="grid prods">${list.map(p => `<article class="prod"><div class="ph">${pic(p.id, catIcon(p.cat), p.name)}</div><div class="in"><h3>${esc(p.name)}</h3><span class="price">${price(p)}</span>${p.price ? `<button class="btn sm" data-p="${p.id}">${p.custom === "none" ? "Add to basket" : "Personalise"}</button>` : `<a class="btn sm ghost" target="_blank" rel="noopener" href="${askWa(`Assalam o Alaikum, what is the price of ${p.name} (${p.id})?`)}">Ask price</a>`}</div></article>`).join("")}</div>` : `<p class="muted">Try a higher budget, or <a href="#/build">build a custom box</a>.</p>`);
    bind();
  }

  /* ---------- chat (rule-based preview; AI in live site) ---------- */
  const chatReply = t => {
    t = t.toLowerCase();
    if (/deliver|delivery|shipping|kitne din|city/.test(t)) return `We deliver all over Pakistan. Delivery: ${freeLine()}`;
    if (/price|kitna|cost|rate/.test(t)) return "Prices are shown on each product. If a product says 'Price on request', tap 'Ask price on WhatsApp'.";
    if (/track|status|order id|gh-/.test(t)) return "Open Track Order and enter your Order ID to see the status.";
    if (/bulk|corporate|company|office/.test(t)) return `For bulk or corporate gifts, message us on WhatsApp: wa.me/${D.whatsapp}`;
    if (/abroad|uk|usa|dubai|overseas|bahar/.test(t)) return "Yes! Order from anywhere — we deliver to your family in Pakistan.";
    if (/idea|suggest|what.*give|kya doon|gift for/.test(t)) return "Try our Gift Finder — tell us the occasion and who it's for, and we'll suggest gifts.";
    return `I can help with gifts, prices, delivery and orders. For anything else, WhatsApp us at 0313-0111349.`;
  };
  function chatSay(text, who) { const b = $("#chatBody"); b.insertAdjacentHTML("beforeend", `<div class="msg ${who}"></div>`); b.lastElementChild.textContent = text; b.scrollTop = b.scrollHeight; }

  /* ---------- events ---------- */
  function bind() {
    document.querySelectorAll("[data-c]").forEach(b => b.onclick = () => location.hash = "#/customize?c=" + b.dataset.c);
    document.querySelectorAll("[data-p]").forEach(b => b.onclick = () => {
      const p = D.products.find(x => x.id === b.dataset.p);
      if (!p || !p.price) return;
      p.custom === "none" ? addCart({ type: "product", id: p.id, name: p.name, price: p.price }) : openProduct(p);
    });
    document.querySelectorAll("[data-b]").forEach(b => b.onclick = () => { B.box = b.dataset.b; const max = D.boxes.find(x => x.id === B.box).slots; B.items = B.items.slice(0, max); renderStage(); });
    document.querySelectorAll("[data-f]").forEach(b => b.onclick = () => {
      const max = D.boxes.find(x => x.id === B.box).slots, id = b.dataset.f;
      if (B.items.includes(id)) B.items = B.items.filter(x => x !== id);
      else if (B.items.length < max) B.items.push(id); else toast("This box is full — choose a bigger box");
      renderStage();
    });
    document.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { const id = b.dataset.a; B.addons = B.addons.includes(id) ? B.addons.filter(x => x !== id) : [...B.addons, id]; renderStage(); });
    document.querySelectorAll("[data-r]").forEach(b => b.onclick = () => {
      if (b.dataset.r === "own") { B.items = []; } else { const r = D.readyBoxes[+b.dataset.r]; B.box = r.box; B.items = r.items.slice(0, D.boxes.find(x => x.id === r.box).slots); }
      document.querySelectorAll("[data-r]").forEach(x => x.classList.toggle("on", x === b)); renderStage();
    });
    const bt = $("#boxText"); if (bt) bt.oninput = renderStage;
    const ab = $("#addBox"); if (ab) ab.onclick = () => {
      const box = D.boxes.find(b => b.id === B.box);
      if (!B.items.length) return toast("Add at least one item");
      if (B.unpriced) {
        const lines = [`Assalam o Alaikum! I made this gift box on your website:`, `Box: ${box.name} (${box.id})`, ...B.items.map(id => `• ${D.fillers.find(f => f.id === id).name}`),
          ...B.addons.map(id => `• Add-on: ${D.addons.find(a => a.id === id).name}`), bt.value && `Text: ${bt.value}`, `Please tell me the price.`].filter(Boolean);
        location.href = askWa(lines.join("\n")); return;
      }
      addCart({ type: "box", box: box.id, items: [...B.items], addons: [...B.addons], text: bt.value, name: `${box.name} gift box`, price: B.total, detail: [...B.items.map(id => D.fillers.find(f => f.id === id).name), ...B.addons.map(id => D.addons.find(a => a.id === id).name), bt.value && `Text: ${bt.value}`].filter(Boolean).join(", ") });
    };
    document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { const c = store.get(); const [gone] = c.splice(+b.dataset.del, 1); if (gone) delete photos[gone.uid]; store.set(c); route(); });
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
  window.addEventListener("hashchange", route);
  async function load() {
    try {
      const j = await (await fetch(D.api)).json();
      if (!j.ok) throw new Error();
      const c = j.data;
      D.whatsapp = c.settings.whatsapp || D.whatsapp; D.delivery = c.settings.delivery; D.freeAbove = c.settings.freeAbove;
      D.products = c.products; D.boxes = c.boxes; D.fillers = c.fillers; D.addons = c.addons;
      const names = [...new Set(c.products.map(p => p.cat))].sort((a, b) => (D.catOrder.indexOf(a) + 1 || 99) - (D.catOrder.indexOf(b) + 1 || 99));
      D.categories = names.map(n => ({ id: slug(n), name: n, icon: catIcon(n) }));
      ready = true;
      // drop basket items whose price changed or that are gone
      const ok = store.get().filter(i => i.type === "box" || (D.products.find(p => p.id === i.id) || {}).price === i.price);
      if (ok.length !== store.get().length) store.set(ok);
    } catch (e) { loadErr = "We couldn't load our gifts right now. Please refresh, or message us on WhatsApp."; }
    route();
  }
  updCount(); route(); load();
})();
