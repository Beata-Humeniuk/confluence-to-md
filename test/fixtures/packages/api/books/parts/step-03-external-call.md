---
type: api-design-part
part: step-03
parent: ../api.md
generator: flow-exporter@1.0.0
generated: 2026-08-17
managed: true
---

## 3. Rating lookup — Ratings service call

Calls the Ratings service. The returned rating feeds the shelf assignment;
when the service is unavailable, the book is treated as unrated (open
question).
