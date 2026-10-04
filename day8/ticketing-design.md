# TicketHub: System Design

TicketHub is a website that sells tickets for concerts and events. This document follows the six-part design framework: requirements, estimates, API, data model, architecture, and trade-offs, with a dedicated section on how the design prevents two people from buying the same seat.

**Facts used:** 2 million registered users; 50,000 people visit on a normal day, each viewing 10 pages; 5,000 tickets are sold on a normal day; when a popular concert goes on sale, 200,000 people try to buy its 20,000 seats within the first 10 minutes.

## 1. Requirements

### Functional requirements

* Users can browse upcoming events.
* Users can view the seat map and seat availability for an event.
* Users can place a temporary hold on a seat while they check out.
* Users can pay for a held seat, which turns the hold into a confirmed order.
* Users can view the tickets they have purchased.

### Non-functional requirements

* **Speed:** browsing events and seat maps should respond in under 300 ms on a normal day. During a big sale the system must stay responsive and degrade gracefully (for example, by queueing users) rather than hang or time out.
* **Correctness:** a seat must never be sold to more than one person. This has zero tolerance: a double-sold seat is a real-world failure, not a stale page.
* **Fairness:** when 200,000 people compete for 20,000 seats, access should be ordered deliberately (by arrival into a queue), not decided by who sends the most retries or who happens to hit a less-loaded server.
* **Availability and durability:** once a payment succeeds, the order must not be lost, and the system must stay up through the sale-day spike.

## 2. Estimates

Assumption: a day is rounded to 100,000 seconds, and normal-day peak is 5x the average.

### Normal day

| Metric | Per day | Per second (avg) | Per second (5x peak) |
| --- | --- | --- | --- |
| Page views (reads) | 50,000 visitors × 10 pages = 500,000 | 5 | 25 |
| Tickets sold (writes) | 5,000 | 0.05 | 0.25 |

### Big sale (first 10 minutes = 600 seconds)

| Metric | Calculation | Per second |
| --- | --- | --- |
| Purchase attempts | 200,000 ÷ 600 | about 333 |
| Page views (assumes each person views the usual 10 pages) | 2,000,000 ÷ 600 | about 3,333 |
| Successful sales (if every seat sells out) | 20,000 ÷ 600 | about 33 |

### Comparison

* Reads during the sale are about **667x** the normal average (3,333 vs 5 per second), and about 133x the normal peak (25 per second).
* Purchase attempts are about **6,667x** the normal sales rate (333 vs 0.05 per second).
* 90% of attempts must fail (200,000 people for 20,000 seats), so the system will mostly be saying "no" and has to do it quickly and correctly.
* 200,000 people in 10 minutes is 4x a normal full day of visitors.

**Implications:** the spike is under 1% of a day but two to three orders of magnitude above normal, so we absorb and shape it rather than provisioning for it all year. The hard part is write contention on the same 20,000 seat rows, not raw volume. The seat map is read constantly but changes fast during a sale, so caching it trades staleness for load.

## 3. API

Base URL: `https://api.tickethub.example/v1`. All endpoints except the event listing require a logged-in user (bearer token). Login and registration work as in the QuickNotes API and are left out here to keep the focus on the ticketing flow.

| Method | Path | Description | Success status |
| --- | --- | --- | --- |
| GET | `/events` | List upcoming events | 200 |
| GET | `/events/{event_id}/seats` | View seat map and availability (filter by `section`, `status`) | 200 |
| POST | `/events/{event_id}/seats/{seat_id}/hold` | Place a temporary hold on a seat (on sale days, requires an admission token) | 201 |
| DELETE | `/events/{event_id}/seats/{seat_id}/hold` | Release your own hold early | 204 |
| POST | `/orders` | Pay for held seats and create an order | 201 |
| GET | `/me/tickets` | View the tickets you have purchased | 200 |
| POST | `/events/{event_id}/waiting-room` | Join the waiting room for a popular sale | 202 |
| GET | `/events/{event_id}/waiting-room/status` | Check your queue position; returns an admission token once you are let in | 200 |

