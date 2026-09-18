# 🎮 Neon Defense 3D — Tower Defense bằng Three.js

Game **phòng thủ tháp 3D** chạy trên WebGL (Three.js r160), đóng gói thành **một file HTML duy nhất**
([`../game3d.html`](../game3d.html)) — mở là chơi, **không cần internet, không cần CDN, không cần build step nào khi chơi**.

> Bối cảnh: tinh cầu neon của bạn bị xâm lăng qua **cổng không gian tím** ở rìa trái bản đồ.
> Quân địch đi theo làn đường phát sáng tới **căn cứ** ở rìa phải. Xây tháp, nâng cấp, giữ căn cứ qua **6 bản đồ
> với 20 → 40 đợt khác nhau**, rồi leo **bảng xếp hạng top 10 riêng cho từng bản đồ**.

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

### 8 loại địch (trong đó có nhóm quái vật / sinh vật ngoài hành tinh)

| Địch | Máu gốc | Tốc độ | Giáp | Đặc điểm |
|---|---|---|---|---|
| 🤖 Lính Máy | 52 | 3.0 | 0 | Đông, đánh theo số lượng |
| ⚡ Tia Chớp | 34 | 5.3 | 0 | Nhanh, khó chặn |
| 🛡️ Xe Tăng | 240 | 1.85 | 6 | Trâu, lọt lưới mất 3 mạng |
| 🛸 Drone Bay | 80 | 4.4 | 1 | **Bay theo đường riêng**, chỉ tháp bắn được mục tiêu bay mới hạ nổi |
| 👽 Sinh Vật Ngoài Hành Tinh | 130 | 3.4 | 2 | Từ đợt 9: cứ ~4.6s **dịch chuyển tức thời** 7.5 ô về phía trước (đang bị làm chậm thì không nhảy được) |
| 🧟 Quái Vật Đột Biến | 420 | 2.05 | 8 | Từ đợt 12: máu dày, giáp cao, bị hạ thì **tách thành 2 Ấu Trùng** |
| 🐛 Ấu Trùng | 45 | 4.7 | 0 | Sinh ra từ xác quái vật, chạy rất nhanh, khó chặn nếu hết tháp ở đoạn cuối |
| 👹 Trùm Máy | 1350 | 1.5 | 10 | Xuất hiện mỗi 5 đợt (1 → 3 con), lọt lưới mất 8 mạng |

### 🗺️ 6 bản đồ — mỗi bản đồ một số đợt, một bố cục, một bộ icon riêng

| # | Bản đồ | Icon | Lưới | Đợt | Đặc trưng riêng | Mở khoá |
|---|---|---|---|---|---|---|
| 1 | 🌱 Đồng Bằng Neon | `map-plains` | 18×14 | **20** | Địa hình trống, máu địch ×0.85, vàng ×1.18 — dễ thở | có sẵn |
| 2 | ⚙️ Hành Lang Xoắn | `map-corridor` | 22×16 | **25** | Bản đồ chuẩn để đo cân bằng | hạ màn 1 |
| 3 | ❄️ Mê Cung Băng | `map-frost` | 22×16 | **30** | Drone bay ×1.55, Tia Chớp ×1.2 | hạ màn 2 |
| 4 | 🏜️ Sa Mạc Plasma | `map-desert` | 26×16 | **30** | Xe Tăng ×1.45, Quái Vật ×1.25 | hạ màn 3 |
| 5 | 🛰️ Vành Đai Sao | `map-orbit` | 24×18 | **35** | Ngoài hành tinh ×1.6, Drone ×1.35 | hạ màn 4 |
| 6 | ☠️ Lõi Tử Thần | `map-core` | 24×18 | **40** | Trùm ×1.4, Quái Vật ×1.5, Ngoài hành tinh ×1.4 | hạ màn 5 |

- **Màn chọn bản đồ** (`showLevelSelect`) hiện đủ 6 thẻ: icon SVG của bản đồ, tên, kích thước lưới,
  số đợt, mạng/vàng khởi đầu, độ nguy hiểm và kỷ lục của bạn. Thẻ chưa mở khoá bị làm mờ + ổ khoá 🔒.
- **Máu địch scale theo tiến độ của từng bản đồ**: `waveCurve(t) = 0.6 + 1.8t + 3.4t² + 8.4t³` với
  `t = (đợt−1)/(số đợt−1)` → cùng một đợt ở bản đồ dài sẽ nhẹ hơn ở bản đồ ngắn, và nửa sau ván luôn căng hơn.
- Trùm xuất hiện mỗi 5 đợt; bản đồ dài (>30 đợt) tăng số trùm chậm hơn để không dồn quá nhiều.
- Mỗi bản đồ có **seed riêng** cho trang trí → cùng bản đồ luôn giống hệt nhau ở mọi ván (dễ học, dễ so điểm).

