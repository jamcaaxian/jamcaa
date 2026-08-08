# Counters live in Durable Objects

View counts, likes, and bookmarks are handled by Durable Objects rather than written straight to the primary database.

The primary database executes serially on a single thread. Writing to it on every page view would spend that scarce execution capacity on counting rather than on serving content queries, and infinite scroll on listing pages multiplies the write volume further. A Durable Object gives each counted target its own serialised execution unit, preserving strong consistency while moving the write pressure off the primary database entirely.

## Considered Options

- **Write to the primary database in real time**: simplest to implement and the most accurate numbers, but it spends the scarcest resource on the least important writes.
- **Buffer in a key-value store and flush on a schedule**: no new infrastructure, but counts lag by minutes, and likes and bookmarks are exactly the interactions where users expect immediate feedback.
- **Durable Objects** (adopted): strongly consistent and high throughput, at the cost of taking on one more kind of infrastructure.
