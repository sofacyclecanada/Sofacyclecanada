# Square Setup — Sofa Cycle + Scooped It, One Login

Two problems to solve: keeping the businesses separate without juggling
logins, and handling a different price on every couch.

---

## Part 1 — Both businesses, one login

Use **Locations**, not two accounts.

One Square account can hold multiple Locations. Each Location gets:

- Its own **business name** — customers see "Sofa Cycle Canada" on their card
  statement and receipt, not "Scooped It"
- Its own **bank account** for payouts, so the money lands separately
- Its own **logo and receipt branding**
- **Separate reporting** — you can view either business on its own, or both
  side by side
- Even a **different EIN / business number**, if they're registered separately

All from one email and password.

### Setting it up

1. Square Dashboard → **Settings → Account & Settings → Business → Locations**
2. **Create location**
3. Name it **Sofa Cycle Canada**
4. Set its address, phone, time zone and business hours
5. Under **Bank account**, choose or add the account for sofa money
6. Upload the Sofa Cycle logo so receipts and payment pages look right
7. Save

Every payment link you create afterwards asks which Location it belongs to.
Pick Sofa Cycle and the money, the branding and the reporting all stay separate.

### Two caveats, so nothing surprises you

**The Point of Sale app is clumsier than the Dashboard.** If you use the POS
app to take a card in person, you have to sign out and back in to switch
Locations. The Dashboard doesn't have this problem — it shows everything at
once. Since you'll mostly be sending links, this rarely comes up.

**Square's own staff suggest separate accounts for genuinely different
businesses.** Locations were designed for one business with several
storefronts. It works fine for two businesses and thousands of people use it
that way, but if the two ever need genuinely independent tax handling, a
second account is the cleaner long-term answer. For now, one login is worth
more to you than that separation.

---

## Part 2 — Different price on every couch

You need **three links**, not one per sofa.

### Link A — Sofa Deposit ($99, fixed)

Payments & orders → **Payment links** → Create link → **Collect a payment**

- Title: `Sofa Deposit — Sofa Cycle Canada`
- Amount: **$99**
- Location: **Sofa Cycle Canada**
- Advanced → **Custom fields** → add one called `Which sofa?`

This one link works for every couch, because the deposit never changes.
Paste it into `js/config.js` as `squareDeposit`.

### Link B — Pay Balance (buyer enters the amount)

Create link → **Collect a payment** → tick **"Allow buyer to set the price"**

- Title: `Pay Your Balance — Sofa Cycle Canada`
- Advanced → **Custom fields** → add `Which sofa?`

This is the one that solves your variable pricing. You text the customer
"your balance is $476, here's the link" and they enter it. One link, every
sofa, forever. Paste it as `squareBalance`.

### Link C — Defense Sheets ($28, fixed)

Create link → **Sell an item** → $28. Paste it as `squareSheets`.

### Optional: a fixed link per sofa

Buyer-entered amounts can be typed wrong. With only four sofas, you can make
one fixed link each and remove the risk. Add it to the sofa in
`js/inventory.js`:

```js
{
  id: 1, name: "Blue Structube Sectional", price: 675,
  payLink: "https://square.link/u/XXXXXXXX",   // ← pay-in-full link
  ...
}
```

The site uses that link when someone chooses pay-in-full, and falls back to
the buyer-entered Balance link for any sofa without one.

---

## Part 3 — The fee, and why it changes your discount

Square online links cost **3.3% + 30¢**.

| | You collect | Square takes | You keep |
|---|---|---|---|
| $99 deposit | $99 | $3.57 | **$95.43** |
| $600 in full | $600 | $20.10 | **$579.90** |
| $476 balance | $476 | $16.01 | **$459.99** |

**Cash or e-transfer costs you nothing.** E-transfer also can't be charged
back, while a card payment can be disputed for months — and used-furniture
disputes usually go the buyer's way.

### This matters for your pay-in-full discount

Right now pay-in-full gives $25 off. If they pay by card:

```
$600 sofa
−$25  discount
−$20  Square fee
= $555 kept   (vs $596 if they deposit online and pay cash on delivery)
```

**That's $41 off a $600 sale.** You're paying twice for the same convenience.

Three options:

1. **Cut the discount to $15.** Still an incentive, roughly covers the fee.
2. **Only discount e-transfer.** "Pay in full by e-transfer and save $25" —
   costs you nothing, and e-transfers can't be reversed.
3. **Leave it.** Zero no-show risk is worth $41 if your no-show rate is bad.

My recommendation: **option 2.** You keep the full incentive, pay no fee, and
get an irreversible payment. Say the word and I'll reword the checkout.

---

## The workflow once it's live

1. Customer claims a sofa on the site → form lands in your Netlify inbox
2. You text them the **$99 deposit link** → sofa is held
3. Delivery day → they pay the balance in cash or e-transfer
4. If they'd rather pay ahead, send the **Balance link** with the amount

Deposits go through Square because that's what protects the hold. Balances
stay in cash where the margin is.
