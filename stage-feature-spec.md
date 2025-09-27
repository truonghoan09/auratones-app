# 🎼 Stage & Chord Feature Specification

## 1. Mục tiêu
- Quản lý hợp âm: hệ thống, riêng tư (user), đóng góp.
- Stage: phòng realtime để share hợp âm, xem sheet chung, history giới hạn theo plan.
- Cho phép xin/chia sẻ hợp âm trong stage.

---

## 2. Data Schema

### 2.1. User & Plan
```ts
/users/{uid}
  plan: "free" | "pro"
  entitlements: { maxStages, stageHistoryDays, stageHistoryMaxSizeMB }
  usage: { activeStagesOwned, stageBytesUsed }
```

### 2.2. Chords
- System: `/chords/{chordId}`
- User private: `/users/{uid}/my_chords/{docId}`

### 2.3. Stages
```ts
/stages/{stageId}
  ownerId, title, status
  limits: { historyDays, historyMaxSizeMB, maxMembers }
```

#### Members
```ts
/stages/{stageId}/members/{uid}
  role: "owner" | "mod" | "member"
```

#### Events (History, quota-limited)
```ts
/stages/{stageId}/events/{eventId}
  type, actorId, payload, createdAt, bytes
```

#### Stage Chords (snapshots)
```ts
/stages/{stageId}/chords/{stageChordId}
  from: { source: "user"|"system", ownerId?, userChordPath?, systemId? }
  instrument, symbol, variants[]
  createdBy, createdAt
```

#### Requests (xin hợp âm)
```ts
/stages/{stageId}/requests/{reqId}
  chordRef: { stageChordId, symbol, ownerId }
  requesterId
  status: "pending" | "approved" | "rejected"
  decidedBy?, decidedAt?
```

---

## 3. Hành vi

### Share chord vào stage
- Tạo snapshot trong `/stage/{id}/chords`.
- Ai cũng thấy được trong stage, kể cả nếu chord gốc private.

### Xin hợp âm
- Request → pending.
- Chủ sở hữu approve ⇒ clone chord sang kho người xin.
- Reject ⇒ người xin chỉ xem được trong stage.

### Lịch sử & Quota
- Ghi mọi hành động vào `/events`.
- Cloud Function cleanup theo `historyDays` và `historyMaxSizeMB`.

---

## 4. TypeScript Types

```ts
type Stage = { id, ownerId, title, limits, ... };
type StageMember = { uid, role, joinedAt };
type StageChord = { id, from, instrument, symbol, variants, ... };
type StageRequest = { id, chordRef, requesterId, status, ... };
type StageEvent = { id, type, actorId, payload, createdAt, bytes };
```

---

## 5. Plan & Giới hạn
- Free: số stage nhỏ, history ngắn, dung lượng thấp.
- Pro: nhiều stage, history dài, dung lượng lớn.

---

## 6. UI/UX
- Tab “Chia sẻ hợp âm” trong stage.
- Tab “Yêu cầu hợp âm” cho chủ sở hữu.
- Badge “Stage chord” khi chord đến từ snapshot.