### Example: hold a seat

`POST /events/42/seats/1507/hold`

Response, `201 Created`:

```json
{
  "event_id": 42,
  "seat_id": 1507,
  "status": "held",
  "hold_expires_at": "2026-12-05T19:05:00Z"
}
```

If someone else got there first, `409 Conflict`:

```json
{ "error": { "code": 409, "message": "Seat 1507 is no longer available." } }
```

### Example: pay for a held seat

`POST /orders` with header `Idempotency-Key: 7c1e9a52-...` so a retried request can never charge twice.

```json
{
  "event_id": 42,
  "seat_ids": [1507],
  "payment_token": "tok_abc123"
}
```

Response, `201 Created`:

```json
{
  "order_id": 9001,
  "status": "paid",
  "total_cents": 8500,
  "tickets": [
    { "ticket_code": "TH-42-1507", "seat_label": "A-17" }
  ],
  "created_at": "2026-12-05T19:02:11Z"
}
```

### Waiting-room endpoints (sale days)

For a popular sale, a buyer first joins the waiting room (`POST .../waiting-room`, which returns `202 Accepted` and a queue ticket). The client then polls the status endpoint until it is admitted:

```json
{ "position": 18432, "estimated_wait_seconds": 240, "admitted": false }
```

Once admitted, the response includes a short-lived, signed `admission_token`, which the client sends with hold requests. The reasoning behind this design is in section 6.

### Error codes

| Status | When it happens |
| --- | --- |
| 400 Bad Request | Malformed request, for example no `seat_ids` |
| 401 Unauthorized | Missing or invalid login token |
| 403 Forbidden | Trying to hold a seat during a sale without an admission token (you have not been let in yet) |
| 402 Payment Required | The payment was declined |
| 404 Not Found | The event or seat does not exist |
| 409 Conflict | The seat is already held or sold, or your hold expired or belongs to someone else |
| 429 Too Many Requests | Rate limit hit (protects fairness during a sale) |
| 500 Internal Server Error | Unexpected server failure |

## 4. Data Model

Five tables: `users`, `events`, `seats`, `orders`, and `order_items`. The first four are the core entities; `order_items` links an order to the seats it contains.

### Relationships

* `events` → `seats`: **one-to-many.** An event has thousands of seats; each seat belongs to exactly one event (`seats.event_id`).
* `users` → `orders`: **one-to-many.** A user can place many orders; each order belongs to one user (`orders.user_id`).
* `events` → `orders`: **one-to-many.** Each order is for one event (`orders.event_id`).
* `orders` ↔ `seats`: modelled as many-to-many through `order_items`, but a unique constraint on `order_items.seat_id` means a seat can appear in **at most one** order. In practice that is one order to many seats, and one seat to zero or one order.
* `users` → `seats` (holds): a seat can be temporarily held by one user (`seats.held_by`). This is transient state, cleared when the hold expires or the seat is sold.

### CREATE TABLE statements

```sql
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    venue      VARCHAR(200) NOT NULL,
    starts_at  TIMESTAMPTZ NOT NULL,
    on_sale_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE seats (
    id              BIGSERIAL PRIMARY KEY,
    event_id        BIGINT NOT NULL REFERENCES events(id),
    section         VARCHAR(20) NOT NULL,
    row_label       VARCHAR(10) NOT NULL,
    seat_number     INTEGER NOT NULL,
    price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
    status          VARCHAR(10) NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'held', 'sold')),
    held_by         BIGINT REFERENCES users(id),
    hold_expires_at TIMESTAMPTZ,
    UNIQUE (event_id, section, row_label, seat_number),
    CHECK (
        (status = 'held' AND held_by IS NOT NULL AND hold_expires_at IS NOT NULL)
        OR
        (status <> 'held' AND held_by IS NULL AND hold_expires_at IS NULL)
    )
);

CREATE TABLE orders (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    event_id        BIGINT NOT NULL REFERENCES events(id),
    status          VARCHAR(10) NOT NULL DEFAULT 'paid'
                    CHECK (status IN ('paid', 'refunded')),
    total_cents     INTEGER NOT NULL CHECK (total_cents >= 0),
    idempotency_key VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key)
);

CREATE TABLE order_items (
    order_id    BIGINT NOT NULL REFERENCES orders(id),
    seat_id     BIGINT NOT NULL REFERENCES seats(id),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    PRIMARY KEY (order_id, seat_id),
    UNIQUE (seat_id)
);
```

