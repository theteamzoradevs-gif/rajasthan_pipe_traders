# WhatsApp Quotation Delivery — DoubleTick Setup Guide

This guide explains, in simple language, how to make the **"Place Order → PDF on WhatsApp"** feature actually work.

After a customer places an order in the cart:

1. The website saves the order to the database.
2. The website generates the quotation PDF in the browser.
3. The website sends the PDF to our server (`/api/whatsapp/send-quotation`).
4. Our server uploads the PDF to **DoubleTick** and asks DoubleTick to send it to the customer's WhatsApp using a **Meta-approved template**.

Steps 1 and 2 already work. Step 4 will only work after you finish the dashboard setup below.

---

## Why a "template" message?

WhatsApp has a rule called the **24-hour customer service window**:

- A business can only send free-form messages (plain text, document, image, etc.) within 24 hours of the customer's last message to the business.
- After that window closes, WhatsApp blocks free-form messages.
- The **only** type of message a business can send anytime is a **pre-approved template** (HSM).

Our customers won't have messaged us first when they place an order, so we **must** use a template.

The error you saw earlier — *"Chat window is closed. To send message to closed window please send template message"* — was WhatsApp enforcing this rule.

---

## Part 1 — DoubleTick Dashboard (do this once)

You only need to do this **one time** per template. After it's approved, your code will keep working forever (unless Meta revokes the template, which is rare).

### Step 1.1 — Log in to DoubleTick

Open your browser and go to **https://app.doubletick.io** (or whichever URL your DoubleTick account uses).

Log in with the account that owns the WhatsApp Business number `+91 9327071674`.

### Step 1.2 — Make sure your WhatsApp number is connected

1. Click **Settings** (or **Channels**) in the sidebar.
2. Find your WhatsApp number `+91 9327071674`.
3. Confirm the status says **Connected** / **Live** / **Active**.

If it's not connected, **fix this first** — you cannot create a template without a connected number.

### Step 1.3 — Open the Templates section

1. In the left sidebar, click **Templates** (sometimes called **Message Templates** or **WhatsApp Templates**).
2. Click the **+ Create Template** (or **New Template**) button.

### Step 1.4 — Fill in the template basics

| Field | What to enter | Why |
|---|---|---|
| **Template Name** | `quotation_ready` | Must match `DOUBLETICK_TEMPLATE_NAME` in `.env.local`. Use only lowercase letters, digits and underscores — no spaces, no capital letters. |
| **Category** | **Utility** | This is an order/transaction notification, not advertising. **Do not pick "Marketing"** — it has stricter rules. |
| **Language** | **English (en)** | Must match `DOUBLETICK_TEMPLATE_LANGUAGE` in `.env.local`. |
| **WABA Number / Sender** | `+91 9327071674` | The number the message is sent from. |

### Step 1.5 — Configure the **Header** (the PDF attachment)

This is the most important part — this is what makes the PDF appear at the top of the WhatsApp message.

1. Find the **Header** section.
2. Set the **Type** / **Format** to **DOCUMENT**.
3. The dashboard will ask for a **sample PDF** for Meta's review.
   - Upload **any blank or sample PDF** (for example, generate a single test quotation from your own site and use that file). It just needs to look like a real document.
   - This sample is **only for Meta's review** — it is **not** what will be sent to customers later. Our code replaces it at runtime with each order's actual PDF.

### Step 1.6 — Configure the **Body** (the message text)

Paste the body **exactly** like this:

```
Hi {{1}}, thank you for your order with Rajasthan Pipe Traders.

Please find your quotation ({{2}}) attached.

For any questions, reply to this message or call us on 9313386488.
```

The `{{1}}` and `{{2}}` are placeholders our code fills in:

| Placeholder | What our code sends |
|---|---|
| `{{1}}` | Customer's full name (e.g. `Rahul Kumar`) |
| `{{2}}` | Quotation serial number (e.g. `QT-001`) |

The dashboard will ask for **sample values** for the placeholders. Enter:

