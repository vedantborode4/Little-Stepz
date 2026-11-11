# Little Stepz CRM — User Manual

This guide explains how to use the Little Stepz CRM, step by step, in plain language. It is for everyone who works in the shop: the owner, cashiers and the operations (stock and shipping) team.

> **Words in "quotes"** are the exact names of buttons, fields and menus you will see on screen.

---

## Contents

1. [Before you start](#1-before-you-start)
2. [Signing in and your password](#2-signing-in-and-your-password)
3. [Finding your way around](#3-finding-your-way-around)
4. [First-time setup (Admin)](#4-first-time-setup-admin)
5. [A normal day in the shop](#5-a-normal-day-in-the-shop)
6. [Dashboard](#6-dashboard)
7. [POS — selling at the counter](#7-pos--selling-at-the-counter)
8. [Sales Orders — delivery and counter orders](#8-sales-orders--delivery-and-counter-orders)
9. [Pre-orders](#9-pre-orders)
10. [Customers](#10-customers)
11. [Payments](#11-payments)
12. [Returns](#12-returns)
13. [Shipping](#13-shipping)
14. [Products](#14-products)
15. [Inventory (stock)](#15-inventory-stock)
16. [Purchases and suppliers](#16-purchases-and-suppliers)
17. [Stock Counts](#17-stock-counts)
18. [Cash Closing](#18-cash-closing)
19. [Expenses](#19-expenses)
20. [Profit & Analytics](#20-profit--analytics)
21. [Reports](#21-reports)
22. [Import Data (spreadsheets)](#22-import-data-spreadsheets)
23. [Variant Mapping and the website](#23-variant-mapping-and-the-website)
24. [Settings](#24-settings)
25. [Audit History](#25-audit-history)
26. [How to fix mistakes](#26-how-to-fix-mistakes)
27. [Common messages and what to do](#27-common-messages-and-what-to-do)
28. [Words used in the CRM](#28-words-used-in-the-crm)

---

## 1. Before you start

### What the CRM is

The CRM is the shop's private back-office system. It keeps track of:

- products, prices and stock in the Store and the Godown
- sales at the counter (POS), delivery orders and pre-orders
- customers, payments, customer credit and money still owed
- returns, courier shipments, expenses and the daily cash count
- profit and reports

It is **separate from the website (littlestepz.in)**. Nothing you do in the CRM changes the website.

### Three golden rules

1. **Nothing is ever deleted.** Money and stock records are permanent. A mistake is fixed by a *correcting entry* (a void, a reversal or a return), never by editing or deleting. See [How to fix mistakes](#26-how-to-fix-mistakes).
2. **A sale counts only when the goods leave.** Money taken before that is an *advance*, not a sale.
3. **Stock can never go below zero.** If the CRM says there isn't enough stock, check the stock before you continue.

### Who can do what

Every user has one of three roles. The menu only shows what your role is allowed to use. If you open a page you can't use, you see **"You don't have access to this page — Ask an admin if you need it."**

| Area | Admin (owner) | Cashier | Operations |
|---|:-:|:-:|:-:|
| Dashboard | ✓ | ✓ | ✓ |
| POS, new orders, new pre-orders | ✓ | ✓ | – |
| Record payments, use customer credit | ✓ | ✓ | – |
| Add and edit customers | ✓ | ✓ | – |
| Pack, dispatch, deliver, shipping | ✓ | – | ✓ |
| Allocate stock to pre-orders | ✓ | ✓ | ✓ |
| Transfers and status changes of stock | ✓ | – | ✓ |
| Receive purchases | ✓ | – | ✓ |
| Count stock | ✓ | – | ✓ |
| Cash Closing | ✓ | ✓ | – |
| Reports | ✓ | ✓ (no cost or profit) | – |
| Cancel orders, returns, refunds, voids | ✓ | – | – |
| Set a manual price, customer prices | ✓ | – | – |
| Products, prices, purchases, suppliers | ✓ | view only | view only (no costs) |
| Expenses, Profit & Analytics | ✓ | – | – |
| Pick the salesperson on a sale | ✓ | ✓ | – |
| Salespeople, commission rates, commission and payouts | ✓ | – | – |
| Opening stock, write-offs, adjustments | ✓ | – | – |
| Approve stock counts | ✓ | – | – |
| Settings, users, import, audit | ✓ | – | – |

**Cashiers and Operations never see costs or profit.**

---

## 2. Signing in and your password

### Sign in

1. Open the CRM address in your browser.
2. Enter your **"Email"** and **"Password"**.
3. Click **"Sign in"**.

### First sign-in: set your own password

Your Admin gives you a temporary password. The first time you sign in, the CRM asks you to replace it.

1. On **"Set your password"**, enter the **"Temporary password"**.
2. Enter a **"New password"**: at least 10 characters, with at least one letter and one number.
3. Click **"Save password"**.

You can't open any other page until this is done.

### Change your password later

There is no menu link for this. Type **/change-password** at the end of the CRM address in your browser.

1. Enter your **"Current password"** and your **"New password"**.
2. Click **"Save password"**.

Your other devices will be signed out.

### Forgot your password?

There is no "Forgot password" link. Ask an Admin to reset it (see [Users & roles](#users--roles)). You'll get a new temporary password.

### Locked out?

After **5 wrong passwords in a row**, the account is locked for **15 minutes** ("Too many failed attempts. Try again after 15 minutes."). Wait, or ask an Admin to reset your password, which also unlocks the account.

### Sign out

Click **"Sign out"** at the bottom of the left menu. On a phone, open **"More"** first.

---

## 3. Finding your way around

### The menu

On a computer, the menu is on the left. It is grouped into:

- **Dashboard**
- **Sell:** POS, Sales Orders, Pre-orders, Customers, Payments
- **Catalog:** Products, Variant Mapping
- **Stock:** Inventory, Purchases, Stock Counts
- **Fulfilment:** Shipping, Returns
- **Finance:** Cash Closing, Expenses, Profit & Analytics, Reports
- **Admin:** Settings, Import Data, Audit History

On a phone, a bar at the bottom shows **"Home"**, **"POS"**, **"Stock"**, **"Customers"** and **"More"**. "More" (or the ☰ button at the top) opens the full menu.

### Light or dark screen

Click the moon/sun icon next to "Sign out" (or at the top on a phone) to switch between light and dark mode.

### Lists work the same everywhere

- **Search box** at the top. Click the "x" to clear it.
- **Filters** (drop-downs and dates) next to the search box.
- **"Columns"** shows or hides columns.
- **"CSV"** and **"Excel"** download the list as a file.
- **"Previous page" / "Next page"** move through long lists.
- **Click a row** to open that record.

In pop-up windows, **"Cancel"**, **"Back"** or the **X** closes the window without saving.

---

## 4. First-time setup (Admin)

Do these once, in this order, before the shop starts using the CRM. The Dashboard shows a **"Finish setting up"** card until the first three are done.

1. **Business profile:** Settings → "Business". The trade name and footer are printed on receipts, and the GST state decides how tax is split. [How](#business)
2. **Stock locations:** Settings → "Locations", for example Store and Godown. [How](#locations)
3. **Receiving accounts:** Settings → "Receiving accounts". Add every place money lands: cash drawer, PhonePe, bank and so on. [How](#receiving-accounts)
4. **Couriers:** Settings → "Couriers", with tracking links. [How](#couriers)
5. **Users:** Settings → "Users & roles". Add your cashiers and operations staff. [How](#users--roles)
6. **Expense categories:** Expenses → "Categories". Check the starting list. [How](#categories-of-expenses)
7. **Products:** add them by hand ([Products](#14-products)) or bring them in from a spreadsheet ([Import Data](#22-import-data-spreadsheets)).
8. **Opening stock:** count what you have and record it ([Opening stock](#record-opening-stock-admin)), or import it.
9. **Customers:** optional. Add them by hand or import them.
10. **Supplier balances:** optional. Record what each supplier holds or what you owe ([Supplier ledger](#supplier-ledger-money-with-a-supplier)).

---

## 5. A normal day in the shop

**Morning (Cashier)**
1. Go to **Cash Closing**, choose the cash drawer and click **"Open the day"** with the cash in the drawer.

**During the day**
- **Cashier:** ring up walk-in sales in **POS**. Take WhatsApp/Instagram orders as **Sales Orders**. Record payments that come in.
- **Operations:** pack and dispatch delivery orders in **Shipping**. Update courier status. Receive purchases when goods arrive.
- **Admin:** handle returns, refunds, cancellations and expenses.

**Evening (Cashier)**
1. Count the cash in the drawer.
2. Go to **Cash Closing**, enter **"Counted cash"** and click **"Close the day"**.

**Regularly (Admin)**
- Check **Payments → Outstanding** for customers who owe money.
- Check **Pre-orders** when new stock arrives.
- Run a **Stock Count** on one shelf or category at a time.
- Look at **Profit & Analytics** and **Reports**.

---

## 6. Dashboard

**Menu:** "Dashboard" (on phones: "Home"). Everyone can see it, but each role sees different blocks.

The Dashboard is a summary page. It shows:

- **Sales:** "Today", "Yesterday", "This month" and "Lifetime", with and without GST. It also splits this month's sales into retail vs wholesale and store vs online.
- **Payments** (Admin and Cashier): "Collected today", "Gateway today", "Advances held" and "Outstanding". Click a card to open the details.
- **Profit** (Admin only): "Gross profit", "Contribution profit", "Discounts given" and "Potential profit".
- **Inventory:** "Products", "Available units" and "Purchased / sold". Admins also see "Stock cost value"; others see "Low / out of stock".
- **Charts:** "Sales, last 30 days", "Collections this month", "Top products this month" and "Category mix this month".
- **"Customers & shipping":** customers, repeat buyers, orders waiting to ship, in transit, delivered, and returns.

**To focus on one category or product**, use the **"Category"** and **"Product"** filters at the top right. Headline sales, payments and customer figures always show the whole business.

> Sales count when an order is **handed over or dispatched**. Money on orders that haven't left yet is shown as **advances**.

---

## 7. POS — selling at the counter

**Menu:** Sell → "POS". For Admin and Cashier.

POS (Point of Sale) is for customers standing in the shop. When you complete a POS sale, the CRM does three things at once: it records the sale, takes the items out of stock and records the payment.

### Ring up a sale

1. **Add items.** Type the product name or SKU in **"Search item by name or SKU, then Enter"**.
   - Click a result, or press Enter to add the first match.
   - Each result shows the price and how many are free ("N free" or "Out of stock").
   - Adding the same item again adds 1 to its quantity.
2. **Check the location.** If you have more than one location, choose where the stock comes from in the drop-down next to the search box. The Store is listed first.
3. **Change quantities.** Use **−** and **+**, or type the number.
4. **Give a discount on one item** (optional): type the amount in **"₹ off"** on that line.
5. **Change the price** (Admin only): type it in **"Set price"**. Cashiers use discounts instead.
6. **Remove an item:** click the bin icon.

> A badge next to a price tells you why it isn't the regular price: "Customer price", "Quantity price", "Wholesale", "Offer" or "Manual price". The CRM picks the right price automatically.

### Choose the customer (or leave it as walk-in)

- **Walk-in:** leave the customer box empty.
- **Known customer:** type their mobile (full number or last 4 digits), name, code or city in **"Walk-in, or search mobile / name"** and pick them.
- **New customer:** click the person-plus icon ("Add new customer"), or choose **"Add "…" as a new customer"**. Fill the form and save. The new customer is picked for this sale.
- **Remove the customer:** click the X on their card.

Also check:
- **"Channel":** normally "Store (walk-in)". Change it if the sale came through Website, WhatsApp, Instagram, Facebook, Wholesale or Other.
- **"Bill discount (₹)":** a discount on the whole bill.

The **totals box** shows the subtotal, discounts, total and the GST included.

### Take payment

1. Click **"Checkout ₹…"**. It stays greyed out while the cart is empty or an item doesn't have enough stock.
2. The **"Complete sale"** window opens.
3. **Customer credit** (if the customer has some): click **"Use max"** or type an amount under **"Use customer credit"**. This is used first.
4. **Click a payment button** for how the customer paid, for example Cash or PhonePe. A payment row appears, filled with the amount still owed.
   - **Split payment:** click a second button (e.g. half cash, half PhonePe) and adjust the amounts.
   - For UPI or bank, type the reference in **"Ref / UTR"**.
5. Read the status line:
   - **"Fully paid"**: you can finish.
   - **"Still to pay ₹…"**:
     - Walk-in customers **must pay in full**.
     - A known customer may pay later. The rest stays on their account as money due. Their credit days and credit limit must allow it.
   - **"More than the total ₹…"**:
     - With a known customer, tick **"Keep ₹… as the customer's credit"**.
     - With a walk-in, enter **what was kept, not the cash handed over**. Change given back is not recorded.
6. Click **"Complete ₹…"**.

### Pick the salesperson

If salespeople are set up ([Settings → Salespeople](#24-settings)), the right-hand panel shows **"Salesperson"**.
- Choose who made the sale. They earn their commission on it.
- Leave it on **"No salesperson"** if nobody should earn commission.
- The choice **stays selected for the next sale** on this till, so the person running the counter picks themselves once per shift.
- The order form for delivery, WhatsApp and other orders has the same **"Salesperson"** box.
- A cashier never sees anyone's rate or earnings. An admin can change the salesperson on a sale later: open the order, then **"Change"** next to "Salesperson".

### After the sale

The **"Sale complete"** screen shows the order number and total. If money is still owed, it shows "₹… left on the customer's account".

- **"Print receipt"**: print on an 80 mm thermal printer or A4.
- **"View sale"**: open the order.
- **"New sale"**: start the next customer.

> **Exchange:** to swap an item, first record a **return** and keep the money as **customer credit** ([Returns](#12-returns)). Then sell the new item in POS and use that credit.

---

## 8. Sales Orders — delivery and counter orders

**Menu:** Sell → "Sales Orders". Everyone can view. Admin and Cashier can create.

Use a Sales Order when the customer **isn't paying and taking the goods right now**. For example:
- **"Courier delivery":** a WhatsApp or Instagram order that you ship.
- **"Counter / pickup":** an order the customer collects later.

### How an order moves

```
Draft → Confirmed (stock is held for it) → Packed → Dispatched / Handed over (stock leaves, sale counts) → Delivered
```

At any time before the goods leave, it can be **Cancelled**.

### Find an order

Use the search box ("Order no., reference or customer"), the status and channel filters, and the date range. The **Payment** column shows Unpaid, Partially paid, Paid, Overpaid or Refunded, and how much is due.

### Create an order

1. Click **"New order"**.
2. Add items exactly as in POS.
3. In **"Customer & delivery"**:
   - Pick the **customer**. Delivery orders need one.
   - **"Channel"**: where the order came from (default WhatsApp).
   - **"Fulfilment"**: "Courier delivery" or "Counter / pickup".
   - **"Stock from"**: the location.
   - **"Order date"**, **"Payment due"** (leave blank to use the customer's credit days), **"Reference"** (e.g. a website order number).
4. In **"Totals"**: **"Order discount (₹)"**, **"Shipping charged (₹)"** and **"Notes"**.
5. Click:
   - **"Save draft"** to finish later (no stock is held), or
   - **"Confirm order"** to hold the stock for this order now.

> There is no separate delivery address field. The shipment uses the customer's saved address, so keep the customer's address up to date.

### Edit a draft

Open the order and click **"Edit draft"**. Only drafts can be edited. Once confirmed, an order can't be changed. Cancel it and create a new one if needed.

### Confirm a draft

Open the order, click **"Confirm"**, then **"Confirm order"**. The stock is now reserved for this customer.

### Counter / pickup order: hand it over

When the customer collects the goods:
1. Open the order and click **"Hand over"**.
2. Check **"Handed over on"**. It starts at the order date, so a sale entered late counts on its real day; change it if the goods left on another day.
3. Click **"Hand over"** again to confirm. The items leave stock and the sale counts on that day.

### Delivery order: pack, dispatch, deliver

The best way is through a **shipment** ([Shipping](#13-shipping)), which also records the courier and AWB. Once a shipment exists, the order's own buttons disappear and you work from the shipment.

Without a shipment (Admin or Operations):
1. **"Mark packed"** when packed.
2. **"Dispatch"**, then confirm. The items leave stock and the sale counts.
3. **"Mark delivered"** when the customer receives it.

### Take a payment on an order

On the order page, in the **"Payments"** card:
1. Click **"Record payment"**.
2. Choose **"Received into"** (the account), check the **"Amount (₹)"**, set the **"Date"** and add a **"Reference"** (UPI ref, UTR or cheque no.).
3. If the customer paid more than is due, tick **"Keep the extra ₹… as <name>'s credit"**.
4. Click **"Record ₹…"**.

**To use the customer's credit** on this order: click **"Use credit (₹…)"**, enter the amount and click **"Apply ₹…"**.

### Cancel an order (Admin)

You can only cancel **before the goods leave**. After that, record a return.

1. Open the order and click **"Cancel"**.
2. If money was paid, choose what happens to it:
   - **"Keep as <name>'s credit"**, or
   - **"Refund the money"**: pick the account it's refunded from and add a reference.
3. Type the **"Reason"**.
4. Click **"Cancel order"**.

> ⚠️ This window has two buttons with similar names. **"Cancel order"** cancels the order. The plain **"Cancel"** only closes the window.

### Print a receipt

Click **"Receipt"** on the order. Choose **"80 mm thermal"** or **"A4"**, then click **"Print"**.
- Before the goods leave, it prints as an **"Order confirmation"**.
- After the goods leave, it prints as a **"Receipt"**.
- It always says "This is not a tax invoice". GST invoices still come from your billing software.

### What's on the order page

- **Items:** with quantities returned or reserved.
- **Payments:** paid, due, and each payment.
- **Shipment:** for delivery orders.
- **Returns:** if any.
- **Totals.**
- **Profit:** Admin only.
- **Details.**
- **"Timeline":** every step (created, confirmed, packed, dispatched…), with who did it and when.

---

## 9. Pre-orders

**Menu:** Sell → "Pre-orders".

A pre-order is for items that **aren't in stock yet**. The customer usually pays an **advance** now and the **balance** when the goods arrive.

### How a pre-order moves

```
Create → take advance → goods arrive (purchase received) → Allocate stock → take balance → Hand over / Dispatch
```

### Create a pre-order (Admin, Cashier)

1. Click **"New pre-order"**.
2. Add items. They can be out of stock ("None in stock yet").
3. Pick the **customer**. A pre-order always needs a customer.
4. Set **"Fulfilment"** (default "Counter / pickup") and **"Expected arrival"**.
5. Click **"Confirm order"**.

### Take the advance

1. Open the pre-order.
2. Click **"Record payment"** and enter the advance ([Take a payment](#take-a-payment-on-an-order)).

### Change the expected date

Open the pre-order, click **"Change date"**, pick the new date and click **"Save"**. Pre-orders past their date show as **late** in red.

### When the goods arrive: allocate stock

Pre-orders are served **oldest first**. "Allocate" holds the stock for that customer.

**For many at once:** on the Pre-orders page, the **"Waiting by item"** card shows each item with how many are awaited and how many are free.
- Click **"Allocate"** next to an item, or **"Allocate all ready"** for everything.
- Only pre-orders that can be **fully** covered are allocated.

**For one pre-order:** open it, click **"Allocate stock"**, then **"Allocate stock"** again to confirm.

The banner on the pre-order changes to **"Stock allocated — ready to hand over or ship"**.

### Finish the pre-order

1. Take the balance with **"Record payment"**.
2. Then **"Hand over"** (pickup), or create a shipment and dispatch (delivery).

### Release an allocation (Admin)

To give the stock to a more urgent customer: open the pre-order, click **"Release stock"**, type a reason and click **"Release"**. The pre-order goes back to waiting.

### The pre-order list

The cards at the top show "Open", "Awaiting stock", "Ready to allocate", "Allocated" and "Advances held". Filter by stock state, tick **"Late only"**, or include finished ones.

---

## 10. Customers

**Menu:** Sell → "Customers". Everyone can view. Admin and Cashier can add and edit.

### Find a customer

Search by **mobile** (full number or last 4 digits), name, code or city. Phone numbers and emails are **hidden** (masked) in lists for privacy.

### Add a customer

1. Click **"Add customer"**.
2. Fill in:
   - **"Name"** (required)
   - **"Mobile"**: 10-digit Indian number, or with +country code
   - **"WhatsApp (if different)"**, **"Email"**
   - **"Customer type"**: Retail or Wholesale. Wholesale customers get wholesale and quantity prices.
   - **"Credit days"**: how many days they get to pay. Leave blank if they pay at purchase.
   - **"Credit limit (₹)"**: the most they may owe. Leave blank for no limit.
   - **"Address"**, **"City"**, **"PIN code"**, **"State"**, **"Notes"**
3. Click **"Save"**.

> **Duplicate check:** each mobile number can belong to one customer only. While you type, a yellow box **"This may be an existing customer"** warns you about similar customers. Open the match to check before saving.

### The customer page

Click a customer to see:
- **Stats:** orders, lifetime value, amount outstanding (and credit limit), credit held.
- **"Recent orders"**: the last 10.
- **"Customer credit"**: every credit entry (Admin and Cashier).
- **"Customer prices"**: special prices for this customer.
- **"Contact"** and **"Address & terms"**.

**Buttons:**
- **"Edit"**: change details.
- **"Deactivate" / "Reactivate"**: hide or show the customer in lists. Their history is kept.
- **"Merge into…"** (Admin): see below.

### See full phone number and email

On the customer page, click **"Show"** in the **"Contact"** card. The number becomes tap-to-call / WhatsApp. Every reveal is recorded in the audit log.

### Give a customer a special price (Admin)

1. On the customer page, find **"Customer prices"**.
2. Search the item in **"Add an item — search by product name or SKU"**.
3. Enter **"Price for this customer (₹, incl. GST)"** and click **"Save"**.

This price beats every other price for this customer. Use the pencil icon to change it and the bin icon to remove it.

### Refund a customer's credit as money (Admin)

1. On the customer page, in **"Customer credit"**, click **"Refund"**.
2. Choose **"Paid from"** (the account), enter the **"Amount (₹)"** and a **"Reference"**.
3. Click **"Refund ₹…"**.

### Merge duplicate customers (Admin)

If the same person was added twice, merge them. The duplicate's orders, payments, credit and prices move to the customer you keep.

**From a customer page:**
1. Open the duplicate and click **"Merge into…"**.
2. Search for the customer to **keep**.
3. Type a **"Reason"** and click **"Review merge"**.
4. Click **"Merge"**.

**From the duplicates list:**
1. Go to Customers → **"Possible duplicates"**.
2. Each pair shows **"Keep CUS-A"** and **"Keep CUS-B"**. Click the one to keep, then **"Merge"**.

> ⚠️ A merge **can't be undone**.

### Export customers

- **"CSV" / "Excel"**: numbers stay masked.
- **"With contacts"** (Admin): includes full numbers and emails. This is recorded in the audit log.

---

## 11. Payments

**Menu:** Sell → "Payments". For Admin and Cashier.

There are five tabs.

### Collections — how much came in

Pick a date range (default today) to see:
- the total received and refunded
- money in business accounts vs personal accounts
- a table by account, and summaries by method and by sales channel

Transfers between your own accounts are shown but **never counted as money received**.

### Payments — every payment in and out

Search by payment, reference, order or customer, and filter by method, business/personal, direction (in or out) and date. Money paid out shows in red with a minus sign.

**Record a payment from a customer** (for example, a customer paying off several orders):
1. Click **"Record payment"**.
2. Search for and pick the **customer**.
3. Choose **"Received into"**, enter the **"Amount (₹)"**, the **"Date"** and the **"Reference"**.
4. Under **"Apply to unpaid orders"**, type how much goes to each order, or click **"Oldest first"** to fill them automatically.
5. If some money isn't applied to any order, tick **"Keep ₹… not applied to orders as <name>'s credit"**.
6. Click **"Record ₹…"**.

**Void a payment entered by mistake** (Admin):
1. Click the payment.
2. Click **"Void…"**, type the **"Reason"** and click **"Void payment"**.

The CRM adds an opposite entry, and the order's balance or credit goes back to what it was. The original stays on record, marked "Voided".

### Outstanding — who owes money

A list of every confirmed order that isn't fully paid:
- **"Total due"** and how much is **overdue**.
- **"Receivable"** means orders already delivered. **"Open orders"** means not delivered yet.
- Age cards **"0–30 days"**, **"31–60 days"** and **"Over 60 days"**. Tap a card to filter the list.

Click an order to open it and record the payment.

### Advances — money taken before delivery

Shows money held on pre-orders and other orders that haven't left yet. Advances are **not sales** until the goods are handed over or dispatched.

### Transfers — moving money between your own accounts (Admin)

Use this when cash is deposited in the bank, or money received on a personal UPI is moved to the business account. It is never a sale or an expense.

1. Click **"New transfer"**.
2. Choose **"From"** and **"To"**, enter the **"Amount (₹)"**, **"Date"**, **"Reference"** (deposit slip or UTR) and **"Notes"**.
3. Click **"Record transfer"**.

**To undo a transfer:** click **"Reverse"** on its row, type a reason and click **"Reverse"**.

---

## 12. Returns

**Menu:** Fulfilment → "Returns". Everyone can view. **Only Admin can record a return.**

Use a return when goods come back **after they left the shop** (handed over or dispatched). If the goods haven't left yet, **cancel** the order instead.

### Record a return

1. Either:
   - open the order and click **"Return items"**, or
   - go to Returns, click **"New return"** and pick the order.
2. For each item coming back, enter the **quantity** and choose its **condition**:
   - **"Resellable — back to stock"**: goes back on sale.
   - **"Damaged — to damaged stock"**: kept, but not for sale.
   - **"Not coming back — write off"**: lost; counted as a loss.
3. **"Shipping to refund (₹)"**: if you are refunding shipping.
4. **"Reason"** (required), for example "Wrong colour".
5. Check the preview: value returned, what the order is now worth, paid so far, and **"To give back ₹…"**.
6. If money must go back, choose:
   - **"Keep as <name>'s credit (for an exchange)"**, or
   - **"Refund the money"**: pick the account and add a reference.
7. Click **"Record return ₹…"**.

> If the customer hadn't fully paid, the return simply reduces what they owe. Nothing is given back.

### See past returns

The Returns list shows each return, its order, customer, value and money back. Click one to see its details.

---

## 13. Shipping

**Menu:** Fulfilment → "Shipping". For Admin and Operations.

Shipping tracks delivery orders from packing to the customer's door. You update the status by hand from the courier's tracking page.

### Shipment status

```
To pack → Packed → Dispatched → In transit → Out for delivery → Delivered
                         ↘ Coming back (RTO) → Back with us
```

You can skip steps forward, but never go back. A shipment can be cancelled only before dispatch.

### Create a shipment

1. On Shipping, click **"New shipment"** and pick a confirmed delivery order. Alternatively, click **"Create shipment"** on the order page.
2. Choose the **"Courier"**, enter the **"AWB / tracking no."** and the **"Courier charge to us (₹)"**. All three can be added later, but the courier and AWB are needed before dispatch.
3. Click **"Create shipment"**.

> For a pre-order, allocate stock first.

### Update a shipment

1. Click the shipment to open it.
2. Optionally type a note in **"Note (optional)"**, e.g. "picked up 4 pm".
3. Click the next step:
   - **"Mark packed"**
   - **"Dispatch"**: **this takes the items out of stock** and the sale counts.
   - **"In transit"**, **"Out for delivery"**, **"Mark delivered"**
   - **"Coming back (RTO)"**, then **"Back with us"**
   - **"Cancel shipment"** (before dispatch only)

The order updates automatically.

### Add or remove parcels

Before dispatch, type an AWB in **"Add AWB"** and click **"Add"**, or remove one with the bin icon. Each AWB can only be used once. If the courier has a tracking link set up, each AWB shows a **"Track"** link.

### Change the courier or its charge

Click **"Edit"**.
- The courier can only be changed before dispatch.
- Update **"Courier charge to us (₹)"** when the courier's bill arrives. This feeds profit.

### When a parcel comes back (RTO)

1. Click **"Coming back (RTO)"**, then **"Back with us"** when it arrives.
2. Then **record a return** on the order ([Returns](#12-returns)) to put the items back in stock and settle any refund.

### The Shipping page

- **Cards:** "Need a shipment", "To pack / packed", "On the way", "Coming back (RTO)", and **"Courier cost vs charged"**. A cost higher than what the customer paid shows in red.
- **Tabs** filter by status. Search by shipment, order, customer or AWB, and filter by courier.

---

## 14. Products

**Menu:** Catalog → "Products". Everyone can view. **Only Admin can add or change.**

### How products work

- A **product** is the item, e.g. "YEGAO 1:64 Die-cast Car".
- A **variant** is one version you sell, e.g. the Red one. Each variant has its own **SKU**, prices and stock.
- A simple product has just one variant.
- Each variant has:
  - **Regular price**: the normal price.
  - **Offer price**: a sale price (optional).
  - **Wholesale price**: for wholesale customers (optional).
  - **Quantity tiers**: lower prices for wholesale buyers who buy more (optional).
- **All prices include GST.**

### Find products

Search by name, code or SKU, and filter by category, brand and status. The **Available** column shows sellable stock not held for orders.

### Add a product

1. Click **"Add product"**.
2. **"Product details"**:
   - **"Product name"**, **"Category"**, **"Brand"**, **"Scale"**, **"Status"** (Draft / Active / Discontinued / Archived) and **"Main supplier"**.
   - Use the **+** next to Category, Brand or Supplier to add a new one on the spot.
3. **"Tax"**:
   - **"GST rate"**: keep **"Category rate"** unless this product is taxed differently.
   - **"HSN code"**.
   - Confirm GST rates with your CA.
4. **"Description & notes"**: the description, and **"Internal notes"** (only visible in the CRM).
5. **"Website reference"**: the website product ID, if known. This is reference only.
6. **"Variants, SKUs & prices"**:
   - **Simple product:** fill one row: **"SKU"**, **"Regular ₹"**, **"Offer ₹"**, **"Wholesale ₹"** and **"Reorder at"** (the low-stock alert level).
   - **Several colours or models:**
     1. Tick **"This product comes in several colours, models or styles"**.
     2. Type the values for "Colour", pressing Enter after each one (or paste "Red, Blue, Black").
     3. Click **"Add option"** for a second or third option (up to 3), e.g. Size.
     4. The CRM makes one row for every combination.
     5. To fill every row at once, enter a **"SKU prefix"** and the prices under **"Fill every row at once"**, then click **"Apply"**.
7. Click **"Create product"**.

> ⚠️ **Options can't be added after the product is saved**, but you can add new values later (e.g. a new colour). Offer and wholesale prices can't be higher than the regular price.

### Copy a product

Open a product and click **"Duplicate"**. A copy opens with " (copy)" added to the name and "-COPY" added to each SKU. Change what's needed and save.

### Edit product details

Open the product and click **"Edit"**. Prices and SKUs are **not** changed here; change them per variant (below).

### Change a variant's price or SKU

1. Open the product.
2. Click **"Edit"** on the variant's row.
3. Change the **"SKU"**, **"Regular price ₹"**, **"Offer price ₹"** (leave blank for no offer), **"Wholesale price ₹"** or **"Reorder level"**.
4. Type a **"Reason for price change"**, e.g. "Diwali offer".
5. Click **"Save"**.

Past sales keep the price they were sold at.

### Add a new colour or size

On the product page, click **"Add variant"**, choose or type the option values, enter the SKU and prices, and click **"Add variant"**. This works only for products that have options.

### Quantity (wholesale) pricing

1. Click **"Tiers"** on a variant's row.
2. Click **"Add tier"**.
3. Enter **"From quantity"** (at least 2) and **"Price per unit ₹"**.
4. Add more tiers as needed. Bigger quantities must have the same or a lower price.
5. Click **"Save"**.

### See price history

Click the history icon on a variant to see every price change: who made it, when and why.

### Photos

On the product page, in **"Photos"**:
- **"Upload"**: JPG, PNG or WebP, up to 5 MB each, 30 photos at most.
- **"Add link"**: paste a photo link starting with https://.
- **Arrange photos:** use the arrows to reorder, and the star to make a photo the **main** one (shown in lists and POS). The bin removes a photo.
- For products with variants, choose which colour each photo shows in **"Photo shows"**.

### Archive a product or variant

You can't delete a product. **Archive** it instead: it disappears from lists and can't be sold or bought, but its history is kept.

- **Product:** click **"Archive"**, then **"Restore"** to bring it back.
- **One variant:** click the archive icon on its row.

You must sell, transfer or write off its stock first. A product always needs at least one active variant.

### Categories and brands

Go to Products → **"Categories"** or **"Brands"**.
- **"Add category"** / **"Add brand"**: enter the name. Categories also have a **GST rate**, which their products follow unless they have their own.
- **"Edit"**: rename, or change the GST rate. Changing the rate updates every product that follows it.
- **"Deactivate"**: hides it from new products. Existing products keep it.

### Change many prices at once (Bulk price edit)

1. Go to Products → **"Bulk price edit"**.
2. Choose the products by **"Category"**, **"Brand"** or **"Product name or code contains"**.
3. Choose which **"Price"** to change: Regular, Offer or Wholesale.
4. Choose the **"Change"**, for example "Increase by %", "Set to an amount", "% off the regular price" or "Remove the price".
5. Enter the percent or amount. Tick **"Round to whole rupees"** if you want rounded prices.
6. Click **"Preview changes"** and check the old and new prices. Rows that can't change are marked "will be skipped".
7. Click **"Apply … changes"**, add a reason if you like, and click **"Apply changes"**.

---

## 15. Inventory (stock)

**Menu:** Stock → "Inventory" (on phones: "Stock").

### Stock words

- **Sellable:** can be sold.
- **Damaged:** broken. Kept, but not for sale.
- **Demo:** used as a display piece.
- **Quarantine:** set aside to check.
- **Physical:** everything you hold (all of the above).
- **Available:** sellable **minus** units already held (reserved) for confirmed orders.

### Stock levels

The **"Stock levels"** tab shows every item with stock per location, damaged, physical, available and status. Admins also see the average cost and stock value.

- Search by product or SKU. Filter by category, location and stock status (In stock / Low stock / Out of stock).
- Tap the **"Low / out of stock"** card to see what needs re-ordering.
- **Click a row** to open the **stock card**. It shows the stock in each location and bucket, and the recent movements. Its reconciliation line should say **"Matches physical stock"**. If it says "Does not match", report it to the Admin.

### Movements (the stock history)

The **"Movements"** tab lists every stock change ever made: opening stock, purchases, sales, returns, transfers, write-offs and so on. Filter by type, location and date. Click a row to see the full entry.

### Record a stock movement

Go to the **"Record movement"** tab (Admin and Operations).

1. Choose the type:

| Type | When to use it | Who |
|---|---|---|
| **"Transfer"** | Move stock between locations, e.g. Godown → Store | Admin, Operations |
| **"Status change"** | Move units between buckets, e.g. Sellable → Damaged | Admin, Operations |
| **"Opening stock"** | Record what you have when you start using the CRM | Admin |
| **"Write-off"** | Remove units that are lost, stolen or destroyed | Admin |
| **"Adjustment"** | Correct a count: add or remove units | Admin |

2. Fill the details: location(s), **"Date"**, **"Reason"**, and **"Reference"** / **"Notes"** if useful.
3. Add items by searching in **"Add an item — search by product name or SKU"**. Pick a variant, or **"Add every variant of <product>"**.
4. Enter the **"Qty"** for each line.
5. Click **"Record …"** (e.g. "Record transfer").

The entry gets a code. Click **"View entry"** to open it.

#### Record opening stock (Admin)

1. Choose **"Opening stock"** and the **"Location"**.
2. Add each item with its quantity.
3. Enter **"Cost ₹"** if you know it. Leave it blank if you don't; it stays "unknown" and is never guessed.
4. Click **"Record opening stock"**.

Opening stock can be recorded only once per item. After that, use an adjustment.

### Undo a stock entry (Admin)

Every stock entry is permanent. To undo a wrong one:
1. Open it from **"Movements"**.
2. Click **"Reverse this entry"**.
3. Type the **"Reason"**, e.g. "Entered at the wrong location", and click **"Reverse"**.

Entries made by a purchase, sale, return, stock count or import can't be reversed here. Correct them where they came from.

---

## 16. Purchases and suppliers

**Menu:** Stock → "Purchases". Admin and Operations can view. **Only Admin creates purchases.** Operations can **receive** goods.

A purchase is one supplier invoice or shipment. The CRM works out the **landed cost** of each item: the price × exchange rate, plus a share of freight, duty and other charges. GST/IGST you can claim back is kept out of the cost.

### How a purchase moves

```
Draft (can edit) → Received (stock added, prices locked)
                 → Cancelled
```

### Create a purchase (Admin)

1. Click **"New purchase"**.
2. In **"Invoice & shipment"**:
   - **"Supplier"**: choosing one sets the currency.
   - **"Receive into"**: the location.
   - **"Supplier invoice no."**, **"Shipment / BL / AWB ref."** and **"Invoice date"**.
   - **"Split shared charges"**: "By purchase value" is recommended. You can also split by quantity, weight or volume.
   - **"Invoice currency"** and **"Exchange rate"**. Click **"Use last rate…"** to reuse the last rate for that currency.
3. In **"Items"**, add each item with its **"Qty"** and **"Unit price"** in the invoice currency.
4. In **"Charges"**, click **"Add charge"** for freight, customs duty, clearing, IGST, GST, transport, insurance or other. IGST and GST are ticked as **"Recoverable tax"** automatically.
5. Check the **"Landed cost"** panel on the right.
6. Click **"Save draft"**.

You can change a draft any time with **"Edit draft"**.

### Receive the goods (Admin, Operations)

When the goods physically arrive:
1. Open the purchase and click **"Receive goods"**.
2. Set **"Received on"**.
3. Click **"Receive goods"**.

The stock is added as sellable at the landed cost. **After this, the purchase is locked.**

> Waiting pre-orders can now be allocated ([Pre-orders](#9-pre-orders)).

### Cancel a draft (Admin)

Click **"Cancel"**, then **"Cancel purchase"**. The draft is kept for the record.

### A charge arrives after receiving (Admin)

For example, a clearing bill that comes a week later:
1. Open the received purchase and click **"Late charge"**.
2. Choose the **"Type"**, then enter the **"Amount ₹"**, a **"Description"** and how to split it.
3. Click **"Record charge"**.

The cost of items still in stock goes up. The share for items already sold goes to cost of sales.

### Send goods back to the supplier (Admin)

1. Open the received purchase and click **"Return to supplier"**.
2. Choose where it's **"Taken from"**, the **"Stock status"** and the **"Reason"**.
3. Enter the quantity for each item (up to what was received and not yet returned).
4. Click **"Record return"**.

### Suppliers (Admin)

Go to Purchases → **"Suppliers"**.
- **"Add supplier"**: name, country, invoice currency, contact person, phone/WeChat, email, GSTIN, address and notes.
- **"Edit"** and **"Deactivate"**: a deactivated supplier isn't offered for new purchases.
- The **Balance** column shows "They hold ₹…" (you paid in advance), "We owe ₹…" or "Settled".

### Supplier ledger (money with a supplier)

Open a supplier to see the money between you: paid to them, goods received, and the running balance.

**Record an entry:**
1. Click **"Record entry"**.
2. Choose **"What happened"**:
   - **"Opening balance"**: the starting balance. Choose which way: "The supplier holds our money" or "We owe the supplier".
   - **"Paid to supplier"**: choose **"Paid from"** (the account).
   - **"Goods received"**: optionally link the purchase.
   - **"Refund from supplier"**: choose **"Received into"**.
   - **"Credit from supplier"**.
   - **"Adjustment"**: notes are required.
3. Enter the **"Amount (₹)"**, **"Date"**, **"Reference"** (bill, UTR or chat note) and **"Notes"**.
4. Check **"Balance after this"**, then click **"Save ₹…"**.

**Void a wrong entry:** click it, click **"Void…"**, type why, and click **"Void entry"**.

> Payments to suppliers in cash are counted in the cash drawer's expected amount.

---

## 17. Stock Counts

**Menu:** Stock → "Stock Counts". Admin and Operations count. **Only Admin approves.**

Use this to check that the shelves match the CRM. Count one shelf, category or location at a time.

### How a count moves

```
Counting → Waiting for approval → Approved (stock corrected)
                                 → Sent back for recount
                                 → Cancelled
Approved → Reversed (if needed)
```

### Start a count

1. Click **"New count"**.
2. Choose the **"Location"** and, optionally, a **"Category"**.
3. **"Blind count"** is on by default. Counters won't see what the system expects, which gives an honest count.
4. Tick **"Include items the system has at zero"** to also count items that should be empty.
5. Click **"Start counting"**.

> Avoid selling from that shelf until the count is entered.

### Enter the count

1. Type the number you physically find in the **"Counted"** column for each item. Enter **0** for items you can't find.
2. Click **"Save"** as you go.
3. **Found something not on the list?** Add it with the item search under the table.
4. When every line is counted, click **"Submit"**, then **"Submit"** again.

### Approve, send back or cancel (Admin)

1. Open the submitted count. You see system vs counted, the difference and its value.
2. For each difference, pick a **reason**: missing, damaged, theft, count correction, found stock, data entry error and so on.
3. Then:
   - **"Approve"**: type a reason and click **"Approve"**. The stock is corrected in one entry.
   - **"Send back"**: ask for a recount, with a reason.
   - **"Cancel count"**: with a reason.

### Undo an approved count (Admin)

Open the count, click **"Reverse"**, type a reason and click **"Reverse"**. The stock goes back to what it was before the approval.

---

## 18. Cash Closing

**Menu:** Finance → "Cash Closing". For Admin and Cashier.

Each day, count the cash drawer and compare it with what the CRM expects.

### Morning: open the day

1. Choose the **cash drawer** and the **day** (today by default).
2. **"Opening cash (₹)"** is filled from the last count. Change it if needed.
3. Click **"Open the day"**.

### During the day

The left card shows what should be in the drawer:

> Opening cash + cash received − cash refunds − cash expenses + money moved in − deposits / money moved out − cash paid to suppliers = **"Expected in the drawer"**

### Evening: count and close

1. Count the cash in the drawer.
2. Enter it in **"Counted cash (₹)"**. A badge shows **"Exact"**, **"Short ₹…"** or **"Over ₹…"**.
3. Add **"Notes"** if it's short or over, explaining why.
4. Click **"Close the day"**, then **"Close day"**.

> 🔒 Once a day is closed, **nothing more can be posted to that drawer on that date**: no payments, refunds, expenses or transfers. If you need to, use another date or ask the Admin to reopen the day.

### Reopen a closed day (Admin)

Click **"Reopen day"**, type the **"Reason"** and click **"Reopen"**. Close it again after correcting. The old count stays in the audit log.

**"Earlier days"** lists every past day with its opening, expected, counted and difference.

---

## 19. Expenses

**Menu:** Finance → "Expenses". **Admin only.**

Record money spent on the business, like rent, salaries or packaging. Expenses are never counted as sales.

### Record an expense

1. Click **"Record expense"**.
2. Choose the **"Category"**.
3. Choose the **"Type"**:
   - **"Operating expense"**: running the business (rent, electricity…).
   - **"For an order"**: spent on one order (extra packaging, extra courier). Search for and pick the **"Order"**.
4. Choose **"Paid from"** (the account) and enter the **"Amount (₹)"**.
5. Fill in **"Date"**, **"Paid to"**, **"Bill / reference"** and **"Notes"**.
6. Click **"Save ₹…"**.

### Void a wrong expense

Click the expense, click **"Void…"**, type why, and click **"Void expense"**. The original stays on record, marked "Voided".

### Categories of expenses

Go to Expenses → **"Categories"**.
- **"Add category"**: enter a name and click **"Save"**.
- **"Rename"**: change the name.
- **"Hide" / "Show"**: hidden categories aren't offered for new expenses but keep their history.

The starting categories are: Rent, Salaries & Wages, Electricity, Internet & Phone, Marketing & Ads, Maintenance & Repairs, Transport & Local Delivery, Bank & Card Charges, Software & Subscriptions, Office Supplies, Professional Fees, Courier, Packaging, Miscellaneous.

There is also **"Staff commission"**. It isn't offered under "Record expense": commission payouts are recorded on the Commission page (below), so each one is tied to a salesperson.

### Commission

**Menu:** Finance → "Commission". **Admin only.**

**How commission is worked out**
- A salesperson earns **their % of the sale's gross profit**: the sale value excluding GST (after discounts; shipping never counts) minus what the goods cost.
  - Example: an item sold for ₹1,180 including 18% GST is ₹1,000 excluding GST. If it cost ₹500, the gross profit is ₹500, and 2% commission is ₹10.
- Items with **no recorded cost earn nothing**. They're marked "units without cost" in the salesperson's details so you can see which sales were affected. Record costs when stock comes in to avoid this.
- A sale made **at a loss earns ₹0**. It never reduces the commission earned on other sales.
- It counts on the day the sale is **handed over or dispatched**, the same day the sale counts as revenue. A confirmed order that hasn't left yet earns nothing, and a cancelled order never earns.
- A **return** takes back the commission on what came back, on the day of the return. A sale returned in full ends at exactly ₹0.
- The % is **fixed on each sale** when the salesperson is put on it. Changing someone's rate in Settings only affects sales made afterwards.
- Imported past sales never earn commission.

**The page**
1. Choose the dates (it opens on this month).
2. Each salesperson's row shows: **Sales**, **Net sales excl. GST**, **Gross profit**, **Earned**, **Taken back** (returns), **Net**, **Paid** in those dates, and **Owed now**. A red * next to the gross profit means some items had no cost and earned nothing.
   - **Owed now** is all time: everything earned minus everything paid. "Paid ahead" means more was paid than earned so far.
3. Click a row to see every sale and return behind the figures, and the payouts in those dates.
4. **Export** gives the same table as a spreadsheet (also under Reports → "Salesperson commission").

**Pay commission**
1. Click **"Record payout"** (on the page, or inside a salesperson's details).
2. Choose **"Paid to"**. The amount fills in with what they're owed; change it if you pay part.
3. Choose **"Paid from"** (the account), the date, and an optional reference such as "October commission".
4. Click **"Record payout"**.

The payout is saved as an expense in "Staff commission". It leaves that account and shows in that day's cash count. To undo a wrong payout, click it in the salesperson's details (or on the Expenses page) and **"Void…"** it.

---

## 20. Profit & Analytics

**Menu:** Finance → "Profit & Analytics". **Admin only.**

These are management figures to help you run the shop. Your CA's accounts are final.

### Profit tab

1. Choose the period: **"Today"**, **"7 days"**, **"30 days"**, **"This month"**, **"This FY"** (from 1 April), or your own dates.
2. Read the **"Profit statement"** from top to bottom:

| Line | What it means |
|---|---|
| Gross sales | What was charged at list prices, plus shipping, including GST |
| − Discounts | Item and bill discounts |
| − Returns | Value of goods returned |
| **= Net sales incl. GST** | |
| − GST | Tax collected (not your money) |
| **= Net sales excl. GST** | |
| − Cost of goods sold | What the sold items cost you |
| **= Gross profit** | |
| − Courier cost, payment gateway fees, order expenses, late purchase charges | Costs of getting orders out |
| **= Contribution profit** | |
| − Operating expenses | Rent, salaries, etc. |
| **= Operating profit** | |

Also shown:
- **"Orders fulfilled"**.
- **"Sold below list price"**: what offers, wholesale and special prices gave away.
- A warning if some items were sold **without a known cost**. Those are left out of profit.

**"Profit by"** breaks the figures down by **Product**, **Variant**, **Category** or **Channel**.

### Valuation & projections tab

What your unsold stock cost, and what it could bring in at **today's** prices:
- **"Available units"**, **"Cost value"**, and **"Unknown cost"** (units with no cost recorded).
- **"At regular prices"** and **"At offer prices"**: revenue and profit if everything sells.
- **"By variant"**: the same figures per item.

Filter by product, location and category.

---

## 21. Reports

**Menu:** Finance → "Reports". For Admin and Cashier. Cashiers don't see cost or profit reports or columns.

### Run a report

1. **Choose a report** from the list on the left (on a phone, from the **"Report"** drop-down).
2. **Set the filters** shown for that report: date range, location, category or customer.
3. **Check the preview** below. It shows up to 200 rows.
4. Click **"CSV"** or **"Excel"** to download **all** matching rows.

Customer phone numbers are always masked in reports.

### Available reports

| Group | Report |
|---|---|
| Sales | Daily sales · Monthly sales |
| Payments | Cash and UPI collections · Outstanding payments · Advances and pre-orders |
| Profit | Profit by product* · Discount impact · Current inventory valuation* · Potential future profit* |
| Catalog & stock | Product master · Variant stock · Inventory ledger · Damaged stock · Stock reconciliation |
| Purchasing | Purchase history* · Supplier balances* |
| Customers & shipping | Customer purchase history · Courier expenses* |

\* Admin only.

---

## 22. Import Data (spreadsheets)

**Menu:** Admin → "Import Data". **Admin only.**

Bring in data from Excel (.xlsx) or CSV files instead of typing it.

**What you can import:**
- **"Products & variants"**
- **"Opening stock"**
- **"Customers"**
- **"Past sales (history)"**
- **"Expenses"**

**Limits:** up to 5 MB and 5,000 rows per file.

**Nothing is saved until you approve.** The CRM never guesses missing information: a blank cost stays unknown, and blank contact details stay empty.

### Import a file

**Step 1 — Upload**
1. Click **"Import a file"**.
2. Choose **"What does the file contain?"**.
3. Choose the **"File"**.
4. Leave **"Column headings are on row"** blank; the CRM finds the headings itself.
5. Click **"Upload and preview"**.

If the Excel file has several sheets, choose the right one under **"Which sheet?"** and click **"Upload and preview"** again.

**Step 2 — Match the columns**
1. For opening stock or past sales, choose the **location**.
2. For each CRM field, pick the column in your file that holds it, or "— not in this file —". Fields marked * are required. A sample value is shown so you can check.
3. For past sales, also choose which account each payment column went into, and the courier account and category.
4. To reuse this matching next time, type a name in **"Save this mapping for next time"**. Next time, pick it from **"Use a saved mapping…"**.
5. Click **"Check every row"**.

**Step 3 — Review the rows**
- **"Ready"**: will be imported.
- **"Errors"**: the **"What to fix"** column says why. Fix the file and upload again.
- **"Duplicates"**: already in the CRM. These are skipped, never overwritten.
- **"What approving will do"** tells you exactly what will be created, including any new categories and brands.

**Step 4 — Approve**
1. Click **"Approve … rows"**.
2. Click **"Approve import"**.

Only the ready rows are imported. If something changed since the check, nothing is imported; review again and re-approve.

### Undo an import (roll back)

Open an imported batch and click **"Roll back"**. Type a **"Reason"** and click **"Roll back"**.

This is only possible while nothing the import created has been used (sold, moved, priced and so on). If rollback is blocked, the screen tells you why and what to do instead.

> ⚠️ **Past sales can never be rolled back.** Correct them with returns or refunds. Try a past-sales file on a test copy first.

### Cancel an import

Before approving, click **"Cancel import"**. Nothing from the file was saved.

---

## 23. Variant Mapping and the website

**Menu:** Catalog → "Variant Mapping". **Admin only.**

This links each CRM item to its ID on littlestepz.in, ready for a future read-only connection. **Nothing is ever sent to the website.**

### Link a variant by hand

1. Search for the item, or filter by **"Mapping state"** (Mapped / Partly mapped / Not mapped).
2. Click **"Map"**.
3. Enter the **"Website product ID"** and **"Website variant ID"**. Leave a box empty to remove that link.
4. Click **"Save mapping"**.

### Website connection (Settings → "Integrations")

The **"Website (littlestepz.in)"** card shows whether the connection is on. It is **"Not connected"** until the website is ready.

When it is connected:
1. Click **"Dry run"**. This only reads the website and changes nothing. It shows:
   - items that can be linked by SKU
   - items that need a look
   - price and stock differences (for information only)
2. If links were found, click **"Link … IDs"**, then **"Link IDs"**. This only saves the website IDs in the CRM.

The other integrations listed there (courier tracking, WhatsApp, GST e-invoicing, two-way stock sync) are placeholders and are not connected.

---

## 24. Settings

**Menu:** Admin → "Settings". **Admin only.**

The tabs are **"Business"**, **"Locations"**, **"Receiving accounts"**, **"Couriers"**, **"Salespeople"**, **"Users & roles"** and **"Integrations"**.

### Business

Fill in:
- **"Legal name"**
- **"Trade name"**: printed on receipts
- **"GSTIN"**
- **"State (GST)"**: decides CGST + SGST vs IGST
- **"Address"**, **"City"**, **"PIN code"**, **"Phone"**, **"Email"**
- **"Receipt footer"**

Then click **"Save changes"**.

### Locations

Locations are where stock is kept, for example the Store and the Godown.

- **Add:** click **"Add location"**. Enter a short **"Code"** (e.g. STORE; this can't be changed later), the **"Name"**, the **"Type"** (Store or Godown / Warehouse) and the address. Click **"Save"**.
- **Edit:** click **"Edit"**.
- **Deactivate:** click **"Deactivate"**. You must transfer its stock out first, and one active location must always remain.

### Receiving accounts

Receiving accounts are everywhere money comes in: the cash drawer, PhonePe, a bank account, the website gateway.

- **Add:** click **"Add account"**. Enter:
  - **"Name"**, e.g. "PhonePe — Business"
  - **"Method"**: Cash, PhonePe / UPI, Website Gateway, Bank Transfer or Other
  - **"Processing fee %"**: 0 for cash and UPI
  - **"Details"**: UPI ID or the last 4 digits only, never full account numbers
  - Tick **"Personal account"** if it's someone's personal account. The money still counts, but is reported separately.

  Click **"Save"**.
- **Deactivate:** the account is no longer offered for new payments. Past payments stay in reports.

> Each receiving account becomes a payment button in POS. Cash accounts appear in Cash Closing.

### Couriers

- **Add:** click **"Add courier"**. Enter the **"Name"** and the **"Tracking link"**, with `{awb}` where the tracking number goes. For example:
  `https://www.delhivery.com/track/package/{awb}`

  Optionally add the **"Phone"** and **"Notes"**. Click **"Save"**.
- **Stop using a courier:** click **"Edit"** and untick **"Active (offered when shipping)"**.

### Salespeople

Staff who earn commission on the sales they make. They don't need a CRM login: the cashier picks them at checkout.
- **"Add salesperson"**: enter the **"Name"** and the **"Commission % of gross profit"**. The CRM gives each person a **staff ID** automatically (S01, S02, S03…). It's shown in the list, at the till and on the Commission page, and it never changes.
- **"Edit"**: change the name or %. A new % applies to **sales from now on**; sales already made keep the % they were made at.
- Untick **"Active"** when someone leaves. They're no longer offered at checkout, but their history and anything still owed to them stay on the Commission page.

### Users & roles

- **Add a staff member:**
  1. Click **"Add user"**.
  2. Enter the **"Full name"** and **"Email (used to sign in)"**.
  3. Choose the **"Role"**: Admin, Cashier or Operations ([who can do what](#who-can-do-what)).
  4. A **"Temporary password"** is created; click the wand to make a new one.
  5. Click **"Create user"**.
  6. Give them the temporary password privately. They must change it at first sign-in.
- **Change a name or role:** click **"Edit"**. Changing the role signs the user out. You can't change your own role.
- **Forgotten password or locked account:** click **"Reset"**, then **"Reset password"**. The account is unlocked, signed out everywhere, and needs a new password at next sign-in.
- **Someone leaves:** click **"Deactivate"**. They are signed out immediately and can't sign in. Their history is kept.

At least one active Admin must always remain.

> On a phone, only "Edit" is shown in these lists. Use a computer or a wider screen for Reset, Deactivate and Reactivate.

---

## 25. Audit History

**Menu:** Admin → "Audit History". **Admin only.**

A permanent record of every change, sign-in and correction: who did it, when, and what changed. Nobody can edit or delete it.

1. Filter by **"Record type"**, **"Action"** and dates.
2. Click a row to see the **Before** and **After** values.
3. Use **"CSV"** / **"Excel"** to download.

---

## 26. How to fix mistakes

Nothing is deleted. Use the right correction:

| Mistake | What to do | Who |
|---|---|---|
| Wrong item or price on a **draft** order | "Edit draft" | Admin, Cashier |
| Order confirmed by mistake, goods **not yet left** | "Cancel" the order (refund or keep as credit) | Admin |
| Goods **already left**, customer returns them | "Return items" | Admin |
| Payment entered wrong (amount, account, customer) | Payments → open it → "Void…", then record it correctly | Admin |
| Customer wants their credit back as money | Customer page → "Refund" | Admin |
| Transfer between accounts entered wrong | Transfers → "Reverse" | Admin |
| Expense entered wrong | Open it → "Void…", then record it again | Admin |
| Wrong stock transfer, status change, write-off or adjustment | Movements → open it → "Reverse this entry" | Admin |
| Wrong price or quantity on a **draft** purchase | "Edit draft" | Admin |
| Purchase already received, a bill comes late | "Late charge" | Admin |
| Faulty goods back to supplier | "Return to supplier" | Admin |
| Supplier ledger entry wrong | Open it → "Void…" | Admin |
| Stock count approved wrongly | Open the count → "Reverse" | Admin |
| Cash day closed too early | "Reopen day" | Admin |
| Same customer added twice | "Merge into…" (can't be undone) | Admin |
| Import went wrong | "Roll back" (not for past sales) | Admin |
| Price changed by mistake | Edit the variant again. History keeps both changes. | Admin |

---

## 27. Common messages and what to do

| Message | What it means / what to do |
|---|---|
| "Email or password is incorrect" | Check both. If your account was deactivated, you also see this; ask the Admin. |
| "Too many failed attempts. Try again after 15 minutes." | Wait 15 minutes, or ask the Admin to reset your password. |
| "Your session has ended. Please sign in again." | Sign in again. |
| "You don't have access to this page" | Your role can't use this page. Ask an Admin. |
| "Walk-in sales must be paid in full" | Take the full amount, or pick a customer so they can pay later. |
| "… pays at purchase: ₹… is still due" | The customer has no credit days. Take the full amount, or give them credit days on their customer page. |
| "… would pass their ₹… credit limit" | They owe too much already. Take payment, or raise their credit limit. |
| "Payments are ₹… more than the total. Enter what was kept…" | Enter the amount kept, not the cash handed over. |
| "Not enough available stock" / "Only N of … are free; … are reserved" | Stock is low, or held for other orders. Check Inventory, transfer from another location, or reduce the quantity. |
| "Only admins can change an item's price; use a discount instead" | Use the "₹ off" box. |
| "… is archived and can't be sold" | Ask the Admin to restore the product or variant. |
| "… was closed for <date>. Reopen that day…" | That cash day is closed. Use another date, or ask the Admin to reopen it. |
| "… hasn't left stock yet; cancel it instead of returning items" | Use "Cancel" on the order, not a return. |
| "… has left stock; record a return instead" | The goods are out. Use "Return items". |
| "Choose the courier before dispatching" / "Add at least one parcel with its AWB before dispatching" | Edit the shipment, add the courier and AWB, then dispatch. |
| "That AWB is already on another shipment" | Check the tracking number. Each AWB can be used only once. |
| "This mobile already belongs to another customer" | The customer already exists. Search for them instead. |
| "… still has N units in stock. Sell, transfer or write them off first." | Clear the stock before archiving or deactivating. |
| "N item(s) haven't been counted yet; enter 0 for anything not found" | Fill every line of the count, using 0 for missing items. |
| "Records changed since this file was checked…" | Review the import rows again and approve again. |

---

## 28. Words used in the CRM

| Word | Meaning |
|---|---|
| **POS** | Point of Sale: the counter checkout screen |
| **SKU** | The unique code of one variant, e.g. YG64-RED |
| **Variant** | One version of a product (a colour, size or model) |
| **Walk-in** | A customer whose details aren't recorded |
| **Available** | Sellable stock minus units held for orders |
| **Reserved / Allocated** | Units held for a confirmed order or pre-order |
| **Advance** | Money taken before the goods leave. Not a sale yet. |
| **Customer credit** | Money the shop holds for a customer, to use on future purchases or refund |
| **Outstanding** | Money customers still owe |
| **Credit days / limit** | How long a customer may take to pay, and the most they may owe |
| **Landed cost** | What an item really cost: price × exchange rate + freight, duty, etc. |
| **Recoverable tax** | GST/IGST you can claim back. Not part of the item's cost. |
| **COGS (Cost of goods)** | What the items you sold cost you |
| **Void** | Cancelling a payment or expense by adding an opposite entry |
| **Reversal** | Undoing a stock entry or transfer by adding an opposite entry |
| **Write-off** | Removing lost or destroyed stock |
| **AWB** | The courier's tracking number |
| **RTO** | "Return to origin": a parcel coming back undelivered |
| **Blind count** | A stock count where counters can't see what the system expects |
| **Business date** | The day an entry counts for (Indian time) |
| **Archive / Deactivate** | Hide from use without deleting. History is kept. |
