# Changelog

## [2.0.0] - 2026-11-05 - Đồng bộ với app mobile CookFlow (MMA301)

Mục tiêu: API áp dụng đúng các quy tắc nghiệp vụ mà app mobile đang tự xử lý offline, để app thay
AsyncStorage bằng API mà người dùng không thấy khác biệt. Hướng dẫn nối app: [`docs/FE_INTEGRATION.md`](docs/FE_INTEGRATION.md).

### ⚠️ Thay đổi phá vỡ tương thích
- **Đăng ký không còn trả token.** `POST /api/auth/register` tạo tài khoản `verified: false` và gửi mã 6 số;
  token được cấp ở `POST /api/auth/verify-email`. Đăng nhập khi chưa xác minh → `403 EMAIL_NOT_VERIFIED`.
  Tài khoản tạo trước phiên bản này được coi là đã xác minh.
- **Mật khẩu mới** (đăng ký / đổi / đặt lại) cần ≥ 8 ký tự và độ mạnh trung bình, giống app (trước: ≥ 6).
- **Tài khoản seed đổi theo app:** `admin@cookflow.demo / Admin123!`, `chef@cookflow.demo / Chef123!`
  (thay cho `admin@cookflow.com / 123456`). Database đã seed trước đó vẫn giữ tài khoản cũ.
- **Định dạng lỗi thống nhất:** mọi lỗi (kể cả validator) trả `{ success:false, message, code?, errors?, error:{status,message} }`.
  Trước đây validator trả `{ message: 'Validation failed', errors }`. Thông báo chuyển sang tiếng Việt.
- **Công thức người dùng tạo mặc định riêng tư** (`isPublic: false`): người khác và khách không thấy
  qua danh sách, chi tiết (404), yêu thích, gợi ý. Migration chuyển công thức người dùng cũ sang riêng tư.
- **Giá trị mặc định của công thức theo app:** `difficulty` `Vừa` (trước `Dễ`); `calories` `null` khi chưa rõ
  (trước tự đặt 250); `prepTimeMinutes: 0` được giữ là 0 (trước thành 10); số lượng nguyên liệu trống → `Vừa đủ`;
  `description` và `imageUrl` không còn bắt buộc (ảnh mặc định như app).
- **`.env`: `HOSTNAME` → `HOST`**, mặc định `0.0.0.0`. Git Bash tự đặt `HOSTNAME` = tên máy, và dotenv không ghi đè
  biến đã có, nên server có thể lắng nghe sai địa chỉ. `localhost` cũng khiến điện thoại / emulator không kết nối được.
- `POST /api/shopping` và `/bulk` **gộp** dòng trùng tên thay vì luôn thêm dòng mới (`added` / `merged` trong response).
- Lỗi trùng khóa (duplicate key) trả `409` (trước `400`).

