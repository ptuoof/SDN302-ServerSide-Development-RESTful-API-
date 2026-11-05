# Tích hợp app mobile CookFlow (MMA301) với API

Tài liệu dành cho người nối app React Native/Expo (repo `MMA301/CookFlow`) vào API này.
Mọi quy tắc nghiệp vụ trước đây nằm trong `AuthContext` / `RecipeContext` của app đã được chuyển sang server
với **cùng luật** (giới hạn, bỏ dấu, gộp danh sách mua sắm...), để app chỉ cần gọi API và hiển thị kết quả.

App đã được nối vào API (nhánh `feat/intergrate-backend` của repo MMA301): client `src/services/api/client.js`
(`apiRequest`, `setAuthToken`, `ApiError`), mỗi tài nguyên một module trong `src/services/api/`, và
`AuthContext` / `RecipeContext` gọi các module này. Kiểm thử hợp đồng phía app:
`COOKFLOW_BACKEND_DIR=<repo này> npm run test:api` (trong repo MMA301).

---

## 1. Quy ước chung

| Mục | Quy ước |
| :--- | :--- |
| Base URL | `EXPO_PUBLIC_API_URL`; mặc định Android emulator `http://10.0.2.2:9999`, iOS/web `http://localhost:9999` |
| Xác thực | Header `Authorization: Bearer <token>` (token có hạn `JWT_EXPIRES_IN`, mặc định 7 ngày) |
| Id | Mọi tài nguyên có `id` (chuỗi). `_id` vẫn được trả cho client cũ |
| Thời gian | Công thức / danh mục / user: ISO string. **Lịch sử nấu, kế hoạch bữa ăn, yêu cầu:** epoch **ms** (giống dữ liệu cũ của app) |
| Ngày | Kế hoạch bữa ăn dùng ngày lịch của điện thoại `YYYY-MM-DD`. Gửi kèm `today` khi tạo / sao chép để server biết "hôm nay" theo máy người dùng |

### Định dạng lỗi (mọi endpoint)
```json
{
  "success": false,
  "message": "Email hoặc mật khẩu chưa chính xác.",
  "code": "INVALID_CREDENTIALS",
  "errors": [{ "field": "email", "message": "...", "value": "..." }],
  "error": { "status": 401, "message": "Email hoặc mật khẩu chưa chính xác." }
}
```
`message` là tiếng Việt, hiển thị thẳng cho người dùng. `code` và `errors` chỉ có khi cần.

| `code` | HTTP | Ý nghĩa / app nên làm gì |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | 400 | Dữ liệu sai; chi tiết trong `errors` |
| `WEAK_PASSWORD` | 400 | Mật khẩu < 8 ký tự hoặc độ mạnh "Yếu" |
| `INVALID_CODE` | 400 | Mã OTP sai / hết hạn / nhập sai quá 5 lần |
| `INVALID_CREDENTIALS` | 401 | Sai email hoặc mật khẩu |
| `TOKEN_MISSING` / `TOKEN_INVALID` / `TOKEN_EXPIRED` | 401 | Xóa token, quay về màn đăng nhập |
| `EMAIL_NOT_VERIFIED` | 403 | Chuyển sang màn "Xác minh email" (`email` có trong body) |
| `ACCOUNT_LOCKED` | 403 | "Tài khoản đã bị khóa..." - đăng xuất |
| `FORBIDDEN` | 403 | Không đủ quyền |
| `EMAIL_TAKEN` / `USERNAME_TAKEN` | 409 | Email / username đã dùng |
| `TOO_SOON` | 429 | Vừa gửi mã, đợi 30 giây |

---

## 2. Bảng ánh xạ hàm của app → API