- `{{1}}` → `Rahul`
- `{{2}}` → `QT-001`

> **Important:** The order must be `{{1}}` then `{{2}}`. If you swap them, the message will say "Hi QT-001, your quotation (Rahul Kumar) is attached" 😅 — which is wrong.

### Step 1.7 — Footer (optional)

If you want to add a small footer (no placeholders, just plain text), use:

```
Rajasthan Pipe Traders
```

This is purely cosmetic. **Skip this if you're not sure** — adding it doesn't change anything in code.

### Step 1.8 — Buttons (optional, recommended: skip)

You can skip buttons entirely. We don't need them for sending the PDF.

If you really want a "Visit Website" button:
- Type: **URL**
- Text: `Visit Website`
- URL: `https://your-site.example/` (a fixed URL with no `{{1}}` placeholder)

> If you add a button **with a placeholder** like `https://site.com/order/{{1}}`, you'll need a small code change (see Part 3, scenario D below).

### Step 1.9 — Submit for Meta approval

1. Click **Submit** / **Send for Review**.
2. Status will be **PENDING**.
3. Meta usually approves Utility templates within a few minutes to a few hours (sometimes up to 24h).
4. Wait until the status flips to **APPROVED**.

If it gets **REJECTED**:

- The dashboard will show a reason (usually wording-related).
- Common fixes: avoid words like "Free!", "Buy now", "Limited offer" (those are marketing); don't use ALL CAPS; keep punctuation calm.
- Edit the template text and resubmit.

---

## Part 2 — After approval (the easy part)

Once your template status is **APPROVED**, do these checks:

### Step 2.1 — Verify your `.env.local`

Open `.env.local` in the project root. It should contain:

```env
DOUBLETICK_API_KEY=key_4uNa2NGM... (your full key)
DOUBLETICK_SENDER_NUMBER=919327071674
DOUBLETICK_TEMPLATE_NAME=quotation_ready
DOUBLETICK_TEMPLATE_LANGUAGE=en
```

Compare each value letter-by-letter against the dashboard:

- `DOUBLETICK_TEMPLATE_NAME` must match the **Template Name** column on the dashboard exactly (case-sensitive).
- `DOUBLETICK_TEMPLATE_LANGUAGE` must match the **Language code** exactly. Watch out — `en` and `en_US` are different!

### Step 2.2 — Restart the server

Environment variables are only loaded when the Next.js server starts.

In your terminal, stop the dev server (`Ctrl + C`) and start it again:

```bash
npm run dev
```

For production (Vercel): redeploy after changing env vars.

### Step 2.3 — Test with a real order

1. Open the website on your phone (or any device).
2. Add some products to the cart and click **Place Order**.
3. In the modal, enter **your own** WhatsApp number as the customer phone (10 digits, no `+91`).
4. Submit the form.
5. Wait about 5–10 seconds — the PDF should arrive on your WhatsApp.

If it doesn't arrive, check:

- The terminal log for errors (search for `ERROR_2366327071`).
- The DoubleTick dashboard's **Logs / Conversations** section for the outbound message status.

That's it. **No code changes needed** if the template matches the shape we coded for (name, language, DOCUMENT header, 2 body placeholders).

---

## Part 3 — When you DO need to change code

You only need to edit code if your **approved template differs** from the one we designed for.

The only file you'll touch is:

```
app/api/whatsapp/send-quotation/route.ts
```

…specifically the call to `sendTemplateMessage` near the bottom of the `POST` handler.

### Scenario A — You picked a different template name or language

**No code change.** Just update `.env.local` and restart the server:

```env
DOUBLETICK_TEMPLATE_NAME=my_other_template_name
DOUBLETICK_TEMPLATE_LANGUAGE=en_US
```

### Scenario B — Your template has **no header** (no PDF attached)

This skips uploading the PDF entirely.

Open `app/api/whatsapp/send-quotation/route.ts`. Find this section near the bottom:

