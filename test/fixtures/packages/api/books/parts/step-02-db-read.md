---
type: api-design-part
part: step-02
parent: ../api.md
generator: flow-exporter@1.0.0
generated: 2026-08-17
managed: true
---

## 2. Duplicate check — database read

Reads the catalogue by ISBN. An existing book with the same ISBN ends the
flow with HTTP 409, code BOK-409.
