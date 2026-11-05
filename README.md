# 🚀 SDN302-ServerSide-Development-RESTful-API
> **Repository Name:** `SDN302-ServerSide-Development-RESTful-API`  
> **Course:** SDN302 - Server-Side Development with NodeJS & ExpressJS (FPT University)  
> **Architecture:** Model - View(API) - Controller (MVC) Layered Pattern  
> **Database:** MongoDB & Mongoose ODM (`mongodb://127.0.0.1:27017/cookflow_db`)  
> **Security:** JSON Web Token (JWT) + Bcrypt Password Hashing + Role-Based Access Control (RBAC)  
> **File Handling:** Multer Storage Middleware (`/public/uploads`)  

---

## 📝 Repository Description (Dành cho GitHub About)

### 🇬🇧 English (Recommended for GitHub & CV)
> *"Full-fledged Server-Side RESTful API built with Node.js, Express.js, MongoDB & Mongoose. Features JWT authentication, role-based access control (RBAC), Multer file uploads, and MVC architecture for mobile app integration. Course: SDN302 - FPT University."*

### 🇻🇳 Tiếng Việt (Bản mô tả đồ án tiếng Việt)
> *"Hệ thống Backend RESTful API hoàn chỉnh xây dựng với Node.js, Express.js, MongoDB & Mongoose. Tích hợp xác thực JWT, phân quyền RBAC, upload file Multer và kiến trúc MVC cho đồ án môn học SDN302 - FPT University."*

### 🏷️ GitHub Topics / Tags
```
nodejs, expressjs, mongodb, mongoose, restful-api, jwt-authentication, rbac, multer, mvc-architecture, sdn302, fpt-university
```

---

## 🌟 1. Tổng Quan Kiến Trúc Môn Học SDN302

Dự án hiện thực hóa đầy đủ các nội dung trong khung chương trình giảng dạy môn **SDN302**:

