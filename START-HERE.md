# Sofa Cycle Canada — Launch Checklist

Work top to bottom. **Steps 1–3 are blocking** — don't send this link to a customer until they're done.

---

## 🔴 1. Real contact details — 2 minutes

Open **`js/config.js`**. The first block has three placeholders:

```js
phone:        "+14165550000",       // ⚠️ your real mobile
phoneDisplay: "(416) 555-0000",     // ⚠️ how it looks on the page
email:        "hello@sofacyclecanada.ca", // ⚠️ an inbox you actually read
```

Change them and you're done — every phone link, text button and footer across all
five pages updates automatically.

---

## 🔴 2. Deploy to Netlify — 5 minutes

Forms only work once the site is on Netlify. Locally they'll fail.

1. Go to **app.netlify.com** → *Add new site* → *Deploy manually*
2. Drag this entire folder onto the page
3. Wait ~30 seconds

Netlify reads the hidden form declarations at the bottom of `index.html` and
creates four inboxes automatically:

| Form | What lands there |
|---|---|
| `sofa-reservation` | Sofa claims — name, phone, address, access, payment choice |
| `sofa-waitlist` | People wanting a text when stock matches |
| `sofa-cleaning` | Cleaning bookings with the estimate |
| `sofa-donation` | Donation offers **with the uploaded photos** |

### ⚠️ Turn on notifications or you won't know a lead arrived

*Site settings → Forms → Form notifications → Add notification → Email*

Point it at your real inbox. **Do this immediately.** Without it, submissions sit
in the Netlify dashboard and you'd never know.

### Recommended: instant phone alerts

Email can sit unread for hours. On a $600 sofa, being second to reply loses the
sale. Add a free push notification:

1. Install the **ntfy** app (iOS / Android)
2. Subscribe to a topic only you know, e.g. `sofacycle-a7f3x9`
3. In `js/config.js` set:
   ```js
   alertWebhook: "https://ntfy.sh/sofacycle-a7f3x9",
   ```

Now your phone buzzes the moment someone claims a sofa, with the sofa name,
their name and number, and what's owed. Works with Slack, Discord or Zapier
webhooks too.

If the alert ever fails, the form still reaches Netlify — it can't break a
submission.

### Verifying it works

After deploying, submit each form with your own details, then check
*Netlify → Forms*. All four are already declared with every field mapped:

| Form | Fields captured |
|---|---|
| `sofa-reservation` | 15 — sofa, contact, address, access, payment choice |
| `sofa-waitlist` | 5 — name, phone, area, type wanted, budget |
| `sofa-cleaning` | 10 — contact, address, service, add-ons, estimate |
| `sofa-donation` | 20 — contact, sofa details, disclosures, up to 6 photos |

---

---

## ⚠️ IF FORMS AREN'T WORKING — do these three, in order

**1. Enable form detection**
Netlify → **Forms** → **Enable form detection**.
It's *off by default* on new sites, which is the most common cause.

**2. Set the primary domain**
Netlify → **Site configuration → Domain management** → find
`www.sofacyclecanada.ca` → **Options (⋯) → Set as primary domain**.
Without this the URL bar shows `.netlify.app` instead of your domain.

**3. Redeploy**
Drag the folder onto Netlify again.
**This step is not optional** — enabling form detection only applies to
*new* deploys, never retroactively.

### What was breaking them in the code

The old `netlify.toml` had a catch-all redirect:

```toml
[[redirects]]
  from = "/*"
  to = "/404.html"
  status = 404
```

Netlify Forms submits by POSTing to `/`. That wildcard rule could intercept
the POST and return a 404 before the form handler ever saw it. It's been
removed — Netlify serves `404.html` automatically anyway, so it was doing
nothing useful and actively causing harm.

**Do NOT add domain redirects to `netlify.toml`.** Forcing them there fights
Netlify's own primary-domain redirect and causes an infinite loop
(ERR_TOO_MANY_REDIRECTS) that takes the whole site down. Domain redirects
belong in the UI only: Domain management → Options → Set as primary domain.

---

## 🔴 3. Test every form yourself

Once deployed, submit each one with your own details:

- [ ] Reserve a sofa — try both deposit and pay-in-full
- [ ] Join the waitlist
- [ ] Book a clean
- [ ] Offer a donation **with photos attached**

Check each arrives under *Netlify → Forms*. If one doesn't, tell me which.

---

## 🟡 4. Reviews — do this before promoting the site

The reviews section currently shows an honest "coming soon" message, because
the previous ones were written as examples and were **not real customers**.
Fabricated testimonials breach Canada's Competition Act.