### Indexes

```sql
CREATE INDEX idx_seats_event_status ON seats (event_id, status);
CREATE INDEX idx_seats_hold_expiry  ON seats (hold_expires_at) WHERE status = 'held';
CREATE INDEX idx_orders_user        ON orders (user_id);
```

* `idx_seats_event_status` serves the seat map (`GET /events/{id}/seats?status=available`), the most-read query in the system.
* `idx_seats_hold_expiry` is a partial index covering only held seats, so the background job that releases expired holds scans a tiny set instead of all 20,000 seats.
* `idx_orders_user` serves `GET /me/tickets`.

### Constraints that protect correctness

* `UNIQUE (seat_id)` on `order_items`: the database itself refuses to attach one seat to two orders, even if application code has a bug.
* The `CHECK` on `seats`: a seat is `held` only if it has a holder and an expiry, and has neither otherwise, so a half-held seat cannot exist.
* `UNIQUE (user_id, idempotency_key)` on `orders`: a retried payment request cannot create a second order.

## 5. How the Design Prevents Two People Buying the Same Seat

**Principle:** only the primary database decides who gets a seat. The cache, the CDN, and the waiting room can all be wrong or stale without causing a double-sale, because none of them is allowed to grant a seat.

Three layers enforce this.

### Layer 1: an atomic conditional update when holding a seat

```sql
UPDATE seats
SET status = 'held', held_by = :user_id, hold_expires_at = now() + interval '5 minutes'
WHERE id = :seat_id
  AND (status = 'available'
       OR (status = 'held' AND hold_expires_at <= now()));
```

The application checks how many rows the statement changed. **1 row** means this user won the seat (`201`). **0 rows** means someone else already has it (`409 Conflict`).

This is race-safe because the check and the change happen in a single statement. When two requests target the same seat, the database locks the row for the first one. The second waits, then re-evaluates the `WHERE` clause against the updated row, sees `status = 'held'`, and matches nothing. The unsafe alternative is "SELECT the status, then UPDATE if it was available": two requests can both read `available` before either writes, and both think they won.

Expired holds are handled in the same `WHERE` clause, so correctness never depends on a cleanup job having run. The background job that resets expired holds only keeps the seat map tidy.

### Layer 2: one transaction when paying

When the user pays, the order is finalised in a single short transaction:

1. Flip the seat from held to sold, but only if this user still holds it and the hold has not expired:

   ```sql
   UPDATE seats
   SET status = 'sold', held_by = NULL, hold_expires_at = NULL
   WHERE id = :seat_id AND status = 'held'
     AND held_by = :user_id AND hold_expires_at > now();
   ```

2. Insert the row in `orders` and the row in `order_items`.
3. Commit. If any step fails, the whole transaction rolls back and nothing is half-done.

The hold is what makes it safe to take the payment first: nobody else can take the seat during the hold window. If the finalising update changes 0 rows (the hold expired while the user was paying), the payment is refunded automatically and the user gets `409`. The `Idempotency-Key` ensures a retried request cannot charge twice or create a second order.

### Layer 3: a unique constraint as the safety net

`UNIQUE (seat_id)` on `order_items` means the database refuses to attach one seat to two orders. If a bug in the application ever got past Layers 1 and 2, the second insert would fail and the transaction would roll back. The `CHECK` constraint on `seats` also guarantees a seat is never half-held.

### What does not protect against double-booking