1. **RESTful API Service (Slot 1 - 3, Slot 6):**
   * Định tuyến URI chuẩn mực theo danh từ số nhiều: `/api/auth`, `/api/recipes`, `/api/categories`, `/api/favorites`, `/api/shopping`, `/api/pantry`, `/api/upload`.
   * Sử dụng chuẩn HTTP Verbs: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
   * Quy chuẩn HTTP Status Codes: `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `500 Internal Server Error`.
2. **MongoDB & Mongoose ODM (Slot 4 - 5):**
   * Schema Validation nghiêm ngặt (kiểm tra kiểu dữ liệu, required, minlength, unique, enum).
   * Mongoose Population (`ref` và `.populate('category author')`) giải quyết bài toán quan hệ giữa các Collection.
   * Full-text Indexing hỗ trợ tìm kiếm từ khóa đa trường dữ liệu.
3. **Authentication & Authorization Security (Slot 9 - 10):**
   * Băm mật khẩu một chiều an toàn bằng `bcryptjs` (salt rounds = 10).
   * Cấp phát và xác thực Access Token qua `jsonwebtoken` (JWT Bearer Token).
   * Middleware kiểm tra quyền hạn `authorizeRole('admin')` ngăn chặn truy cập trái phép.
4. **File Upload Management (Slot 12):**
   * Middleware `multer` cấu hình `diskStorage`, lọc định dạng MIME ảnh và giới hạn dung lượng tải lên an toàn.
5. **Centralized Error Handling & CORS (Slot 13):**
   * Middleware bắt lỗi tập trung (`errorHandler`) ngăn ngừa crash tiến trình Node.js và chuẩn hóa format JSON trả về.
   * Cấu hình chia sẻ tài nguyên nguồn gốc chéo (`cors`) phục vụ ứng dụng Mobile & Web.

---

## 🚀 2. Hướng Dẫn Khởi Chạy Nhanh (Quick Start)

### Bước 1: Mở terminal tại thư mục dự án
```bash
cd prj_sdn302/CookFlow-SDN302/CookFlow-BE
```

### Bước 2: Cài đặt thư viện dependencies
```bash
npm install
```

### Bước 3: Tạo file cấu hình `.env`
```bash
cp .env.example .env
# Đổi JWT_SECRET thành một chuỗi ngẫu nhiên dài
```
> `HOST=0.0.0.0` để điện thoại / emulator trong cùng mạng gọi được API (dùng `localhost` thì chỉ máy tính này gọi được).

### Bước 4: Nạp dữ liệu khởi tạo (Database Seeding)
```bash
npm run seed
```
> Script tự kết nối MongoDB, chạy migration rồi tạo (bỏ qua nếu đã có):
> * 2 tài khoản mẫu giống app mobile (Admin & Chef)
> * 5 danh mục món ăn mặc định của app
> * 6 công thức mẫu của app (`type: "system"`, có `legacyId` = id cũ trong app như `rec_01`)

### Bước 5: Khởi động máy chủ API
```bash
npm run dev
# Máy chủ lắng nghe tại: http://0.0.0.0:9999
```
> Khi khởi động, server tự chạy **migration** để nâng cấp dữ liệu tạo bởi phiên bản API cũ (xem `CHANGELOG.md`).

### Bước 6: Chạy bộ kiểm thử tự động
```bash
npm test
# 91 ca kiểm thử E2E + kiểm thử migration, chạy trên MongoDB in-memory
# (không cần MongoDB hay server đang chạy; lần đầu sẽ tải binary MongoDB)
npm run test:api   # smoke test nhanh, cần server + dữ liệu seed đang chạy
```

---

## 🔐 3. Tài Khoản Thử Nghiệm Mẫu (Demo Credentials)

| Vai trò (Role) | Email / Username | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **👑 Admin (Quản trị viên)** | `admin@cookflow.demo` (hoặc `admin`) | `Admin123!` | Quản lý danh mục, tài khoản, yêu cầu/báo cáo, kho công thức chung, sửa/xóa mọi công thức |
| **🍳 User (Đầu bếp CookFlow)** | `chef@cookflow.demo` (hoặc `chef`) | `Chef123!` | Công thức cá nhân, yêu thích, đi chợ, kho nguyên liệu, lịch sử nấu, kế hoạch bữa ăn |

> Mật khẩu mới (đăng ký, đổi, đặt lại) phải giống luật của app: **≥ 8 ký tự**, độ mạnh **trung bình** trở lên.

---

## 📡 4. Danh Sách RESTful API Endpoints

> Tài liệu chi tiết request/response cho app mobile: **[`docs/FE_INTEGRATION.md`](docs/FE_INTEGRATION.md)**.
> Mọi lỗi có cùng dạng: `{ success: false, message: "<tiếng Việt>", code?, errors?, error: { status, message } }`.

### 🔑 Authentication (`/api/auth`)
* `POST /register`: Đăng ký `{ name, email, password }` → gửi mã xác minh 6 số (chưa cấp token).
* `POST /verify-email`: Xác minh `{ email, code }` → trả token (đăng nhập luôn).
* `POST /resend-code`: Gửi lại mã xác minh.
* `POST /login`: Đăng nhập `{ email, password }` (hoặc `usernameOrEmail`). Chưa xác minh → `403 EMAIL_NOT_VERIFIED`; bị khóa → `403 ACCOUNT_LOCKED`.
* `POST /forgot-password`, `POST /reset-password`: Quên mật khẩu bằng mã 6 số.
* `PUT /change-password`: Đổi mật khẩu (*Private*).
* `GET /me`: Thông tin tài khoản + cài đặt (*Private*).
* `PUT /profile`: Cập nhật tên (2–40 ký tự), avatar (*Private*).

> Chưa cấu hình máy chủ mail: mã được in ra console và trả về trong trường `devCode` khi `NODE_ENV` khác `production`.

### 👤 Users (`/api/users`)
* `GET/PUT /me/settings`: Cài đặt cá nhân (dị ứng, mục tiêu kcal, âm báo...) + cờ onboarding.
* `GET /me/data`, `POST /me/data/import`, `DELETE /me/data`: Xuất / nhập (định dạng sao lưu của app) / xóa dữ liệu cá nhân.
* `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`: Quản lý tài khoản (*Admin*) - tạo, sửa, khóa, xác minh, xóa.

### 🍲 Categories (`/api/categories`)
* `GET /`: Danh mục theo thứ tự hiển thị, kèm `recipeCount`.
* `POST /`: Tạo danh mục chỉ cần `name` - `slug` tự sinh (*Admin*).
* `PUT /reorder`: Sắp xếp lại `{ ids }` hoặc `{ names }` (*Admin*).
* `PUT /:id`: Đổi tên / icon (*Admin*).
* `DELETE /:id`: Xóa; công thức trong đó chuyển sang "Món chính 🍲"; không xóa được danh mục cuối (*Admin*).

> **`slug`** là định danh không dấu dùng trong URL, sinh từ tên: `"Món chính 🍲"` → `mon-chinh`.

### 📖 Recipes (`/api/recipes`)
* `GET /?category=&search=&difficulty=&tag=&type=&mine=&maxCalories=&maxTime=&sort=&page=&limit=`: Danh sách công thức **người gọi được xem**; tìm kiếm không dấu.
* `GET /:id`: Chi tiết (công thức riêng tư của người khác → 404).
* `POST /`: Tạo công thức cá nhân; admin gửi `system: true` (hoặc `type`) để thêm vào kho chung.
* `PUT|PATCH /:id`: Sửa từng phần (*Chủ sở hữu / Admin*). Id nguyên liệu/bước được giữ nguyên.
* `DELETE /:id`: Xóa (*Chủ sở hữu / Admin*).
* `GET /my/created`: Công thức do mình tạo.

| `type` | Ý nghĩa | Mặc định | Ai sửa/xóa |
| :--- | :--- | :--- | :--- |
| `system` | Công thức mẫu có sẵn (seed) | công khai | Admin |
| `admin` | Admin thêm vào kho chung | công khai | Admin |
| `personal` | Người dùng tự tạo / sao chép / nhập | **riêng tư** (`isPublic: false`), chủ có thể chia sẻ | Chủ sở hữu, Admin |

### ❤️ Favorites (`/api/favorites`)
* `GET /`: Danh sách yêu thích (chỉ công thức còn xem được).
* `POST /:recipeId/toggle`: Thả tim / bỏ tim.

### 🛒 Shopping List (`/api/shopping`)
* `GET /`: Danh sách cần mua.
* `POST /`, `POST /bulk`: Thêm món - **tự gộp** dòng trùng tên (300 g + 0,5 kg = 800 g, "Vừa đủ"...).
* `PATCH /:id`: Sửa tên / số lượng / đơn vị, đặt `checked` (mua xong → tự thêm vào kho nếu bật `autoStockPantry`).
* `PATCH /:id/toggle`: Đảo trạng thái đã mua.
* `POST /restore`: Hoàn tác dòng vừa xóa.
* `DELETE /:id`, `DELETE /clear-checked`.

### 🧊 Pantry (`/api/pantry`) - so khớp tên **không dấu**
* `GET /`, `POST /` (thêm `{ ingredientName }` hoặc `{ names }`), `POST /remove`, `POST /toggle`, `DELETE /`.
* `GET /suggest-recipes`: Gợi ý món theo kho.

### 🍳 Cooking History (`/api/history`)
* `GET /?recipeId=`, `POST /`, `DELETE /:id`: Lịch sử nấu (đánh giá 1–5, ghi chú), giữ 200 mục mới nhất.

### 📅 Meal Plan (`/api/meal-plans`)
* `GET /?from=&to=`, `POST /`, `PATCH /:id`, `DELETE /:id`: Nhật ký / kế hoạch bữa ăn theo ngày `YYYY-MM-DD`.
* `POST /copy-day`: Sao chép thực đơn sang ngày khác.
* `POST /to-shopping`: Đưa nguyên liệu các món đã lên kế hoạch vào giỏ.

### 📝 Requests & Reports (`/api/requests`)
* `POST /`, `GET /mine`, `DELETE /:id`: Người dùng gửi yêu cầu món mới / báo cáo công thức.
* `GET /`, `PATCH /:id`: Admin duyệt, đổi trạng thái, trả lời.

### 📊 Admin (`/api/admin`)
* `GET /stats`: Số liệu tổng quan (tài khoản, công thức theo loại, danh mục, yêu cầu).

### 🖼️ Upload Media (`/api/upload`)
* `POST /image`: Upload 1 ảnh (field `image`, ≤ 5MB).
* `POST /video`: Upload 1 video (field `video`, mp4/mov/m4v/webm/3gp, ≤ 50MB).
* `POST /images`: Upload nhiều ảnh (field `images`, tối đa 5 file).
* `GET /files`: Liệt kê các file đã upload.
* `GET /download/:filename`: Tải file về (chặn path traversal).

---

## 🔒 Bảo Mật & Cấu Hình
* **JWT:** `JWT_SECRET` **bắt buộc** khai báo trong `.env`. Token chỉ gửi qua header `Authorization: Bearer <token>`. Tài khoản bị khóa / chưa xác minh bị từ chối ngay cả khi token còn hạn.
* **Mã OTP:** chỉ lưu hash, hết hạn sau 10 phút, tối đa 5 lần nhập sai, chờ 30 giây giữa 2 lần gửi.
* **CORS:** cấu hình qua `CORS_ORIGIN`. App mobile và Postman không gửi header Origin nên luôn được phép.
* **Phân quyền công thức:** công thức riêng tư không lộ qua danh sách, chi tiết, yêu thích, gợi ý, lịch sử hay kế hoạch.
* **Chống mass assignment:** chỉ các trường cho phép mới được cập nhật (không sửa được `author`, `likesCount`, `type`...).
* **Chống RegExp injection:** từ khóa tìm kiếm được escape trước khi đưa vào `$regex`.
* **Validation:** mọi route POST/PUT/PATCH được kiểm tra bằng `express-validator`, giới hạn trùng với app (khẩu phần 1–50, thời gian ≤ 1440 phút, hẹn giờ ≤ 600 phút, kcal ≤ 5000...).
* **Phân trang:** `limit` tối đa 100 bản ghi mỗi trang.

---

## 🧪 5. Kiểm Thử Với Postman
Import file **`CookFlow_SDN302_API.postman_collection.json`** vào Postman. Request **Login** tự lưu token vào biến `{{token}}`.

## 📝 6. Lịch Sử Thay Đổi
Xem **[`CHANGELOG.md`](CHANGELOG.md)** - các thay đổi để đồng bộ với app mobile CookFlow (MMA301).