### 🏆 Bảng xếp hạng (top 10 mỗi bản đồ)

| Điều | Chi tiết |
|---|---|
| Lưu ở đâu | `localStorage` — `neon-defense-board:<mapId>`, tiến độ `neon-defense-progress`, tên `neon-defense-name` |
| Điểm cuối ván | `điểm trong ván × (1 + 6% × số mạng còn lại)` nếu thắng, thua thì giữ nguyên điểm |
| Xếp hạng | Điểm → đợt đã qua → số địch hạ → thời gian nộp sớm hơn |
| Màn hình | Menu chính 🏆 · màn chọn bản đồ · bảng tạm dừng (P) · bảng kết thúc ván (hiện hạng của bạn) |
| Tiện ích | Đổi tên người chơi, tab sang bản đồ khác, 🗑️ xoá bảng của bản đồ đang xem |

### Cơ chế đáng chú ý

- **Dị năng của quái & dị dạng**: 👽 *dịch chuyển tức thời* (bỏ qua một đoạn đường — nhưng Súng Băng làm chậm là khoá được), 🧟 *tách đàn* (chết sinh ra ấu trùng chạy nhanh), 🛸 *bay* (đi đường riêng trên không).
- **Giáp giảm theo tỉ lệ** (`armor/(armor+22)`, tối đa −55%) nên tháp sát thương nhỏ vẫn có ích, còn Bắn Tỉa thì bỏ qua hoàn toàn.
- **Máu địch scale phi tuyến**: từ đợt 15 trở đi nhân thêm hệ số "late" — nửa sau của ván mới thực sự căng.
- **Kinh tế**: gọi đợt sớm được thưởng vàng (tối đa ~40 vàng/đợt), qua đợt được `40 + 7×đợt`, hạ địch rơi vàng; bán tháp luôn lỗ 38% để tránh lạm phát.
- **Trạng thái bàn chơi**: lưới đổi theo bản đồ (18×14 → 24×18), đường đi uốn lượn riêng từng màn, trang trí (đá, tinh thể phát sáng, cây, cột đèn neon, vành núi) chiếm ô nên **không thể xây tràn lan** — phải chọn vị trí.
- **Không có thư viện ngoài**: UI/âm thanh/hiệu ứng đều tự viết — WebAudio tổng hợp tiếng súng, tiếng nổ, nhạc hiệu thắng/thua (không có file âm thanh).

### 🎨 Bộ icon (tự vẽ, không phụ thuộc CDN)

Mọi icon trong game — 5 loại tháp, 8 loại địch, **6 bản đồ**, logo — đều là **SVG tự vẽ** nằm ở hằng `ICONS`
trong `game/src/game.js` và được render bằng `svgIcon(key, color)` / `renderIcons(root)`.
Không có ảnh ngoài, không gọi mạng, icon tự lấy màu theo từng loại tháp/địch.

Muốn thay bằng icon tải về (ví dụ **Flaticon** — monster/alien):

```bash
# 1) tải file .svg, ghi đè vào thư mục icons, GIỮ NGUYÊN tên tệp:
#    game/icons/alien.svg  ·  game/icons/monster.svg  ·  game/icons/map-frost.svg …
#    (giữ fill="currentColor" cho phần nét chính để icon ăn màu theo theme)
npm run game:build     # 2) build lại là xong
```

`build.mjs` nhúng mọi tệp `game/icons/*.svg` vào `game3d.html` (biến `window.__NEON_ICON_OVERRIDES__`)
và ghi đè bộ icon mặc định — xem `game/icons/README.md`.

### 3 độ khó

| Độ khó | Mạng | Vàng đầu | Máu địch | Vàng nhận | Kết quả đo bằng bot (xem bên dưới) |
|---|---|---|---|---|---|
| 🌱 Dễ | 25 | 275 | ×0.80 | ×1.15 | Thắng thoải mái |
| ⚔️ Thường | 20 | 220 | ×1.00 | ×1.00 | Thắng nếu chơi tốt — ở bản đồ chuẩn, bot "người thường" về đích với 20/20 mạng; sang bản đồ 5–6 thì phải chơi khéo hơn |
| 💀 Khó | 16 | 195 | ×1.32 | ×0.98 | Bot tối ưu thắng (16/16 mạng ở bản đồ chuẩn, 9/16 ở bản đồ cuối); bot "người thường" thua ở đợt cuối |

---

## 🏗️ Kiến trúc mã nguồn

