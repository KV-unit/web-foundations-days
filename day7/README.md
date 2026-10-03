
# SnapShare Scaling Plan

A system design exercise: scaling plan and architecture for **SnapShare**, a photo-sharing app, from an initial brief of 10,000,000 registered users.

## Contents

The full write-up lives in [`SCALING_PLAN.md`](./SCALING_PLAN.md) and covers:

*   **Assumptions & DAU** — the explicit numbers the rest of the plan is built on.
*   **System Load Calculations** — average and peak uploads/sec, feed views/sec, and yearly storage growth.
*   **Read-Heavy or Write-Heavy?** — a 50:1 read-to-write ratio and what that implies for the design.
*   **Why Not Store Photos in the Database?** — why photos and thumbnails belong in object storage, not as DB blobs.
*   **Component Explanations** — what each piece of the architecture (CDN, load balancer, cache, primary/replica DB, object storage, queue/workers) solves and why.
*   **Upload Flow** — the step-by-step path of a photo from client upload to thumbnail availability.
*   **Trade-offs** — eventual consistency vs. immediate availability, and staleness vs. scalability.
*   **Architecture Diagram** — an ASCII diagram of the full system, including the async thumbnail pipeline and the read-replica split.

## Key numbers

| Metric | Average | Peak (5x) |
| --- | --- | --- |
| Uploads/sec | 10 | 50 |
| Feed views/sec | 500 | 2,500 |

Yearly storage growth: ~713.5 TB/year.

## Status

Reviewed and finalized — architecture diagram includes the read-replica read path, async replication, and the worker-to-database metadata update, all consistent with the written upload flow.