```ts
const mediaUrl = await uploadToDoubleTick(apiKey, pdfBlob, filename);

await sendTemplateMessage({
  apiKey,
  senderNumber: sender,
  customerNumber,
  templateName,
  language: templateLanguage,
  bodyPlaceholders: [displayName, safeSerial],
  documentHeader: { mediaUrl, filename },
});
```

Replace it with:

```ts
await sendTemplateMessage({
  apiKey,
  senderNumber: sender,
  customerNumber,
  templateName,
  language: templateLanguage,
  bodyPlaceholders: [displayName, safeSerial],
});
```

(We removed the upload step and the `documentHeader` argument.)

### Scenario C — Your template body uses a **different number of placeholders**

For example, if your body is:

```
Hi {{1}}, your order ({{2}}) for ₹{{3}} is ready.
```

You need to send 3 values instead of 2.

Find this line:

```ts
bodyPlaceholders: [displayName, safeSerial],
```

Change it to:

```ts
bodyPlaceholders: [displayName, safeSerial, String(totalPrice)],
```

You'll also need to send `totalPrice` from the client (`QuotationDetailsModal.tsx`) and read it server-side (similar to how `serialNo` is handled today).

If you only have **one** placeholder:

```ts
bodyPlaceholders: [displayName],
```

The number of values in this array **must match exactly** the number of `{{n}}` in your approved body. Mismatches cause DoubleTick to return an error.

### Scenario D — Your template has a **dynamic URL button**

For example, the URL is `https://rajasthanpipe.com/orders/{{1}}` and you want to put the order ID in there.

In `app/api/whatsapp/send-quotation/route.ts`, find the `sendTemplateMessage` function and add this just before the `fetch` call (right after the `if (args.documentHeader)` block):

```ts
templateData.buttons = [{ type: "URL", parameter: orderIdForButton }];
```

You'll need to thread `orderIdForButton` through the function signature and the caller. If this is something you actually need, ask your developer to wire it up — it's a small change.

---

## Part 4 — Troubleshooting

### "Chat window is closed" error returns

You're probably sending free-form (`/whatsapp/message/document`) again. Confirm:

- The code is calling `/whatsapp/message/template` (search for `TEMPLATE_PATH` in the route file).
- The template is **APPROVED**, not Pending or Rejected.
- The `templateName` env var matches the dashboard exactly.

### "Template not found" error

- The template name in `.env.local` doesn't match the dashboard. Compare letter-by-letter.
- The language code doesn't match. `en` ≠ `en_US`.
- The template is approved on a **different WABA number** than the one in `DOUBLETICK_SENDER_NUMBER`. Each WABA has its own template list.

### Message sent successfully but no PDF visible on WhatsApp

- Your template's **Header type** isn't set to **DOCUMENT**. Check the dashboard.
- Or the upload step failed silently. Check the server terminal logs.

### Customer phone format errors

- Our code automatically prefixes 10-digit Indian numbers with `91`.
- If a customer enters a non-Indian number, they need to enter the full international number with country code (no `+`).

### Need to change template content later

- Templates can be edited but **must be re-approved** by Meta.
- After re-approval, just wait a couple of minutes — no code change needed if the structure (placeholders, header type) hasn't changed.

---

## Summary checklist

Use this short list whenever you set up a new environment (dev, staging, production):

- [ ] DoubleTick account has `+91 9327071674` connected and live
- [ ] Template `quotation_ready` exists, **Utility** category, language `en`
- [ ] Header type = **DOCUMENT** with a sample PDF uploaded
- [ ] Body has exactly `{{1}}` (name) and `{{2}}` (serial) placeholders
- [ ] Template status = **APPROVED**
- [ ] `.env.local` has `DOUBLETICK_API_KEY`, `DOUBLETICK_SENDER_NUMBER`, `DOUBLETICK_TEMPLATE_NAME`, `DOUBLETICK_TEMPLATE_LANGUAGE`
- [ ] Server restarted / app redeployed after env changes
- [ ] Test order placed → PDF arrives on WhatsApp ✅
