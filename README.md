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

### Bước 3: Nạp dữ liệu khởi tạo (Database Seeding)
```bash
npm run seed
```
> Script sẽ tự động kết nối MongoDB và tạo:
> * 2 tài khoản mẫu (Admin & Chef)
> * 5 Danh mục món ăn chuẩn
> * 6 Công thức nấu ăn chi tiết có đầy đủ nguyên liệu & bước hẹn giờ.

### Bước 4: Khởi động máy chủ API
```bash
npm run dev
# Máy chủ lắng nghe tại: http://localhost:9999
```

### Bước 5: Chạy bộ kiểm thử tự động
```bash
npm run test:api
# Kiểm tra tự động toàn bộ 8 endpoint chính
```

---

## 🔐 3. Tài Khoản Thử Nghiệm Mẫu (Demo Credentials)

| Vai trò (Role) | Email / Username | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **👑 Admin (Quản trị viên)** | `admin@cookflow.com` (hoặc `admin`) | `123456` | Quản lý Category, duyệt/sửa/xóa mọi công thức, quản lý user |
| **🍳 User (Bếp trưởng CookFlow)** | `chef@cookflow.com` (hoặc `chef`) | `123456` | CRUD công thức cá nhân, thả tim, đi chợ, quản lý tủ lạnh |

---

## 📡 4. Danh Sách RESTful API Endpoints

### 🔑 Authentication (`/api/auth`)
* `POST /api/auth/register`: Đăng ký tài khoản mới.
* `POST /api/auth/login`: Đăng nhập, nhận JWT Bearer Token.
* `GET /api/auth/me`: Lấy thông tin tài khoản đang đăng nhập (kèm Bearer Token).
* `PUT /api/auth/profile`: Cập nhật họ tên, avatar.

### 🍲 Categories (`/api/categories`)
* `GET /api/categories`: Lấy toàn bộ danh mục món ăn.
* `POST /api/categories`: Tạo danh mục mới (*Admin*).
* `PUT /api/categories/:id`: Sửa danh mục (*Admin*).
* `DELETE /api/categories/:id`: Xóa danh mục (*Admin*).

### 📖 Recipes (`/api/recipes`)
* `GET /api/recipes?category=...&search=...`: Lấy danh sách công thức (hỗ trợ lọc & tìm kiếm).
* `GET /api/recipes/:id`: Xem chi tiết 1 công thức (populate author, category).
* `POST /api/recipes`: Tạo công thức mới (*Private*).
* `PUT /api/recipes/:id`: Cập nhật công thức (*Owner / Admin*).
* `DELETE /api/recipes/:id`: Xóa công thức (*Owner / Admin*).
* `GET /api/recipes/my/created`: Lấy các công thức do user hiện tại tạo (*Private*).

### ❤️ Favorites (`/api/favorites`)
* `GET /api/favorites`: Lấy danh sách món ăn yêu thích của user.
* `POST /api/favorites/:recipeId/toggle`: Thả tim / Bỏ tim công thức.

### 🛒 Shopping List (`/api/shopping`)
* `GET /api/shopping`: Lấy danh sách nguyên liệu cần mua.
* `POST /api/shopping`: Thêm món mua tự do.
* `POST /api/shopping/bulk`: Thêm hàng loạt nguyên liệu từ 1 công thức vào giỏ.
* `PATCH /api/shopping/:id/toggle`: Đánh dấu đã mua / chưa mua.
* `DELETE /api/shopping/:id`: Xóa 1 nguyên liệu khỏi giỏ.
* `DELETE /api/shopping/clear-checked`: Xóa tất cả món đã mua xong.

### 🧊 Pantry Finder (`/api/pantry`)
* `GET /api/pantry`: Lấy danh sách nguyên liệu trong tủ lạnh.
* `POST /api/pantry/toggle`: Thêm/Xóa nguyên liệu vào tủ lạnh.
* `DELETE /api/pantry`: Làm rỗng tủ lạnh.
* `GET /api/pantry/suggest-recipes`: Thuật toán tính độ trùng khớp và gợi ý món nấu được.

### 🖼️ Upload Media (`/api/upload`)
* `POST /api/upload/image`: Upload ảnh qua Multer, lưu vào `public/uploads`.

---

## 🧪 5. Kiểm Thử Với Postman
Import file **`CookFlow_SDN302_API.postman_collection.json`** trực tiếp vào Postman để kiểm tra toàn bộ luồng request một cách trực quan.
