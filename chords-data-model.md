# 🎵 Chords Data Model — Spec & Conventions

> Bản mô tả cấu trúc dữ liệu hợp âm (canonical & voicings), quy tắc đặt ID, ý nghĩa các trường, và thao tác CRUD/Query điển hình. Áp dụng cho Firestore.

---

## Tổng quan kiến trúc

```
chords_system/
  canonical/             # Toàn bộ hợp âm chuẩn theo pc + recipe (KHÔNG slash ở batch khởi tạo)
    r0__maj              # ví dụ: C major
    r0__m                # C minor
    r0__7                # C7
    ...
    r11__7b9             # B7♭9
    # (Tùy chọn tương lai)
    # r0__maj/b4         # C/E (slash canonical, thêm sau)
  voicings/
    guitar/
      r0__maj            # tất cả voicing của C major (bassPc = rootPc)
      r0__maj_b4         # slash/inversion: C/E (bassPc=4)
      ...
    ukulele/
      r0__maj
      ...
    piano/
      r0__maj
      r0__maj_b4         # C/E (bass E)
      ...
```

---

## 1. Canonical Collection

### 🔑 ID quy tắc
- `r{pc}__{recipeId}`  
  - `pc`: pitch class (0=C, 1=C#/Db, …, 11=B).
  - `recipeId`: loại hợp âm, ví dụ: `maj`, `m`, `7`, `m7b5`, `13#11`.

### 📄 Document schema
```json
{
  "pc": 0,                         // root pitch class (0–11)
  "recipeId": "maj",               // loại hợp âm
  "intervals": [0,4,7],            // công thức cấu tạo từ root
  "symbolDefault": "C",            // ký hiệu fallback (FE có thể override)
  "aliases": ["CM", "CΔ"],         // tuỳ chọn
  "createdAt": 1234567890
}
```

### ✨ Ghi chú
- Slash chords KHÔNG khởi tạo ở batch đầu tiên.
- Nếu sau này thêm slash → tạo canonical mới, vd: `r0__maj_b4` (C/E).

---

## 2. Voicings Collection

### 🔑 ID quy tắc
- `${instrument}/${canonicalId}`  
  - instrument = `guitar`, `piano`, `ukulele`.
  - canonicalId = trùng với canonical, hoặc thêm `_bX` nếu slash.

### 📄 Document schema chung
```json
{
  "canonicalId": "r0__maj",        // FK về canonical
  "instrument": "guitar",          // hoặc "piano"/"ukulele"
  "variants": [ ... ],             // mảng voicing
  "createdBy": "uid123",           // ai thêm
  "createdAt": 1234567890
}
```

---

### 🎸 Guitar Voicing Variant
```json
{
  "baseFret": 3,
  "frets": [3,2,0,0,0,3],
  "fingers": [3,2,0,0,0,4],
  "barres": [ { "fret": 1, "from": 6, "to": 1 } ],
  "gridFrets": 4,
  "rootString": 6,
  "rootFret": 3,
  "verified": true
}
```

### 🎹 Piano Voicing Variant
```json
{
  "bassNotes": [36],               // MIDI numbers, vd: C2
  "rightNotes": [60,64,67],        // vd: C4,E4,G4
  "twoOctaves": true,              // FE luôn render 2 octave
  "centerMidi": 60,                // layout trung tâm (vd: C4)
  "label": "root position",
  "isSlashStrict": false,
  "verified": null                 // Piano mặc định null (khỏi hiện tích xanh)
}
```

### 🎶 Ukulele Voicing Variant
```json
{
  "baseFret": 0,
  "frets": [0,0,0,3],
  "fingers": [0,0,0,3],
  "rootString": 4,
  "rootFret": 0,
  "verified": false
}
```

---

## 3. Workflow nhập dữ liệu

1. **Khởi tạo Canonical** (BE script):
   - Sinh tất cả pc × recipeId = ~12 × 40 = ~480 canonical documents.
   - Voicings = [] (trống).

2. **Thêm Voicing** (qua editor hoặc script):
   - Người dùng/đội ngũ bổ sung.
   - Mỗi voicing append vào `variants[]` của doc tương ứng.

3. **Slash/Inversion**:
   - Khi tạo slash, cũng insert vào canonical (vd: `r0__maj_b4`).
   - Voicing cho slash lưu tại voicings giống như thường.

---

## 4. Công dụng các field

- `verified`: cho biết đã được đội ngũ xác nhận (hiển thị dấu tích).
- `centerMidi`: đảm bảo chord hiển thị cân đối trong layout piano.
- `intervals`: nguồn dữ liệu chính để dựng hợp âm lý thuyết / sound engine.
- `symbolDefault`: fallback khi FE không tự chọn spelling.

---

## 5. Query/CRUD điển hình

- Lấy tất cả hợp âm canonical:  
  `db.collection("chords_system/canonical").get()`

- Lấy voicings của Cmaj cho guitar:  
  `db.doc("chords_system/voicings/guitar/r0__maj").get()`

- Thêm voicing mới:  
  `db.doc("chords_system/voicings/piano/r0__maj").update({ variants: admin.firestore.FieldValue.arrayUnion(newVoicing) })`

- Thêm slash mới C/E:  
  1. Insert canonical: `r0__maj_b4`
  2. Insert voicings cho slash.

---

## ✅ Kết luận

- **Canonical** = lớp nền tảng (theory).
- **Voicings** = cách chơi/thể hiện trên từng nhạc cụ.
- Slash = canonical riêng (kế thừa interval của hợp âm gốc + field `bassPc`).
- FE render dựa trên `variants[]`, fallback = "Chưa có voicing".