### AuthContext
| Hàm trong app | API |
| :--- | :--- |
| `register({ name, email, password })` | `POST /api/auth/register` → `{ requiresVerification: true, email, devCode? }` (chưa có token) |
| `verify(email)` + mã người dùng nhập | `POST /api/auth/verify-email` `{ email, code }` → `{ token, user }` |
| (gửi lại mã) | `POST /api/auth/resend-code` `{ email }` |
| `login(email, password)` | `POST /api/auth/login` `{ email, password }` → `{ token, user }` |
| `resetPassword(email, password)` (bước "forgot" → "reset") | `POST /api/auth/forgot-password` `{ email }`, rồi `POST /api/auth/reset-password` `{ email, code, newPassword }` |
| `changePassword(old, new)` | `PUT /api/auth/change-password` `{ currentPassword, newPassword }` |
| `updateProfile({ name })` | `PUT /api/auth/profile` `{ name }` |
| khởi động app (khôi phục phiên) | `GET /api/auth/me` → `{ user, settings, hasSeenOnboarding }` |
| `signOut()` | Chỉ xóa token trên máy (JWT không lưu phía server) |
| `signInWithGoogle()` | **Chưa có API** (app đang giả lập) |
| `listUsers()` | `GET /api/users` → `{ users, stats }` |
| `adminSaveUser({ originalEmail, email, name, role, verified, locked, password })` | Tạo: `POST /api/users`; sửa: `PUT /api/users/:id` (dùng `id` thay cho `originalEmail`) |
| `adminDeleteUser(email)` | `DELETE /api/users/:id` |

Đối tượng `user`: `{ id, username, email, name, fullName, avatar, role, verified, locked, createdAt }`.
App đang định danh người dùng bằng `email`; nên chuyển sang `user.id`.

**Mã xác minh:** server chưa gửi email thật. Mã in ở console server và, ngoài môi trường `production`,
được trả trong `devCode`. App có thể hiện "Mã demo: {devCode}" thay cho mã cố định `123456` cũ.

### RecipeContext - công thức
| Hàm trong app | API |
| :--- | :--- |
| nạp danh sách `recipes` | `GET /api/recipes?limit=100&page=N` (kèm token để thấy cả công thức riêng của mình) |
| `getRecipeById(id)` | `GET /api/recipes/:id` |
| `addRecipe(data)` | `POST /api/recipes` (body = payload form của app) |
| `addRecipe(data, { system: true })` (admin) | `POST /api/recipes` với `system: true` → `type: "admin"` |
| `updateRecipe(recipe)` | `PUT /api/recipes/:id` (gửi lại `ingredients` / `steps` **kèm `id` server trả về** để giữ timer) |
| `deleteRecipe(id)` | `DELETE /api/recipes/:id` |
| `toggleFavorite(id)` / `favoriteIds` | `POST /api/favorites/:id/toggle` / `GET /api/favorites` → `favoriteIds` |

Công thức trả về có các trường app đang dùng (`title, description, imageUrl, videoUrl, category` (tên),
`prepTimeMinutes, cookTimeMinutes, servings, calories, nutrition, difficulty, tags, colorAccent, ingredients[], steps[]`,
`copiedFrom, variantOf, aiChanges, isCustom, createdAt, updatedAt`) và thêm:

| Trường | Ý nghĩa |
| :--- | :--- |
| `type` | `system` (mẫu có sẵn) / `admin` (admin thêm vào kho) / `personal` (người dùng tạo) |
| `isPublic` | Công thức cá nhân mặc định `false` (chỉ chủ + admin thấy). Chủ gửi `isPublic: true` để chia sẻ |
| `ownerId`, `author`, `authorName` | Thay cho `ownerEmail` của app |
| `isOwner`, `canEdit` | Tính sẵn cho người đang gọi (ẩn/hiện nút Sửa, Xóa) |
| `categoryId`, `categoryObj` | Id / object danh mục; `category` vẫn là **tên** để lọc như cũ |
| `legacyId` | Id cũ của công thức mẫu trong app (`rec_01`...) |