Text your last few buyers and ask for a line. Then in `js/config.js`:

```js
reviews: [
  { stars: 5, text: "Exactly as described, delivered next day.",
    author: "Sarah M.", hood: "North York" },
],
```

Two real ones beat six invented ones.

---

## 🟡 5. Numbers you need to verify

All fabricated figures have been removed. Turn them back on only when true.

**Donation counter** — deliberately replaced with a pledge statement.
A progress bar sitting at "0 of 200" tells visitors nobody buys from you. The
pledge says the same thing without the negative signal. Switch the meter on once
the number is worth showing:
```js
defenseSheetsSold: 0,        // your real count
showDonationMeter: false,    // → true when it's past ~50
```

**The donation claim now reads "Every 200 Defense Sheets packs sold"** — matching
your packaging, and no longer ambiguous with sofas. It also no longer says
*"brand new"*: donating a cleaned preloved sofa is cheaper, matches your
sustainability story, and is what your box actually promises.

**Comparable-new prices** (`rrp` in `js/inventory.js`) — these must be
substantiable with a real, findable listing. The IKEA ones are checkable on
ikea.ca. **The three marked "Sofa Cycle Select" have no `rrp` and should stay
that way** unless you can point to a genuine comparable.

**Dimensions** — I estimated these. Measure them, especially the `fit` value
(doorway clearance), since that's what prevents failed deliveries.

---

## 🟢 6. Square payments — optional, start without it

Right now checkout captures the booking and you arrange payment by text. That
works fine and is how most small resellers start.

To take payment on the site:

1. Square Dashboard → **Payment Links** → create a fixed **$99 "Sofa Deposit"** link
2. Create a fixed **$28 "Defense Sheets"** link
3. Paste both into `js/config.js`:

```js
squareDepositLink: "https://square.link/u/XXXXXXXX",
squareSheetsLink:  "https://square.link/u/YYYYYYYY",
```

Pay-in-full amounts vary per sofa, so those go out as a Square invoice by text.

**A note on payment method:** e-transfer can't be charged back. Card payments can
be disputed for months and used-furniture disputes usually favour the buyer.

---

## 🟢 7. Custom domain

*Netlify → Domain settings → Add custom domain* → `sofacyclecanada.ca`.
HTTPS is automatic. Then update `siteUrl` in `config.js` and the URLs in
`sitemap.xml` if your domain differs.

---

## 🟢 8. Google

Submit `https://yourdomain.ca/sitemap.xml` at
[Google Search Console](https://search.google.com/search-console).

You now have **four separately indexable pages**. `process.html` is your strongest
SEO asset — almost nobody in Toronto's used furniture market writes honestly
about bed bugs, and that's exactly what people search before buying used.

---

## Adding a sofa — use the admin page

Open **`admin.html`** (locally, or at `yoursite.ca/admin.html` once deployed).
Passcode is `sofacycle2025` — change it at the top of the script in that file.

1. Drop in a photo — it resizes and compresses automatically
2. Fill in name, price, the rest
3. **Download update** → you get a zip
4. Copy `js/inventory.js` and anything in `assets/` into your site folder
5. Drag the folder onto Netlify

You can also edit prices, mark things sold, and delete sofas from there.

**About the passcode:** it keeps casual visitors out, but anyone viewing the page
source can read it. That's acceptable because the admin page only *generates
files on your device* — it can't touch your live site. The real protection is
that only you can deploy to Netlify.

If you'd rather have proper login-protected editing that publishes directly,
that needs the site in a GitHub repo with Decap CMS and Netlify Identity. More
setup, and worth it later — not now.

---

## File map

```
index.html      Sofas, waitlist, Defense Sheets, reviews, delivery, FAQ
process.html    8-point inspection + bed bug protocol
cleaning.html   Cleaning service, from $299
donate.html     Donation form with photo upload
privacy.html    PIPEDA + CASL privacy policy

js/config.js    ← contact details, pricing, reviews, Instagram
js/inventory.js ← your sofas
js/app.js       app logic (you shouldn't need to touch this)
css/style.css   all styling
assets/         images (.jpg + .webp)
netlify.toml    caching, security headers, pretty URLs
```

---

## What changed from the old single file

- **1,690 KB → 143 KB** initial load
- One page → **five indexable pages**
- Forms that discarded data → **forms that reach your inbox**
- Fabricated reviews and stats → **removed**
- No privacy policy → **PIPEDA/CASL compliant policy**
- Editing HTML to add a sofa → **editing one data file**
