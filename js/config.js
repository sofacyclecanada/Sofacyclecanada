/* ══════════════════════════════════════════════════════════════════════
   SOFA CYCLE CANADA — SETTINGS
   Everything you'll ever need to change lives in this one file.
   ══════════════════════════════════════════════════════════════════════ */

const CONFIG = {

  /* ── 1. CONTACT ─────────────────────────────────────────────────────
     Leave phone or email blank to hide those links sitewide. */
  phone:        "+16478073072",
  phoneDisplay: "(647) 807-3072",
  email:        "carringtonchairs@gmail.com",
  instagram:    "https://www.instagram.com/sofacyclecanada",
  facebook:     "https://www.facebook.com/sofacyclecanada",
  siteUrl:      "https://www.sofacyclecanada.ca",


  /* ── 2. PRICING ─────────────────────────────────────────────────────
     ⚠️ Past $30,000 revenue over four quarters you MUST register for
     GST/HST with CRA. Update this line if that changes. */
  taxNote: "No tax — the price you see is the price you pay.",

  deposit:        99,
  payInFullSaves: 25,   // e-transfer only (no Square fee, no chargebacks)


  /* ── 3. SQUARE PAYMENT LINKS ──────────────────────────────────────── */
  squareDeposit: "https://square.link/u/0YWKpnkC?src=sheet",
  squareBalance: "https://square.link/u/8BTNoBOL?src=sheet",
  squareSheets:  "https://square.link/u/LHxesdZ9?src=sheet",



  /* ── 5. TRUST CLAIMS — only switch on what you can prove ──────────── */
  showTrustStats: false,
  sofasRehomed:   "",
  rejectionRate:  "",
  pestReports:    "",


  /* ── 6. RECENTLY REHOMED — real deliveries only. Empty = hidden. ──── */
  recentlyRehomed: [
    // ["3-Seater Sofa", "East York", "2 days ago"],
  ],


  /* ── 7. REVIEWS ─────────────────────────────────────────────────────
     ⚠️ ONLY real customers. Fabricated testimonials breach Canada's
     Competition Act. Empty shows an honest "coming soon" state. */
  reviews: [
    { stars: 5,
      text: "Great experience, was super quick in communication and was able to have it at my place by the very next day! Would highly recommend",
      author: "Savannah", hood: "Marketplace review · Aug 2025" },
    { stars: 5,
      text: "So accommodating and delivered the couch the same day, assembled it for me, and even helped me get rid of some old chairs I had. Made sure I loved the placement of the couch. Highly recommend — you will not be disappointed.",
      author: "Sam", hood: "Marketplace review · Jun 2025" },
  ],


  /* ── 8. INSTAGRAM — open a post → ⋯ → Copy link → paste below ─────── */
  instagramPosts: [
  ],


  /* ── 8b. INSTANT ALERTS (recommended) ────────────────────────────────
     Netlify emails you, but email sits unread. Free push option:
     install ntfy.sh, pick a secret topic, then set:
        alertWebhook: "https://ntfy.sh/your-secret-topic"           */
  alertWebhook: "",


  /* ── 8c. AFTERPAY ───────────────────────────────────────────────────
     Turn on in Square: Settings → Account & Settings → Payments →
     Payment methods → Afterpay → ••• → Edit settings → toggle Online.
     ⚠️ Charged at Square's Afterpay rate (higher than standard card).
     LOGO: download the official badge from Afterpay's merchant resources,
     save as assets/afterpay-logo.png, then set `logo` below. */
  afterpay: {
    enabled: true,
    logo: "",
    minOrder: 1,
    maxOrder: 2000,
    instalments: 4
  },


  /* ── 8d. ADDRESS AUTOCOMPLETE — no API key needed ──────────────────── */
  addressProvider: "photon",
  googlePlacesKey: "",
  addressBiasLat: 43.6532,
  addressBiasLon: -79.3832,


  /* ── 9. DELIVERY ─────────────────────────────────────────────────────
     We deliver across the whole GTA. Free inside `freeRadiusKm` of the
     facility; beyond that a distance-based fee from `deliveryFeeFrom`.

     Pick an address from the autocomplete and we use real coordinates to
     work out the exact distance. Postal code alone falls back to prefixes. */
  deliveryBase:    { lat: 43.6889, lon: -79.3018, label: "our facility" },
  freeRadiusKm:    10,
  deliveryFeeFrom: 50,

  /* The full area we serve — shown as chips on the home page */
  serviceAreas: [
    "Toronto", "East York", "Scarborough", "North York",
    "Etobicoke", "Mississauga", "Brampton", "Markham", "Vaughan", "Richmond Hill"
  ],

  /* Postal prefixes inside the free radius (fallback when no coordinates) */
  freePostalPrefixes: ["M4", "M5"],


  /* ── 10. FAQ — edit freely; these also feed Google's FAQ rich result ── */
  faqs: [
    ["How does the $99 deposit work?",
     "Your $99 deposit holds the sofa so nobody else can claim it while we arrange delivery. The balance is due on delivery day — cash or e-transfer. It's non-refundable, but fully transferable: if you change your mind, put it toward any other sofa we have."],

    ["Do you offer Afterpay?",
     "Yes — pay in 4 interest-free instalments over 6 weeks. Choose Afterpay when you reach the Square checkout page. It's available on anything up to $2,000, so every sofa we sell qualifies. Approval is instant and there's no interest if you pay on schedule."],

    ["Can I just pay the whole thing up front?",
     "Yes — pay in full by e-transfer and we'll take $25 off. It saves you money, saves us admin on delivery day, and there's nothing to sort out when we arrive."],

    ["Is the deposit refundable?",
     "It's non-refundable but fully transferable — if you change your mind, we'll put it toward any other sofa in our inventory, no time limit. The one exception: if the sofa doesn't match its listing when we arrive, you don't take it and we refund the deposit in full."],

    ["How fast do you reply?",
     "Usually within the hour during the day, and always the same day. If you haven't heard from us by the next morning, text again — something went wrong on our end and we want to know."],

    ["Do I pay tax on top?",
     "No. The price you see is the price you pay. No tax and no stair charge. Delivery is free inside 10 km; beyond that there's a distance-based fee from $50."],

    ["Where do you deliver, and what does it cost?",
     "We deliver across the whole GTA. It's free within 10 km of our facility — that covers The Beaches, East York, Leslieville, Riverdale, downtown and midtown. Beyond 10 km there's a distance-based delivery fee starting at $50. Type your address at checkout and the site tells you exactly how far you are and what it costs. No stair fee, no fuel surcharge, no surprises."],

    ["Are the sofas actually cleaned?",
     "Every single one. We inspect and clean each piece before it's listed and check it again before delivery. If something has a flaw, we photograph it and write it into the listing."],

    ["What about bed bugs?",
     "Fair question, and the reason we built our whole process around it. Every sofa gets a seam-by-seam inspection under bright light at the pickup address before it ever goes in the van, and we walk away from any home showing signs of an issue. Full detail is on our Process page."],

    ["What exactly are Defense Sheets?",
     "Clear self-adhesive protector sheets that stick flat on sofa arms, walls, chair legs or bed frame corners. Your cat scratches the sheet instead of the fabric. 12 sheets per pack, and they peel off cleanly with no residue."],

    ["Will it fit through my door?",
     "Text us three numbers — your narrowest doorway width, stairwell width, and ceiling height at the tightest turn — and we'll tell you honestly which sofas will make it in. Free, no obligation. We'd rather lose a sale than a Saturday."],

    ["Can I see the sofa before I commit?",
     "Absolutely. Text us and we'll send extra photos or a video walkaround of any piece. If you'd rather view it in person, we can arrange that too."],

  ]
};

if (typeof module !== "undefined") module.exports = CONFIG;