### ✨ Bổ sung
**Tài khoản**
- `POST /api/auth/verify-email`, `POST /api/auth/resend-code`: xác minh email bằng mã 6 số.
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`: quên mật khẩu.
- `PUT /api/auth/change-password`.
- Đăng ký nhận `{ name, email, password }` như app (`username` tự sinh); đăng nhập nhận `{ email }` (vẫn hỗ trợ `usernameOrEmail`).
- User có thêm `verified`, `locked`, `settings`, `hasSeenOnboarding`; response có thêm `name` (= `fullName`).
- Tài khoản bị khóa / chưa xác minh bị từ chối ngay cả khi token còn hạn.
- Mã OTP: chỉ lưu hash, hết hạn 10 phút, tối đa 5 lần nhập sai, chờ 30 giây giữa 2 lần gửi. Chưa có SMTP:
  mã in ra console và trả trong `devCode` khi `NODE_ENV` khác `production` (tắt bằng `OTP_EXPOSE_IN_RESPONSE=false`).

**Quản trị**
- `GET/POST /api/users`, `GET/PUT/DELETE /api/users/:id`: quản lý tài khoản (khóa, xác minh, đổi quyền, đổi mật khẩu).
  Admin không tự hạ quyền / khóa / xóa mình; luôn giữ ít nhất 1 admin. Xóa tài khoản xóa luôn dữ liệu cá nhân.
- `GET /api/admin/stats`: số liệu màn tổng quan.

**Công thức**
- Trường mới: `type` (`system` | `admin` | `personal`), `tags`, `nutrition { protein, carbs, fat }`, `steps[].image`,
  `copiedFrom`, `variantOf`, `aiChanges`, `legacyId`.
- Response thêm `id` cho từng nguyên liệu / bước (id được giữ khi sửa), `ownerId`, `authorName`, `isOwner`, `canEdit`, `categoryId`.
- Admin tạo công thức kho chung bằng `system: true` (hoặc `type`). User thường không tạo / sửa được công thức `system` / `admin`.
- `GET /api/recipes`: lọc `tag`, `type`, `mine=true`; tìm kiếm **không dấu** theo tên, mô tả, tags, nguyên liệu;
  lọc danh mục theo tên không dấu; chỉ sắp xếp theo các trường cho phép.
- `PATCH /api/recipes/:id` (giống PUT, sửa từng phần).
- Giới hạn giống app: khẩu phần 1–50, thời gian ≤ 1440 phút, hẹn giờ ≤ 600 phút, kcal ≤ 5000, macro ≤ 500 g.

**Danh mục**
- `slug` tự sinh từ tên (`Món chính 🍲` → `mon-chinh`), đi theo tên khi đổi tên.
- `GET /api/categories` trả `recipeCount` cho mỗi danh mục và `names` (mảng tên theo thứ tự).
- `PUT /api/categories/reorder` `{ ids }` hoặc `{ names }`.
- Kiểm tra tên như app: không trống, ≤ 30 ký tự, không trùng (bỏ dấu / emoji), không phải "Tất cả".
- Xóa danh mục: công thức chuyển sang "Món chính 🍲" (hoặc danh mục đầu tiên); không xóa được danh mục cuối.

**Mua sắm**
- Gộp dòng như app (cùng đơn vị, g↔kg, ml↔lít, cùng chữ "Vừa đủ"; ghi nhiều nguồn "Phở bò, Kế hoạch bữa ăn").
- `PATCH /api/shopping/:id`: sửa tên / số lượng / đơn vị, đặt `checked`.
- Đánh dấu đã mua → tự thêm vào kho nếu bật `autoStockPantry`, bỏ đánh dấu nhầm thì lấy lại (trường `stockedToPantry`).
- `POST /api/shopping/restore` (hoàn tác); `DELETE /:id` trả lại dòng đã xóa.

**Kho nguyên liệu**
- So khớp không dấu / không phân biệt hoa thường (`normalizedName`, unique theo user).
- `POST /api/pantry` (thêm 1 hoặc nhiều, đã có thì bỏ qua), `POST /api/pantry/remove` (xóa nhiều).
- `suggest-recipes` chỉ xét công thức người dùng được xem, so khớp không dấu.

**Nhóm dữ liệu mới**
- `/api/history`: lịch sử nấu (đánh giá, ghi chú, thống kê theo công thức, giữ 200 mục mới nhất).
- `/api/meal-plans`: nhật ký / kế hoạch bữa ăn, sao chép ngày, đưa nguyên liệu vào giỏ (nhân theo khẩu phần).
- `/api/requests`: yêu cầu món mới / báo cáo công thức; admin duyệt, trả lời (tối đa 10 yêu cầu mở mỗi người, chặn gửi trùng).
- `/api/users/me/settings`: cài đặt cá nhân + onboarding.
- `/api/users/me/data`: xuất / nhập (định dạng file sao lưu của app, kể cả file của app offline) / xóa dữ liệu cá nhân.

**Upload**
- `POST /api/upload/video` (field `video`, mp4/mov/m4v/webm/3gp, ≤ 50MB). Ảnh nhận thêm heic/heif.

### 🐛 Sửa lỗi
- Seed lỗi `ValidationError` vì bước 1 thiếu `instruction`; seed nay có đủ 6 công thức mẫu của app (`seed/recipes.data.json`).
- Lộ công thức tự tạo của người khác qua `GET /api/recipes`, `/:id`, favorites, suggest.
- Xóa danh mục để lại công thức trỏ tới danh mục không tồn tại.
- Lọc danh mục theo tên không tồn tại bị bỏ qua (trả mọi công thức); nay trả rỗng.
- `PUT /api/auth/profile` không xóa được avatar (gửi `null` / `""` để về avatar mặc định).
- Thả tim được công thức riêng tư của người khác.

### 🔧 Kỹ thuật
- Migration tự chạy khi khởi động / seed (`utils/migrations.js`, idempotent): gán `type` cho công thức cũ, tạo `searchText`,
  điền `normalizedName` cho kho và thay index unique `(user, ingredientName)` bằng `(user, normalizedName)`.
- Tiện ích port 1:1 từ app: `utils/text.js` (bỏ dấu), `utils/units.js`, `utils/quantity.js`; giới hạn chung ở `config/limits.js`.
- Tầng service: `services/shopping|pantry|category|userData.service.js`; serializer chung `utils/serializers.js`.
- Kiểm thử: `npm test` chạy 91 ca E2E + kiểm thử migration trên MongoDB in-memory (`mongodb-memory-server`, devDependency).

### Giữ nguyên (chưa thay đổi theo yêu cầu)
- `GET /api/pantry/suggest-recipes`, `POST /api/upload/images`, `GET /api/upload/files`, `GET /api/upload/download/:filename`,
  `likesCount`, `slug` / `icon` / `order` của danh mục, `username` / `avatar` của user: app chưa dùng nhưng vẫn giữ.
  Lưu ý: `GET /api/upload/files` liệt kê file của mọi người dùng cho bất kỳ ai đã đăng nhập.
