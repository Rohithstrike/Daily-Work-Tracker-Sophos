# Future feature: offline write queue

The first production version deliberately does **not** queue writes offline. It detects connection
failures, tells the user that a write was not saved, and never presents an unsaved activity as
persisted. PostgreSQL remains authoritative at all times.

This document records the intended design so the feature can be added later without compromising
data correctness.

## Design

1. **Client-generated idempotency key**
   Every mutation carries a UUID `client_mutation_id` generated before the request. A unique index
   on that column makes replays safe: a retried write can never create a duplicate row.

2. **Pending-sync state**
   Queued mutations are stored in IndexedDB with `status: 'pending' | 'syncing' | 'failed'`.
   The UI labels affected entries clearly as *Not yet saved* — never as saved.

3. **Replay when online**
   A background worker drains the queue in insertion order when `navigator.onLine` becomes true,
   preserving the causal order of start/stop events within a workday.

4. **Server reconciliation**
   After a successful replay the client refetches the affected workday and replaces local state
   with the server response. Conflicts (for example, a day completed on another device) are
   resolved in favour of the server, and the user is told which entries need re-entering.

5. **Database remains authoritative**
   IndexedDB is a transient outbox only. It is cleared once the server acknowledges each mutation
   and is never read as a source of truth for reports, history or exports.

## Non-goals

- No optimistic "saved" messaging before the server confirms a write.
- No local-first merge strategy that could diverge from the database.
- No offline support for finishing a day or completing a month; those are explicit,
  server-confirmed state transitions.