Quy tắc dữ liệu giống `normalizeRecipe()`: 0 phút vẫn là 0; `calories` / `nutrition.*` chưa rõ là `null`;
nguyên liệu không có số lượng → `"Vừa đủ"`; đơn vị chuẩn hóa (`gram` → `g`); bước không có tiêu đề → `"Bước N"`;
khẩu phần 1–50, thời gian ≤ 1440 phút, hẹn giờ ≤ 600 phút, kcal ≤ 5000, macro ≤ 500 g.

**Id nguyên liệu / bước:** id cục bộ của app (`i1`, `s2`, `custom_x`...) được thay bằng id server khi lưu.
Sau khi tạo / sửa, **thay công thức trong state bằng bản server trả về**. Id server gửi lại được giữ nguyên,
nên chèn / xóa / đổi thứ tự bước không làm timer gán nhầm bước.

### RecipeContext - danh mục (admin)
| Hàm trong app | API |
| :--- | :--- |
| `categories` | `GET /api/categories` → `names` (mảng tên theo thứ tự) và `categories` (kèm `id`, `recipeCount`) |
| `addCategory(name)` | `POST /api/categories` `{ name }` (slug tự sinh) |
| `renameCategory(old, new)` | `PUT /api/categories/:id` `{ name }` (công thức đi theo vì tham chiếu theo id) |
| `deleteCategory(name)` | `DELETE /api/categories/:id` → `{ movedRecipes, fallbackCategory }` |
| `moveCategory(name, direction)` | Đổi chỗ trong mảng rồi `PUT /api/categories/reorder` `{ names }` (hoặc `{ ids }`) |
| `countRecipesInCategory(name)` | `recipeCount` trong `GET /api/categories` |

Lỗi tên danh mục trả đúng câu của app: "Tên danh mục không được để trống.", "Danh mục này đã tồn tại.", "\"Tất cả\" là tên dành riêng cho bộ lọc.", "Cần giữ lại ít nhất 1 danh mục."...

### RecipeContext - danh sách mua sắm (đã có `src/services/api/shopping.js`)
| Hàm trong app | API |
| :--- | :--- |
| `shoppingList` | `GET /api/shopping` |
| `addToShoppingList(ingredients, recipeTitle)` | `POST /api/shopping/bulk` → `{ added, merged, items }` (server gộp dòng) |
| `addCustomShoppingItem(name, amount, unit)` | `POST /api/shopping` → `{ added, merged, item }` |
| `updateShoppingItem(id, { name, amount, unit })` | `PATCH /api/shopping/:id` |
| `toggleShoppingItem(id)` | `PATCH /api/shopping/:id` `{ checked: true/false }` → `{ item, pantry? }` |
| `deleteShoppingItem(id)` | `DELETE /api/shopping/:id` → `{ item }` (giữ lại để hoàn tác) |
| `restoreShoppingItem(removed)` | `POST /api/shopping/restore` (body = `removed.item`) |
| `clearCheckedShoppingItems()` | `DELETE /api/shopping/clear-checked` |

Khi đánh dấu đã mua và cài đặt `autoStockPantry` bật, server tự thêm vào kho và trả `pantry` (danh sách mới).
Bỏ đánh dấu nhầm thì server lấy lại khỏi kho, trừ khi nguyên liệu đã có trong kho từ trước.
Có `pantry` trong response thì cập nhật luôn `pantryIngredients`.

### RecipeContext - kho nguyên liệu
| Hàm trong app | API |
| :--- | :--- |
| `pantryIngredients` | `GET /api/pantry` → `ingredients` (thứ tự thêm vào) |
| `togglePantryIngredient(name)` | `POST /api/pantry/toggle` `{ ingredientName }` |
| `addPantryIngredient(name)` | `POST /api/pantry` `{ ingredientName }` hoặc `{ names: [...] }` (đã có thì bỏ qua) |
| `removePantryIngredients(names)` | `POST /api/pantry/remove` `{ names }` |
| `clearPantry()` | `DELETE /api/pantry` |