* **The cache and CDN** only speed up reads. A cached seat map can show a sold seat as available, and that is acceptable because the click still goes through Layer 1 and gets a `409`.
* **The waiting room** controls the order people arrive in (fairness) and protects the servers. It does not decide who owns a seat.
* **An in-memory lock inside one app server** would not work, because there are many app servers.

## 6. Architecture

### Diagram

```text
                              [ Client (Browser / Mobile) ]
                                            |
                                            v
                                         [ DNS ]
                                            |
                                            v
                                      [ CDN Edge ]  (static files, cached event pages)
                                            |
                                            v
                            [ Load Balancer + Rate Limiter ]
                                            +-----------------------------------+
                                  (browse)  |  (buy: hold / pay)                |
                                            |                                   v
                                            |                           [ Waiting Room ]
                                            |                      (queue + admission tokens)
                                            |                                   |
                        (charge)            v                                   |
   [ Payment Provider ]<-----[ App Servers (Stateless) x N ]<-------------------+
                                            |
              +-----------------------------+---------------------+-------------------+
              |                             |                     |                   |
              v                             v                     v                   v
      [ Cache (Redis) ]              [ Primary DB ]------>[ Read Replica ]        [ Queue ]
                                            ^        (async replication)              |
                                            |                                         |
                                            |                                         |
                                            |                                         v
                                            +---(release expired holds)--------- [ Workers ]
```

**Diagram notes:**

* **Browsing** (events, seat maps) goes straight from the load balancer to the app servers, with the CDN and cache absorbing most of it. **Buying** (hold, pay) on a popular sale goes through the waiting room first, which hands out signed admission tokens. App servers verify the token's signature themselves, so they do not call the waiting room on every request.
* App servers read from the **Cache** first. On a miss they read from the **Read Replica**, then fill the cache.
* All writes (holds, orders) go to the **Primary DB**, which is the only component that decides who owns a seat (section 5). It replicates asynchronously to the **Read Replica**.
* After a successful order, the app server puts a job on the **Queue**. **Workers** send the confirmation and ticket, and they also run the job that releases expired holds back to the **Primary DB**.
* The **Payment Provider** is an external service. It is called with the order's idempotency key.

### Components and the problem each one solves

* **DNS:** maps the TicketHub domain to our entry point, so clients know where to connect.
* **CDN Edge:** serves static files and cached event pages from locations close to the user, so most read traffic never reaches our servers.
* **Load Balancer + Rate Limiter:** spreads requests across app servers, and limits requests per user and IP so one script cannot flood a sale.
* **Waiting Room:** puts buyers in a Redis-backed queue in arrival order and admits them at a controlled rate. It solves the start-of-sale stampede and the fairness requirement.
* **App Servers (stateless):** run the API logic. Because they hold no session state, we can add many more before a sale.
* **Cache (Redis):** stores event pages and per-section seat maps with a 1 to 2 second lifetime, so thousands of seat-map requests per second become roughly one database query per section per interval.
* **Primary DB:** the single authority for holds and orders, where the atomic updates and unique constraints from section 5 live.
* **Read Replica:** serves reads that miss the cache (event list, "my tickets"), so they do not compete with writes for the same seat rows.
* **Payment Provider:** charges the card, so we never handle raw card data.
* **Queue + Workers:** run slow or periodic work (confirmation emails, ticket generation, releasing expired holds) off the request path, so checkout stays fast.

### How the design survives the big sale

