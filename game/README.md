# 🎮 Neon Defense 3D — Tower Defense bằng Three.js

Game **phòng thủ tháp 3D** chạy trên WebGL (Three.js r160), đóng gói thành **một file HTML duy nhất**
([`../game3d.html`](../game3d.html)) — mở là chơi, **không cần internet, không cần CDN, không cần build step nào khi chơi**.

> Bối cảnh: tinh cầu neon của bạn bị xâm lăng qua **cổng không gian tím** ở rìa trái bản đồ.
> Quân địch đi theo làn đường phát sáng tới **căn cứ** ở rìa phải. Xây tháp, nâng cấp, giữ căn cứ qua **25 đợt**.

---

## ⚡ Chơi ngay

| Cách | Lệnh / thao tác |
|---|---|
| Mở trực tiếp | Nhấp đúp `game3d.html` (Chrome/Edge/Firefox/Safari bản mới) |
| Qua server tĩnh | `npm run game` → http://localhost:5173/game3d.html |
| Trong Arena | Mở **LIVE PREVIEW** (port 5173 đã trỏ sẵn vào game) |
| Build lại từ mã nguồn | `npm run game:build` |

Trình duyệt cần bật WebGL. Nếu máy quá yếu, game tự hiện thông báo thay vì màn hình trắng.

## 🕹️ Điều khiển

| Thao tác | Chuột | Phím | Cảm ứng |
|---|---|---|---|
| Xoay camera | Kéo chuột trái | `Q` / `E` | Kéo 1 ngón |
| Thu / phóng | Lăn chuột | `+` / `-` | Chụm 2 ngón |
| Di chuyển tầm nhìn | Kéo chuột phải hoặc `Shift`+kéo | `←↑↓→` | — |
| Chọn tháp | Bấm thẻ tháp ở thanh dưới | `1`–`5` | Bấm thẻ tháp |
| Xây tháp | Bấm vào ô đất trống (viền xanh) | — | Chạm ô đất |
| Nâng cấp / bán | Bấm vào tháp → nút trong panel phải | `U` / `X` | Bấm tháp → nút |
| Gọi đợt sớm | Nút ⚡ trong panel đợt | `Space` | Nút ⚡ |
| Tốc độ 1×/2×/3× | Nút `1×` góc phải | `T` | Nút `1×` |
| Tạm dừng | Nút ⏸ | `P` | Nút ⏸ |
| Huỷ chọn | — | `Esc` | — |
| Bật/tắt tiếng | Nút 🔊 | `M` | Nút 🔊 |
| Hướng dẫn | Nút ❓ | `H` | Nút ❓ |

## 🧠 Nội dung game

### 5 loại tháp (nâng cấp tối đa cấp 5, bán lại thu hồi 62%)

| Tháp | Giá | Sát thương L1 → L5 | Tầm bắn | Nhịp bắn | Vai trò |
|---|---|---|---|---|---|
| 🔫 Súng Liên Thanh | 65 | 9 → 46 | 8.5 → 11 | 2.6 → 4.1 /s | Bắn nhanh, rẻ, bắn được drone |
| 💥 Pháo Nổ | 125 | 32 → 171 | 10.5 → 13 | 0.62 → 0.78 /s | Nổ diện rộng, **không bắn được drone** |
| ❄️ Súng Băng | 100 | 6 → 24 | 9 → 11 | 1.5 → 2.0 /s | Làm chậm tới 72% trong vùng nổ |
| ⚡ Trụ Sét | 175 | 22 → 111 | 9.5 → 12 | 1.05 → 1.43 /s | Sét lan 4 → 8 mục tiêu, bắn tức thời |
| 🎯 Bắn Tỉa | 205 | 110 → 635 | 22 → 28 | 0.5 → 0.61 /s | Tầm cực xa, **xuyên giáp + xuyên 3–7 mục tiêu** |

### 5 loại địch + trùm

| Địch | Máu gốc | Tốc độ | Giáp | Đặc điểm |
|---|---|---|---|---|
| 🤖 Lính Máy | 52 | 3.0 | 0 | Đông, đánh theo số lượng |
| ⚡ Tia Chớp | 34 | 5.3 | 0 | Nhanh, khó chặn |
| 🛡️ Xe Tăng | 240 | 1.85 | 6 | Trâu, lọt lưới mất 3 mạng |
| 🛸 Drone Bay | 80 | 4.4 | 1 | **Bay theo đường riêng**, chỉ tháp bắn được mục tiêu bay mới hạ nổi |
| 👹 Trùm Máy | 1350 | 1.5 | 10 | Xuất hiện mỗi 5 đợt (1 → 3 con), lọt lưới mất 8 mạng |

### Cơ chế đáng chú ý

- **Giáp giảm theo tỉ lệ** (`armor/(armor+22)`, tối đa −55%) nên tháp sát thương nhỏ vẫn có ích, còn Bắn Tỉa thì bỏ qua hoàn toàn.
- **Máu địch scale phi tuyến**: từ đợt 15 trở đi nhân thêm hệ số "late" — nửa sau của ván mới thực sự căng.
- **Kinh tế**: gọi đợt sớm được thưởng vàng (tối đa ~40 vàng/đợt), qua đợt được `40 + 7×đợt`, hạ địch rơi vàng; bán tháp luôn lỗ 38% để tránh lạm phát.
- **Trạng thái bàn chơi**: 22×16 ô, đường đi 14 khúc uốn lượn, trang trí (đá, tinh thể phát sáng, cây, cột đèn neon, vành núi) chiếm ô nên **không thể xây tràn lan** — phải chọn vị trí.
- **Không có thư viện ngoài**: UI/âm thanh/hiệu ứng đều tự viết — WebAudio tổng hợp tiếng súng, tiếng nổ, nhạc hiệu thắng/thua (không có file âm thanh).

