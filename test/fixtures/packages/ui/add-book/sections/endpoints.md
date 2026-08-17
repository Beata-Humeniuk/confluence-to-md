---
type: view-design-part
part: endpoints
parent: ../add-book.md
generator: view-exporter@1.0.0
generated: 2026-08-16
managed: true
---

## 4. Endpoints

| Operation | Request | Response | Notes |
|---|---|---|---|
| `POST /books` | `request.json` | `response.json`<br>HTTP 400 — validation rejected (`error-400.json`) | Saves a new book. |
| `GET /dictionaries/genres` | — | `genres.json` |  |
