# SnapShare: Scaling Plan

## Assumptions & DAU

To build a realistic scaling plan, we must start with explicit assumptions based on the brief.

**Assumptions:**
*   **Total Registered Users:** 10,000,000
*   **Daily Active Users (DAU) Percentage:** 10%
*   **Uploads per Active User:** 1 photo per day
*   **Feed Views per Active User:** 50 feed pages per day
*   **Average Photo Size:** 2 MB
*   **Average Thumbnail Size:** 50 KB
*   **Time Calculation:** We will use a standard day of 100,000 seconds (a common rounding trick to make mental math easier, slightly larger than the actual 86,400 seconds).

**Calculation:**
*   **Daily Active Users (DAU)** = Total Registered Users × % Active Daily
*   **DAU** = 10,000,000 × 10% = **1,000,000 DAU**

## System Load Calculations

**Uploads per day** = DAU × 1 photo/user/day = 1,000,000 uploads/day
**Uploads per second (average)** = Uploads per day ÷ 100,000 = **10 uploads/sec**
*(Peak uploads/sec is typically 5x average, so ~50 uploads/sec)*

**Feed views per day** = DAU × 50 views/user/day = 50,000,000 views/day
**Views per second (average)** = Views per day ÷ 100,000 = **500 views/sec**
*(Peak views/sec is 5x average, so ~2,500 views/sec)*

**Storage per year:**
*   Photo size + Thumbnail size = 2 MB + 0.05 MB = 2.05 MB per upload
*   Daily storage = 1,000,000 uploads × 2.05 MB = 2,050,000 MB/day
*   Yearly storage = 2,050,000 MB × 365 = 748,250,000 MB/year
*   **Converted to GB:** 748,250,000 MB ÷ 1024 = **~730,712 GB/year**
*   **Converted to TB:** 730,712 GB ÷ 1024 = **~713.5 TB/year**

## Read-Heavy or Write-Heavy?

This system is **dramatically read-heavy**.

**Comparison:** The system handles **500 average feed views per second** compared to only **10 average uploads per second**. That is a 50:1 ratio. At peak, the gap widens even further (2,500 views/sec vs. 50 uploads/sec).

**Implication for Design:** A read-heavy system means the architecture must prioritize fast, scalable data retrieval and content delivery over write performance. This necessitates:
1.  **CDNs:** To offload the massive volume of image reads from the origin servers, serving photos closer to users geographically.
2.  **Read Replicas:** To distribute the heavy database read load (fetching feed metadata) away from the primary write database.
3.  **Caching:** To store frequently accessed feed data in memory (like Redis) so the database doesn't get hammered by identical queries.

## Why Not Store Photos in the Database?

Storing photos (especially 2 MB files) directly inside a relational database as BLOBs (Binary Large Objects) is a significant anti-pattern for a system at this scale.

1.  **Bloat:** Databases are optimized for structured, queryable data, not multi-megabyte binary files. Storing photos in the DB would cause it to balloon to hundreds of terabytes in a single year.
2.  **Performance Degradation:** Backups would take days, and queries (even simple ones) would slow down significantly as the database engine struggles to manage massive page files containing binary data.
3.  **Cost:** Relational database storage is extremely expensive compared to dedicated object storage.
4.  **Where they should go:** Photos should be stored in **Object Storage** (like AWS S3 or Google Cloud Storage). Object storage is purpose-built for large, unstructured binary files, is incredibly cheap, and serves files via HTTP efficiently.

## Component Explanations

*   **CDN:** Solves the problem of high latency and origin load by caching and serving static assets (photos, thumbnails) from edge locations close to the user, instead of every request hitting the origin.
*   **Load Balancer:** Solves the problem of a single point of failure and uneven load by distributing incoming requests across a fleet of stateless app servers.
*   **App Servers (Stateless):** Solves the problem of scaling compute by allowing any instance to handle any request; instances can be added or removed freely since no session state lives on them.
*   **Cache (Redis):** Solves the problem of repeated, expensive database reads by storing frequently accessed feed data in memory, cutting read pressure on the database.
*   **Database (Primary) + Read Replica:** Solves the problem of mixing heavy read traffic with write traffic by splitting them: writes go to the primary, and the much larger volume of feed-metadata reads is offloaded to one or more read replicas.
*   **Object Storage:** Solves the problem of storing large binary files cheaply and durably — used for both original photos and their generated thumbnails.
*   **Queue + Worker Servers:** Solves the problem of slow, resource-intensive thumbnail generation blocking the upload request by decoupling that work into an asynchronous job a worker picks up later.

## Upload Flow

1.  User uploads a photo via the client.
2.  Request hits the Load Balancer, which routes it to an App Server.
3.  The App Server saves the original photo to Object Storage.
4.  The App Server writes the photo's metadata to the primary Database.
5.  The App Server enqueues a thumbnail-generation job on the Queue.
6.  The App Server responds to the client — the upload is considered complete at this point.
7.  A Worker picks up the job from the Queue.
8.  The Worker generates the thumbnail and saves it to Object Storage.
9.  The Worker updates the Database with the thumbnail's URL.

## Trade-offs

**Eventual Consistency vs. Immediate Availability:** Because thumbnail generation is asynchronous, there's a short window right after upload where the thumbnail doesn't exist yet. A user (or their followers) viewing the feed in that window sees a broken image or placeholder instead of the thumbnail. We accept this trade-off because it keeps the upload request itself fast; the alternative (generating the thumbnail synchronously) would make every upload slow and tie up app server resources.

**Staleness vs. Scalability:** Offloading reads to a read replica (and to the cache) means feed data can be slightly stale, since replication is asynchronous. The concrete symptom: a user might not immediately see their own just-uploaded photo in their feed if that read gets routed to a replica that hasn't caught up yet. We accept this because without replicas and caching, the primary database would be overwhelmed by the 50:1 read-to-write ratio at this scale.

## Architecture Diagram

```text
                                  [ User Client ]
                                    /        \
                       (View Feed) /          \ (Upload Photo)
                                  v            v
                           [ CDN Edge ]        |
                                  |            |
                                  v            v
                        [ Load Balancer ] <----+
                                  |
                                  v
                        [ App Servers (Stateless) ]
                         /        |           \            \
                        /         |            \            \
           (Read Feed Views)      |             \            \
                      /           v              v            v
                     /     [ Database ]      [ Object     [ Queue ]
                    /        (Primary)       Storage ]   (Redis/SQS)
                   /           ^  |           (Photos)        |
                  /            |  |                           v
                 /             |  | (Async Replication) [ Worker Servers ]
                /              |  |                     (Generate Thumbs)
                v              |  v                           |
        [ Read Replica ] <-----+  +---------------------------+ 
                                  | (Metadata Update)         |
                                  |                           v
                                  |                    [ Object Storage ]
                                  +------------------- (Thumbnails)
```

**Diagram notes:**
*   `App Servers → Read Replica` (labeled *Read Feed Views*) is the hot read path for feed metadata, kept separate from replication.
*   `Database (Primary) → Read Replica` (labeled *Async Replication*) is the replication stream that keeps the replica in sync.
*   `Queue → Worker Servers → Object Storage (Thumbnails)` is the decoupled thumbnail pipeline.
*   `Worker Servers → Database (Primary)` (labeled *Metadata Update*) closes the loop by writing the thumbnail's URL back once it's generated, matching step 9 of the Upload Flow above.
