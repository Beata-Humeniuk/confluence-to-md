---
type: view-design-part
part: section-01
parent: ../add-book.md
generator: view-exporter@1.0.0
generated: 2026-08-16
managed: true
---

## 1. Book details  _(Section)_

- **Title** (`Input`) — `add-book.title` · required · max 200 · → `book.title` to `POST /books`
- **ISBN** (`Input`) — `add-book.isbn` · required · length 13 · pattern `^[0-9]{13}$` · → `book.isbn` to `POST /books` · Check digit verified by the service.
- **Genre** (`Select`) — `add-book.genre` · dictionary: FANTASY, SCIFI, CRIME · ← `genres[].code` from `GET /dictionaries/genres` · *1 open question*

### Data — Request

| Component | Endpoint | Field | Required | Validation | Transform | Default | Notes |
|---|---|---|---|---|---|---|---|
| Title | `POST /books` | `book.title` | true | max 200 |  |  |  |
| ISBN | `POST /books` | `book.isbn` | true | length 13, `^[0-9]{13}$` |  |  |  |

### Data — Response

| Component | Type | Endpoint | Field | Notes |
|---|---|---|---|---|
| Genre | Select | `GET /dictionaries/genres` | `genres[].code` |  _(auto)_ |