```
game/
├── src/
│   ├── logic.js        # LÕI LOGIC thuần (không DOM, không THREE) → test được bằng Node
│   │                   # 6 bản đồ (lưới/đường đi/số đợt/hệ số riêng), độ khó, chỉ số tháp/địch,
│   │                   # công thức đợt sóng theo tiến độ, kinh tế, điểm cuối ván & luật bảng xếp hạng
│   ├── game.js         # Engine Three.js: scene/ánh sáng, model tháp & địch, FX hạt, gameplay,
│   │                   # HUD + menu + input (chuột/bàn phím/cảm ứng), vòng lặp render
│   └── template.html   # Khung HTML + CSS (giao diện neon), có 2 mốc để nhúng script
├── icons/              # icon .svg ghi đè (thay bằng icon Flaticon thì bỏ tệp vào đây)
├── vendor/
│   ├── three.module.min.js   # Three.js r160 (bản ESM chính thức, 654 KB)
│   └── LICENSE-three.txt     # MIT
├── build.mjs           # Đóng gói 1 file: three ESM → script cổ điển (IIFE riêng) + logic + game → HTML
├── serve.mjs           # Server tĩnh nhỏ để chơi/preview (bind 0.0.0.0)
└── test/
    ├── run.mjs         # 451 kiểm tra headless (jsdom + stub WebGL) — npm run game:test
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
npm run game:test       # 451 kiểm tra: logic, gameplay, UI, input, fuzz, thắng/thua, rò rỉ mesh
npm run game:balance    # bot tự chơi 3 độ khó ở bản đồ chuẩn → in kết quả
node game/test/balance.mjs --all        # thăm dò cả 6 bản đồ (chậm hơn, ~3-4 phút)
node game/test/balance.mjs orbit hard    # chỉ một bản đồ / độ khó bất kỳ
```

Harness chạy `game3d.html` **thật** trong jsdom, chỉ thay `WebGLRenderer` bằng stub (scene graph, gameplay,
UI, input đều chạy), nên bắt được cả lỗi khởi động lẫn lỗi logic: đường đi, công thức đợt sóng, 5 loại tháp,
dị năng quái/dị dạng, kinh tế, thao tác chuột–bàn phím–cảm ứng, fuzz 2600 hành động, ván thắng & ván thua,
và cả kiểm tra rò rỉ mesh. Ví dụ kết quả gần nhất:

```
Kết quả: 451 kiểm tra đạt, 0 thất bại · 5.7s

=== KẾT QUẢ THĂM DÒ CÂN BẰNG ===   (Hành Lang Xoắn — bản đồ chuẩn 25 đợt)
· bot tối ưu (không giới hạn số tháp)
  easy    → đợt 25/25 · victory · mạng 25 · tháp 78 · lọt 0
  normal  → đợt 25/25 · victory · mạng 20 · tháp 78 · lọt 0
  hard    → đợt 25/25 · victory · mạng 16 · tháp 78 · lọt 0
· người chơi thật (~26 tháp, cấp ≤3, không gọi đợt sớm)
  easy    → đợt 25/25 · victory · mạng 25 · tháp 26 · lọt 0
  normal  → đợt 25/25 · victory · mạng 20 · tháp 26 · lọt 0   ← căng dần ở nửa sau ván
  hard    → đợt 25/25 · over    · mạng  0 · tháp 26 · lọt 3
```

## 🐞 Lỗi đã gặp & cách phòng ngừa

| Lỗi | Triệu chứng | Nguyên nhân & cách sửa |
|---|---|---|
| Địch vô hình | Tháp vẫn tự khoá mục tiêu, bắn, trừ máu, mạng vẫn mất… nhưng **không thấy con nào** trên bản đồ | `spawnEnemy()` tạo model nhưng **thiếu `world.add(e.g)`** — địch sống trong logic mà không nằm trong scene graph. Đã sửa, và test 14 giờ kiểm tra: mọi địch phải có `parent === world`, đúng số model trong scene so với logic, vượt được bước kiểm tra **frustum** của renderer, và được gỡ khỏi scene khi chết / sang ván mới. |
| Phím `P` không bỏ tạm dừng khi bảng tạm dừng đang mở | Bấm P chỉ đóng được bằng nút | `onKey` xử lý phím khác khi overlay đang hiện. Đã sửa: `P` bật/tắt được tạm dừng luôn. |

> Bài học rút ra: test chỉ kiểm tra logic là chưa đủ cho game 3D — phải kiểm tra **scene graph** và **khả năng hiển thị**.
> Vì vậy harness hiện kiểm tra cả 3 tầng: lõi logic → scene graph (model có thật, đúng vị trí, đúng số lượng) → frustum (sẽ thực sự được vẽ).

Mẹo gỡ lỗi khi đang chơi: mở DevTools Console gõ `NEON.countInScene('enemy:')` để xem số model địch đang có trong scene,
`NEON.S.enemies.length` để xem số địch trong logic — hai số này **luôn phải bằng nhau**.
Góc trên bên trái menu (phím `H`) có hiển thị **bản dựng** để biết mình đang chạy bản mới hay bản cũ trong cache.

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