So khớp tên bỏ dấu và không phân biệt hoa thường, giống `normalizeVi()`: "hanh la" = "Hành lá".

### RecipeContext - lịch sử nấu, kế hoạch, cài đặt, yêu cầu
| Hàm trong app | API |
| :--- | :--- |
| `cookHistory` | `GET /api/history` (thêm `?recipeId=` → kèm `stats { count, lastAt, avgRating }`) |
| `recordCooking({ recipe, servings, startedAt, rating, note })` | `POST /api/history` `{ recipeId, servings, startedAt, rating, note }` |
| `deleteHistoryEntry(id)` | `DELETE /api/history/:id` |
| `mealPlan` | `GET /api/meal-plans?from=&to=` |
| `addMealEntry({ date, slot, recipe, title, calories, servings, eaten, note })` | `POST /api/meal-plans` `{ date, slot, recipeId, title, calories, servings, eaten, note, today }` |
| `updateMealEntry(id, patch)` / `toggleMealEaten(id)` | `PATCH /api/meal-plans/:id` |
| `deleteMealEntry(id)` | `DELETE /api/meal-plans/:id` → `{ entry }` |
| `copyMealDay(from, to)` | `POST /api/meal-plans/copy-day` `{ fromDate, toDate, today }` |
| `addPlanToShopping(from, to)` | `POST /api/meal-plans/to-shopping` `{ from, to }` → `{ added, merged, dishes }` |
| `settings` / `updateSettings(patch)` | `GET` / `PUT /api/users/me/settings` |
| `completeOnboarding()` / `resetOnboarding()` | `PUT /api/users/me/settings` `{ hasSeenOnboarding: true/false }` |
| `exportBackup()` | `GET /api/users/me/data` → `backup` (cùng định dạng file `cookflow-backup` của app) |
| `restoreBackup(data)` | `POST /api/users/me/data/import` (body = nội dung file sao lưu) |
| `resetAllData()` | `DELETE /api/users/me/data` |
| `submitRecipeRequest({ type, title, details, recipe })` | `POST /api/requests` `{ type, title, details, recipeId }` |
| `recipeRequests` (người dùng) | `GET /api/requests/mine` |
| `recipeRequests` (admin) | `GET /api/requests` → `{ requests, counts }` |
| `updateRecipeRequest(id, { status, adminReply })` | `PATCH /api/requests/:id` (admin) |
| `deleteRecipeRequest(id)` | `DELETE /api/requests/:id` (người gửi hoặc admin) |
| màn tổng quan admin | `GET /api/admin/stats` |

Nhập bản sao lưu cũ của app offline vẫn được: id cục bộ của công thức tự tạo được ánh xạ sang id mới;
`favoriteIds` / `recipeId` dạng `rec_01` khớp với công thức mẫu qua `legacyId`.

**Giữ trên máy, không cần API:** timer, phiên nấu đang chạy, khóa Gemini và AI Sous-Chef, QR chia sẻ,
phát hiện công thức trùng (`findDuplicateRecipe`), bộ lọc Khám phá (dị ứng, gia vị cơ bản).

### Upload ảnh / video
Ảnh và video chọn từ album đang lưu cục bộ (`persistMedia`), máy khác không xem được. Trước khi lưu công thức:
```js
const form = new FormData();
form.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' }); // video: field 'video', type 'video/mp4'
const { imageUrl } = await apiRequest('/api/upload/image', { method: 'POST', body: form }); // video -> videoUrl
```
Giới hạn: ảnh ≤ 5MB (jpeg/png/webp/gif/heic), video ≤ 50MB (mp4/mov/m4v/webm/3gp).
URL trả về dùng đúng host app đã gọi (ví dụ `http://10.0.2.2:9999/uploads/...` trên emulator).