1. **We know the sale time in advance.** Unlike most traffic spikes, this one is scheduled, so before `on_sale_at` we add app servers and pre-warm the cache with the event page and seat maps.
2. **Reads are absorbed before they reach the database.** The roughly 3,333 reads per second are served mostly by the CDN and cache. The database sees about one seat-map query per section per cache lifetime.
3. **The first seconds matter more than the 10-minute average.** If even half of the 200,000 people click in the first 10 seconds, that is about 10,000 requests per second, around 30x the 10-minute average of 333 purchase attempts per second. The waiting room absorbs this with cheap queue operations and tiny responses, then lets people in at a rate the app servers and database handle comfortably.
4. **Fairness comes from queue order.** Your position is set when you join and does not improve by refreshing or retrying. The rate limiter blocks scripts that hammer the API.
5. **Contention is limited to single-row atomic updates.** Admitted buyers compete for seats with the conditional updates from section 5. Losers get an immediate `409`, and once the seats are gone the waiting room can announce "sold out" and stop admitting.
6. **Overload slows admission instead of crashing the system.** If app servers or the database get slow, the waiting room admits fewer people per second. Buyers wait longer, but the system stays up.
7. **Slow work is off the critical path.** Emails, ticket generation, and cleanup all happen in workers.

### Single points of failure

* **Load balancer:** run as a redundant pair or a managed service.
* **App servers:** many instances across availability zones; one failing does not matter.
* **Primary DB:** a standby is kept in sync and can be promoted automatically if the primary fails. Backups protect against data loss.
* **Redis (cache and waiting room):** runs with replicas. If waiting-room state were lost, people would re-join the queue, which is annoying but never unsafe, because the database still decides who owns a seat.
* **Workers:** several run at once. Expired holds are also treated as available directly in the Layer 1 `WHERE` clause, so a stopped cleanup job cannot cause a double-booking.

## 7. Trade-offs

Each trade-off below names the choice, what it costs, the alternative that was considered, and why the cost is acceptable.

### 1. Fairness vs. speed and simplicity (the waiting room)

* **Choice:** buyers for a popular sale wait in a queue and are admitted at a controlled rate.
* **Cost:** people wait, sometimes for minutes, even if the servers could have taken them sooner. It also adds a component to build, run, and monitor.
* **Alternative considered:** let everyone hit the API at once. That is simpler and feels faster to the lucky few, but it favours whoever has the fastest connection or script, and it risks overwhelming the servers in the first seconds.
* **Why we accept it:** fairness and staying up are two of our stated requirements, and a visible, honest queue is better than random timeouts.

### 2. Stale seat maps vs. database load (caching)

* **Choice:** seat maps are cached for 1 to 2 seconds per section.
* **Cost:** a user can see a seat as available after it has just been taken, click it, and get a `409 Conflict`.
* **Alternative considered:** read every seat map straight from the primary. That would always be fresh, but thousands of reads per second would compete with the writes on the same rows.
* **Why we accept it:** staleness only affects what the user sees, never who owns the seat. The decision is made by the atomic update in section 5, so the worst outcome is a disappointed click. The short lifetime keeps the map close to the truth.

### 3. Hold duration: long vs. short

* **Choice:** a hold lasts 5 minutes.
* **Cost:** a held seat is unavailable to everyone else, so abandoned checkouts keep seats locked for up to 5 minutes. In a 10-minute sale that is a meaningful share of the window.
* **Alternative considered:** a very short hold (for example 1 minute) would free abandoned seats quickly, but many real buyers would not finish entering payment details in time and would lose their seat mid-checkout.
* **Why we accept it:** losing a seat during payment is a worse experience than waiting for an abandoned seat to free up. The duration is a single setting, and it can be tuned per event using real checkout times.

### 4. One primary database: simple correctness vs. write scalability

* **Choice:** all holds and orders go through a single primary database.
* **Cost:** it is a ceiling on write throughput and the one place a failure hurts, so it needs a standby and automatic failover.
* **Alternative considered:** split the data across several databases (for example by event), or use several primaries. This scales writes further, but it brings cross-database transactions, conflict resolution, and much harder correctness reasoning.
* **Why we accept it:** the real write load is small. The peak is about 333 purchase attempts per second and at most about 33 successful sales per second, which a single well-provisioned PostgreSQL primary handles comfortably. Keeping one source of truth is what makes the no-double-booking guarantee simple to reason about. If we ever outgrow it, splitting by `event_id` is a natural next step, since an event's seats never interact with another event's.
