---
type: api-design-part
part: step-01
parent: ../api.md
generator: flow-exporter@1.0.0
generated: 2026-08-17
managed: true
---

## 1. Request validation — validation

Checks that the input data is complete and correct.

| Condition | When not met |
|---|---|
| book.isbn — 13 digits, valid check digit | HTTP 400, code VAL-002 |
| loan.copies within 1 – 100 | HTTP 400, code VAL-011 |
| loan.periodDays from the period dictionary | HTTP 400, code VAL-012 |
