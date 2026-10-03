# Northstar Support Deflection MVP — CLI Chatbot (Node.js)

A terminal-based decision-tree chatbot covering **Order Status** and **Returns & Refunds**
end-to-end against a mock dataset. No browser, no HTML — this runs entirely in a terminal via
Node.js.

`stock.js` (Stock Availability) exists in this repo as category logic and mock lookup data,
but is **not wired into the menu** — it was scoped as a stretch goal and wasn't picked up this
sprint. See the Go-Live Readiness Note for the exact next step to wire it in.

## Run it

Requires Node.js (any reasonably recent version — built and tested on v22).

```bash
node main.js
```

You'll see a numbered menu. Type a number and press enter to pick a category, follow the
prompts, then `0` to exit.

## Files

| File | Depends on | Purpose |
|---|---|---|
| `main.js` | all files below | Entry point — menu loop, run this one |
| `data.js` | — | Mock dataset (`ORDERS`, `STOCK`). Replace before go-live. |
| `lookup.js` | `data.js` | `findOrder()` — shared by Order Status and Returns |
| `orderStatus.js` | `lookup.js` | Order Status category logic |
| `returns.js` | `lookup.js` | Returns & Refunds category logic |
| `stock.js` | `data.js` | Stock Availability category logic |

## A note on how input works here

This uses Node's `readline` module via its **async-iterator** form, not repeated
`rl.question()` calls. That's a deliberate choice, not a style preference: `rl.question()`
is known to drop answers when input isn't a live terminal (e.g. when testing by piping input
in from a file), because a line can arrive before the next `question()` call is listening for
it. The async-iterator form queues input correctly regardless of timing. If you extend this
with more prompts, keep using `ask()` from `main.js` rather than calling `rl.question()`
directly in a new category file.

## Setting this up as a real repo with a real commit history

```bash
git init

git add data.js
git commit -m "setup: add mock order/customer dataset – unblocks order-status and returns logic work"

git add lookup.js
git commit -m "setup: add shared order lookup helper – used by order-status and returns modules"

git add orderStatus.js
git commit -m "feature: add order-status CLI category – covers ticket type 1 end-to-end"

git add returns.js
git commit -m "feature: add returns eligibility and refund-timeline logic – covers ticket type 2, meets the 2-of-3 minimum"

git add stock.js
git commit -m "feature: add stock-availability category logic – prepped for later, not wired into menu this sprint"

git add main.js
git commit -m "feature: add menu loop tying order-status and returns together – full app runnable end-to-end for the 2 committed categories"
```

Keep committing in small real pieces as you actually build — don't paste all six files in and
backdate the history the night before submission. Update the Project Board's Status column the
*same day* as each commit.

## Known limitations

See the Go-Live Readiness Note for the full list — in short: mock data only, no
authentication, no logging, and this is single-agent/single-session (no shared backend across
multiple simultaneous users).
