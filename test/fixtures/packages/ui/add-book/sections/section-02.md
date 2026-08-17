---
type: view-design-part
part: section-02
parent: ../add-book.md
generator: view-exporter@1.0.0
generated: 2026-08-16
managed: true
---

## 2. Loan parameters  _(Section)_

- **Copies** (`Input`) — `add-book.copies` · required · 1 - 100 · → `loan.copies` to `POST /books`
- **Loan period** (`Select`) — `add-book.loan-period` · dictionary: 7, 14, 30 · **⨯ 1 error**
- **Available from** (`Date Picker`) — `add-book.available-from` · conditionally visible: `book.type == 'NEW'` · *1 open question* · **⨯ 1 error**
- **Reservation queue** (`Table`) — `add-book.reservations` · ← `reservations` from `POST /books`

### Data — Request

| Component | Endpoint | Field | Required | Validation | Transform | Default | Notes |
|---|---|---|---|---|---|---|---|
| Copies | `POST /books` | `loan.copies` | true | 1 - 100 |  |  |  |

### Data — Response

| Component | Type | Endpoint | Field | Notes |
|---|---|---|---|---|
| Reservation queue | Table | `POST /books` | `reservations` |  |

### Tables and columns

#### Reservation queue  _(Table)_

| Column | Data field | Sorting | Filter |
|---|---|---|---|
| Position | `reservations[].position` | true | false |
| Reserved on | `reservations[].reservedOn` | true | true |
| Member | — | false | false |

### Validation

|  | Element | Note | Rule |
|---|---|---|---|
| ⨯ | Loan period | Component is not bound to a data endpoint | `DAT-004` |
| ⨯ | Available from | Component is not bound to a data endpoint | `DAT-004` |
| △ | Reservation queue | Column “Member” has no data field | `TBL-006` |
