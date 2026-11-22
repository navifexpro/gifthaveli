/* Gift Haveli site config. The catalogue (products, boxes, builder items, prices, delivery)
   loads live from the Gift Haveli Google Sheet through the Apps Script backend (api). */
window.GH = {
  api: "https://script.google.com/macros/s/AKfycbxpCabGST3AXR906sY_9oh_uphuZdbNuBvRrWw0wOMJ6lUmHNcEjJ7BCGZHq1ZZ05WCJQ/exec",
  whatsapp: "923130111349",
  delivery: 250,
  freeAbove: 0,
  icons: {
    box: '<rect x="8" y="22" width="48" height="34" rx="3"/><path d="M5 22h54M32 22v34M20 22c-6-10 6-14 12 0 6-14 18-10 12 0"/>',
    mug: '<path d="M12 18h30v28a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8z"/><path d="M42 24h6a7 7 0 0 1 0 14h-6"/>',
    frame: '<rect x="12" y="8" width="40" height="48" rx="2"/><rect x="18" y="14" width="28" height="36"/><path d="M20 44l8-10 6 6 4-4 6 8"/>',
    lamp: '<path d="M32 8l14 26H18z"/><path d="M32 34v16M22 56h20"/>',
    flower: '<circle cx="32" cy="18" r="7"/><circle cx="22" cy="26" r="6"/><circle cx="42" cy="26" r="6"/><path d="M24 56l8-22 8 22z"/>',
    ring: '<circle cx="25" cy="38" r="13"/><circle cx="39" cy="38" r="13"/><path d="M25 25l4-9h6l4 9"/>',
    gem: '<path d="M14 24l8-12h20l8 12-18 26z"/><path d="M14 24h36"/>',
    neon: '<path d="M14 40c0-12 8-20 18-20s18 8 18 20"/><path d="M20 48h24"/>',
    clock: '<circle cx="32" cy="32" r="22"/><path d="M32 18v14l10 6"/>',
    shirt: '<path d="M22 10l-12 8 6 10 6-4v30h20V24l6 4 6-10-12-8c-2 4-6 6-10 6s-8-2-10-6z"/>',
    card: '<rect x="10" y="14" width="44" height="36" rx="3"/><path d="M10 18l22 16 22-16"/>',
    star: '<path d="M32 8l7 15 16 2-12 11 3 16-14-8-14 8 3-16L9 25l16-2z"/>',
    case: '<rect x="8" y="22" width="48" height="32" rx="4"/><path d="M24 22v-6h16v6M8 36h48"/>',
    balloon: '<ellipse cx="32" cy="24" rx="13" ry="16"/><path d="M32 40l-3 4h6zM32 44c0 6-4 8-4 14"/>'
  },
  // Sheet category -> icon. Products, boxes and prices come live from the Gift Haveli Google Sheet.
  catIcons: {
    "Gift Boxes & Hampers": "box", "Bouquets": "flower", "Mugs": "mug", "Frames": "frame", "Lamps": "lamp",
    "Wedding & Nikkah": "ring", "Jewellery": "gem", "Neon Signs": "neon", "Wall Decor": "clock", "Clocks": "clock",
    "Mens Gifts": "case", "Apparel": "shirt", "Cushions": "shirt", "Balloon Decor": "balloon", "Cards": "card",
    "Corporate & Awards": "star", "Personal Accessories": "gem"
  },
  catOrder: ["Gift Boxes & Hampers", "Bouquets", "Mugs", "Frames", "Lamps", "Wedding & Nikkah", "Jewellery", "Neon Signs",
    "Wall Decor", "Clocks", "Mens Gifts", "Cushions", "Apparel", "Personal Accessories", "Cards", "Corporate & Awards", "Balloon Decor"],
  // Ready boxes show only when the box and every item have a Sale Price in the sheet.
  readyBoxes: [
    { name: "Birthday Joy", box: "BX-07", items: ["BI-01", "BI-04", "BI-03", "BI-08"] },
    { name: "Forever Love", box: "BX-19", items: ["BI-03", "BI-04", "BI-05", "BI-08"] },
    { name: "For Him", box: "BX-12", items: ["BI-06", "BI-07", "BI-04", "BI-08"] },
    { name: "Eid Mubarak", box: "BX-18", items: ["BI-04", "BI-03", "BI-02", "BI-08"] }
  ],
  products: [], boxes: [], fillers: [], addons: [], categories: []
};
