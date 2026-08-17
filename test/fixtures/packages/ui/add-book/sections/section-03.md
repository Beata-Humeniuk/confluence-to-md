---
type: view-design-part
part: section-03
parent: ../add-book.md
generator: view-exporter@1.0.0
generated: 2026-08-16
managed: true
---

## 3. Actions  _(Section)_

- **Save book** (`Button`) — `add-book.save-book` · 2 action steps
- **Cancel** (`Button`) — `add-book.cancel` · 1 action step

### Actions

```
Save book
  1. Endpoint      POST /books
     success → Open Modal → Book saved
  2. Navigate      Book list
     Note    → After the modal closes.
     success → —

Cancel
  1. Navigate      Book list
     success → —
```

### Validation

|  | Element | Note | Rule |
|---|---|---|---|
| △ | Save book | Endpoint action has no Error branch | `ACT-010` |
