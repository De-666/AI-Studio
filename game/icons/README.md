# 🎨 Bộ icon của game

Game **không phụ thuộc CDN**: mọi icon (tháp + địch + bản đồ) là **SVG tự vẽ** nằm trong hằng `ICONS` ở
`game/src/game.js`, render qua `svgIcon(key, color)` / `renderIcons(root)`.

## Thay bằng icon ngoài (ví dụ Flaticon) — 2 bước

1. Tải icon bạn thích (SVG) và **ghi đè tệp tương ứng trong thư mục này**, giữ nguyên tên:

   | Tệp | Dùng cho |
   |---|---|
   | `alien.svg` | 👽 Sinh Vật Ngoài Hành Tinh |
   | `monster.svg` | 🧟 Quái Vật Đột Biến |
   | `spawn.svg` | 🐛 Ấu Trùng |
   | `boss.svg` · `tank.svg` · `flyer.svg` · `grunt.svg` · `runner.svg` | các loại địch còn lại |
   | `gun.svg` · `cannon.svg` · `frost.svg` · `tesla.svg` · `sniper.svg` | các loại tháp |
   | `map-plains.svg` · `map-corridor.svg` · `map-frost.svg` · `map-desert.svg` · `map-orbit.svg` · `map-core.svg` | 6 bản đồ ở màn chọn bản đồ + chip HUD |
   | `logo.svg` | logo góc trên bên trái |

2. Chạy `npm run game:build` — `build.mjs` tự nhúng mọi tệp `.svg` trong thư mục này vào
   `game3d.html` thành `window.__NEON_ICON_OVERRIDES__`, ghi đè bộ icon mặc định.

> 💡 Kinh nghiệm: giữ `fill="currentColor"` cho phần nét chính để icon tự đổi màu theo loại
> (tháp/địch đều có màu riêng) và tự hợp với theme neon. Không cần internet lúc chạy —
> icon đã được nhúng thẳng vào file HTML.

Hiện thư mục có sẵn `alien.svg` và `monster.svg` là **bản tự vẽ** (đúng bằng bộ icon mặc định),
bạn chỉ cần thay nội dung 2 tệp đó là xong.