### 3 độ khó

| Độ khó | Mạng | Vàng đầu | Máu địch | Vàng nhận | Kết quả đo bằng bot (xem bên dưới) |
|---|---|---|---|---|---|
| 🌱 Dễ | 25 | 275 | ×0.80 | ×1.15 | Thắng thoải mái |
| ⚔️ Thường | 20 | 220 | ×1.00 | ×1.00 | Thắng nếu chơi tốt; 1/3 cuối ván mới thực sự khó |
| 💀 Khó | 16 | 195 | ×1.32 | ×0.98 | Bot chơi tối ưu thắng sát nút (còn 11/16 mạng); bot chơi "người thường" thua ở đợt cuối |

---

## 🏗️ Kiến trúc mã nguồn

```
game/
├── src/
│   ├── logic.js        # LÕI LOGIC thuần (không DOM, không THREE) → test được bằng Node
│   │                   # lưới & đường đi, độ khó, chỉ số tháp/địch, công thức đợt sóng, kinh tế
│   ├── game.js         # Engine Three.js: scene/ánh sáng, model tháp & địch, FX hạt, gameplay,
│   │                   # HUD + menu + input (chuột/bàn phím/cảm ứng), vòng lặp render
│   └── template.html   # Khung HTML + CSS (giao diện neon), có 2 mốc để nhúng script
├── vendor/
│   ├── three.module.min.js   # Three.js r160 (bản ESM chính thức, 654 KB)
│   └── LICENSE-three.txt     # MIT
├── build.mjs           # Đóng gói 1 file: three ESM → script cổ điển (IIFE riêng) + logic + game → HTML
├── serve.mjs           # Server tĩnh nhỏ để chơi/preview (bind 0.0.0.0)
└── test/
    ├── run.mjs         # 140 kiểm tra headless (jsdom + stub WebGL) — npm run game:test
    └── balance.mjs     # Bot tự chơi để đo độ khó — npm run game:balance
```

**Vì sao nhúng Three.js vào file?** Yêu cầu là *một file HTML mở là chơi*. Nhúng sẵn giúp chạy được cả khi
mở bằng `file://`, khi không có mạng, hoặc khi CDN bị chặn — bù lại file nặng ~770 KB (đã là bản min).
`build.mjs` chuyển khối `export{...}` của three thành `window.THREE = {...}` và bọc trong IIFE riêng,
nên không xung đột tên biến với code game; code game cũng nằm trong IIFE riêng và chỉ lộ `window.NEON` để gỡ lỗi.

## ✅ Kiểm thử & đo cân bằng

```bash
npm run game:build      # dựng lại game3d.html từ src/
cd game/test && npm install && cd ../..   # cài jsdom cho harness (1 lần)
npm run game:test       # 140 kiểm tra: logic, gameplay, UI, input, fuzz, thắng/thua, rò rỉ mesh
npm run game:balance    # bot tự chơi 3 độ khó → in kết quả
```

Harness chạy `game3d.html` **thật** trong jsdom, chỉ thay `WebGLRenderer` bằng stub (scene graph, gameplay,
UI, input đều chạy), nên bắt được cả lỗi khởi động lẫn lỗi logic. Ví dụ kết quả gần nhất:

```
Kết quả: 140 kiểm tra đạt, 0 thất bại

=== KẾT QUẢ THĂM DÒ CÂN BẰNG ===
· bot tối ưu (không giới hạn)
  easy    → đợt 25/25 · victory · mạng 25 · lọt 0
  normal  → đợt 25/25 · victory · mạng 20 · lọt 0
  hard    → đợt 25/25 · victory · mạng 11 · lọt 5
· người chơi thật (~26 tháp, cấp ≤3)
  easy    → đợt 25/25 · victory · mạng 25 · lọt 0
  normal  → đợt 25/25 · victory · mạng 20 · lọt 0
  hard    → đợt 25/25 · over    · mạng  0 · lọt 8
```

## 🔧 Muốn tinh chỉnh?

Toàn bộ số liệu nằm ở **`game/src/logic.js`** — sửa xong chạy `npm run game:build` là game3d.html cập nhật:

- `PATH_NODES`: vẽ lại đường đi (mọi thứ khác tự bám theo).
- `TOWERS`: giá, sát thương, tầm bắn, nhịp bắn, hiệu ứng riêng, hệ số tăng theo cấp.
- `ENEMIES` / `enemyStats()`: máu, tốc độ, giáp, thưởng, và công thức scale theo đợt.
- `buildWave()`: thành phần từng đợt; `DIFFICULTIES`: 3 mức độ khó; `TOTAL_WAVES`, `BUILD_TIME`…

Trong lúc chơi, mở DevTools Console gõ `NEON.S` để xem trạng thái, hoặc
`NEON.startGame('hard')`, `NEON.placeTower('tesla', 8, 8)`, `NEON.S.gold = 9999` để thử nhanh.

## 📝 Giấy phép

Mã game: MIT. Three.js: MIT (giữ nguyên thông báo bản quyền trong `game/vendor/`).
