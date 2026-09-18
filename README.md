# AI Studio — Combo AI Model Workspace

**AI Studio** là ứng dụng web tích hợp đa nhà cung cấp AI (OpenAI, Anthropic, Google Gemini, Groq, Mistral...) qua **API Key**, cho phép nhóm các model thành **Combo** để **tự động switch** khi hết quota free — theo ngày (refill 00:00 UTC) và tháng (mùng 1).

Giao diện lấy cảm hứng từ **Leonardo AI** (Image Studio, dark neon, gallery masonry) + **ChatGPT Workspace** (Projects, Pin, Recent, quản lý chat theo ngữ cảnh).

> Live preview đang chạy trên port 5173 — mở LIVE PREVIEW trong Arena để dùng ngay.
> (Nếu bạn muốn xem web app của AI Studio thay vì game, chạy `npm run dev`.)

## 🎮 Kèm theo: game 3D "Neon Defense"

Repo này có thêm một **game tower defense 3D bằng Three.js**, đóng gói thành **một file HTML duy nhất**:
[`game3d.html`](./game3d.html) — mở là chơi, không cần internet/CDN.

- 22×16 ô đấu trường neon, đường đi uốn lượn, cổng không gian & căn cứ phát sáng
- 5 loại tháp (liên thanh · pháo nổ · súng băng · trụ sét · bắn tỉa) × 5 cấp nâng cấp
- 5 loại địch + trùm (drone bay đi đường riêng), 25 đợt, 3 độ khó, tiếng động tổng hợp bằng WebAudio
- HUD/menu/điều khiển đầy đủ cho **chuột · bàn phím · cảm ứng**

```bash
npm run game          # chơi ngay tại http://localhost:5173/game3d.html
npm run game:build    # dựng lại game3d.html từ game/src/
npm run game:test     # 140 kiểm tra headless (jsdom + stub WebGL)
npm run game:balance  # bot tự chơi để đo cân bằng độ khó
```

Chi tiết gameplay, kiến trúc và cách tinh chỉnh: [`game/README.md`](./game/README.md).

## ✨ Tính năng chính

### 1) Tích hợp Provider qua API Key
- 5 provider mặc định: OpenAI, Anthropic, Google, Groq, Mistral (mở rộng OpenAI-compatible)
- Mỗi provider: nhập `API Key`, `Base URL`, test connection, bật/tắt từng model
- Key lưu local (demo: localStorage) — production khuyến nghị mã hóa AES + vault
- Hiển thị trạng thái `Connected` + số model đang bật

### 2) Combo — Auto Switch Model theo Quota
> **Combo = nhóm model có thứ tự ưu tiên + chiến lược + chu kỳ refill**

- **3 chiến lược:**
  - `Fallback`: dùng tuần tự A → B → C khi hết quota
  - `Round-robin`: chia đều request vòng tròn
  - `Balance`: ưu tiên model còn nhiều quota nhất
- **3 chu kỳ refill:**
  - `Daily`: token free/ngày (refill 00:00 UTC)
  - `Monthly`: token free/tháng (refill mùng 1)
  - `Both`: kiểm tra cả hai, lấy `min(remainingDaily, remainingMonthly)`
- Mỗi model cấu hình: `freeTokensPerDay`, `freeTokensPerMonth`, `usedToday`, `usedMonth`, `contextWindow`, `enabled`
- UI hiển thị thanh tiến trình, token còn lại, model đang active (chấm xanh nhấp nháy)
- Khi hết quota: tự động fallback sang model kế tiếp, có banner cảnh báo nếu cả combo cạn

### 3) Chat — như ChatGPT
- Chọn **Combo** làm “model” cho cuộc trò chuyện (dropdown ở top bar + right panel)
- Nhập prompt → hệ thống chọn `getActiveModelForCombo()` → trừ token → stream trả lời mock
- Hiển thị model thực tế đã dùng + số token / tin nhắn
- Mỗi chat thuộc 1 **Project** (optional), có pin, preview, số tin nhắn
- Gợi ý quick prompt khi chat rỗng

### 4) Image Studio — như Leonardo AI
- Ô prompt lớn + Enhance/Random
- Chọn Model (Vision XL, Diffusion XL...), Style (Cinematic, Anime...), Aspect Ratio, số lượng (1-8)
- Nút **Tạo ảnh ngay** (trừ credits) → gallery masonry, hover hiện Remix/ Upscale
- Thanh bên hiển thị Combo đang dùng & credits

### 5) Projects — như ChatGPT Workspace
- Tạo Project với icon, màu, mô tả
- Mỗi project chứa nhiều chats + counter files
- Pin project, xem grid, tạo chat mới trong project, gán chat sang project khác ngay trong panel phải
- Lưu trong Zustand persist + localStorage

### 6) Sidebar — Pin / Recent
- **Ghim**: danh sách chat đã pin (1-click ghim/bỏ)
- **Gần đây**: 6 chat mới nhất
- **Projects**: 4 project gần nhất + quota mini (2 combo đầu)
- Search filter realtime
- Thu gọn sidebar (72px) giữ lại icon

### 7) Dashboard Tổng quan
- Hero gradient + 3 KPI (Providers, Models, Combos)
- Card quota 4 model đầu (progress bar, remaining, refill)
- Grid combos (màu, chiến lược, list model với chấm trạng thái)
- Recent activity + Projects + Image teaser

## 🏗️ Kiến trúc

```
src/
  types.ts    # Provider, AIModel, Combo, Chat, Project
  store.ts    # Zustand + persist, logic getActiveModelForCombo, consumeTokens
  App.tsx     # Toàn bộ UI (sidebar, 6 views, modals)
  main.tsx    # React root
  index.css   # Tailwind + custom scrollbar + masonry
```

**Luồng auto-switch:**
```ts
function getActiveModelForCombo(comboId){
  for(modelId of combo.modelIds){
    if(!model.enabled) continue
    remain = min(freePerDay - usedToday, freePerMonth - usedMonth)
    if(remain > 500) return model // ngưỡng an toàn
  }
  return firstEnabled // fallback dù hết
}
```

Khi gửi tin nhắn: `consumeTokens(modelId, estimatedTokens)` → cập nhật `usedToday/usedMonth` → lần sau sẽ tự chọn model khác nếu đã cạn.

## 🚀 Chạy local

```bash
npm install
npm run dev    # http://localhost:5173 --host 0.0.0.0
npm run build
npm run preview
```

## 🔧 Cấu hình quota mẫu (seed)

- `gpt-4o`: 15k/ngày, 300k/tháng
- `gpt-4o-mini`: 40k/ngày, 800k/tháng
- `claude-3.5-sonnet`: 20k/ngày, 400k/tháng
- `gemini-1.5-flash`: 100k/ngày, 3M/tháng (free tier)
- ... có thể sửa trực tiếp trong view **API Keys** (hiển thị 2 card quota/ model)

## 📌 Roadmap

- [ ] Backend thực: Node/Express + Prisma, mã hóa key bằng KMS, refresh quota bằng cron (00:00 UTC & mùng 1)
- [ ] Proxy OpenAI-compatible để đo token thực tế (tiktoken) + lưu usage DB
- [ ] Image generation thật qua Leonardo/Stable Diffusion API
- [ ] Chia sẻ Project, template Combo, marketplace
- [ ] Billing credits, SSE streaming

## 📝 Giấy phép

MIT — tạo bởi AI Studio Team.
