// End-to-end tests of the whole API, as the mobile app uses it.
//   npm test
// Runs against an in-memory MongoDB (or TEST_MONGO_URI) - no running server or database needed.
const { startTestServer, makeRequest } = require('./helpers/testServer');

let passed = 0;
let failed = 0;
function assert(condition, message, detail) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    if (detail !== undefined) console.error('         ', JSON.stringify(detail).slice(0, 400));
    failed++;
  }
}
const section = title => console.log(`\n📌 ${title}`);

async function run(request) {
  const stamp = Date.now();

  // =========================================================================
  section('1. Đăng ký, xác minh email, đăng nhập');
  // =========================================================================
  const weak = await request('/api/auth/register', 'POST', { name: 'Yếu', email: `weak_${stamp}@test.com`, password: 'abcdefgh' });
  assert(weak.status === 400 && weak.data.code === 'WEAK_PASSWORD', 'Từ chối mật khẩu yếu (luật giống app: ≥ 8 ký tự, độ mạnh trung bình)', weak.data);
  assert(weak.data.success === false && typeof weak.data.message === 'string' && weak.data.error?.status === 400, 'Lỗi có định dạng thống nhất { success, message, error.status }', weak.data);

  const noName = await request('/api/auth/register', 'POST', { email: `x_${stamp}@test.com`, password: 'Password1' });
  assert(noName.status === 400 && noName.data.code === 'VALIDATION_ERROR' && Array.isArray(noName.data.errors), 'Validator trả lỗi cùng định dạng + mảng errors', noName.data);

  const emailA = `user_a_${stamp}@test.com`;
  const regA = await request('/api/auth/register', 'POST', { name: 'Người Dùng A', email: emailA, password: 'Password1' });
  assert(regA.status === 201 && regA.data.requiresVerification === true && !regA.data.token, 'Đăng ký bằng { name, email, password } → chờ xác minh, chưa cấp token', regA.data);
  assert(/^\d{6}$/.test(regA.data.devCode || ''), 'Môi trường dev trả về devCode 6 chữ số', regA.data);
  assert(regA.data.user?.username && regA.data.user?.name === 'Người Dùng A', 'Tự sinh username, trả "name" như app', regA.data.user);

  const loginUnverified = await request('/api/auth/login', 'POST', { email: emailA, password: 'Password1' });
  assert(loginUnverified.status === 403 && loginUnverified.data.code === 'EMAIL_NOT_VERIFIED', 'Đăng nhập khi chưa xác minh → 403 EMAIL_NOT_VERIFIED', loginUnverified.data);
  const codeA = loginUnverified.data.devCode || regA.data.devCode;

  const wrongCode = await request('/api/auth/verify-email', 'POST', { email: emailA, code: codeA === '000000' ? '111111' : '000000' });
  assert(wrongCode.status === 400 && wrongCode.data.code === 'INVALID_CODE', 'Mã xác minh sai → 400', wrongCode.data);

  const verifyA = await request('/api/auth/verify-email', 'POST', { email: emailA, code: codeA });
  assert(verifyA.status === 200 && verifyA.data.token, 'Xác minh đúng mã → đăng nhập luôn (có token)', verifyA.data);
  let tokenA = verifyA.data.token;
  const userAId = verifyA.data.user.id;

  const dup = await request('/api/auth/register', 'POST', { name: 'Trùng', email: emailA, password: 'Password1' });
  assert(dup.status === 409 && dup.data.code === 'EMAIL_TAKEN', 'Chặn đăng ký trùng email - 409', dup.data);

  const emailB = `user_b_${stamp}@test.com`;
  const regB = await request('/api/auth/register', 'POST', { fullName: 'Người Dùng B', username: `user_b_${stamp}`, email: emailB, password: 'Password1!' });
  const verifyB = await request('/api/auth/verify-email', 'POST', { email: emailB, code: regB.data.devCode });
  assert(regB.status === 201 && verifyB.status === 200, 'Client cũ ({ username, fullName }) vẫn đăng ký được', { regB: regB.data, verifyB: verifyB.data });
  const tokenB = verifyB.data.token;

  const adminLogin = await request('/api/auth/login', 'POST', { email: 'admin@cookflow.demo', password: 'Admin123!' });
  assert(adminLogin.status === 200 && adminLogin.data.user.role === 'admin', 'Đăng nhập admin (tài khoản seed giống app)', adminLogin.data);
  const tokenAdmin = adminLogin.data.token;

  const legacyLogin = await request('/api/auth/login', 'POST', { usernameOrEmail: 'chef', password: 'Chef123!' });
  assert(legacyLogin.status === 200, 'Vẫn hỗ trợ { usernameOrEmail } (Postman / client cũ)', legacyLogin.data);

  const wrongLogin = await request('/api/auth/login', 'POST', { email: 'admin@cookflow.demo', password: 'sai_mat_khau' });
  assert(wrongLogin.status === 401 && wrongLogin.data.message === 'Email hoặc mật khẩu chưa chính xác.', 'Sai mật khẩu → 401 kèm thông báo tiếng Việt', wrongLogin.data);

  const me = await request('/api/auth/me', 'GET', null, tokenA);
  assert(me.status === 200 && me.data.user.email === emailA && me.data.settings?.calorieGoal === 2000, 'GET /me trả user + settings mặc định', me.data);

  const profile = await request('/api/auth/profile', 'PUT', { name: 'A Đổi Tên' }, tokenA);
  const profileLong = await request('/api/auth/profile', 'PUT', { name: 'x'.repeat(41) }, tokenA);
  assert(profile.status === 200 && profile.data.user.name === 'A Đổi Tên' && profileLong.status === 400, 'Cập nhật tên (2–40 ký tự như app)', { profile: profile.data, profileLong: profileLong.data });

  const changeBad = await request('/api/auth/change-password', 'PUT', { currentPassword: 'sai', newPassword: 'NewPass123' }, tokenA);
  const changeOk = await request('/api/auth/change-password', 'PUT', { currentPassword: 'Password1', newPassword: 'NewPass123' }, tokenA);
  const loginNew = await request('/api/auth/login', 'POST', { email: emailA, password: 'NewPass123' });
  assert(changeBad.status === 400 && changeOk.status === 200 && loginNew.status === 200, 'Đổi mật khẩu (sai mật khẩu cũ bị chặn)', { changeBad: changeBad.data, changeOk: changeOk.data });
  tokenA = loginNew.data.token;

  const forgot = await request('/api/auth/forgot-password', 'POST', { email: emailA });
  const forgotUnknown = await request('/api/auth/forgot-password', 'POST', { email: `khong_ton_tai_${stamp}@test.com` });
  assert(forgot.status === 200 && /^\d{6}$/.test(forgot.data.devCode || '') && forgotUnknown.status === 200 && !forgotUnknown.data.devCode,
    'Quên mật khẩu: cùng câu trả lời cho email có / không tồn tại', { forgot: forgot.data, forgotUnknown: forgotUnknown.data });
  const reset = await request('/api/auth/reset-password', 'POST', { email: emailA, code: forgot.data.devCode, newPassword: 'Reset1234' });
  const loginReset = await request('/api/auth/login', 'POST', { email: emailA, password: 'Reset1234' });
  assert(reset.status === 200 && loginReset.status === 200, 'Đặt lại mật khẩu bằng mã', reset.data);
  tokenA = loginReset.data.token;

  // =========================================================================
  section('2. Admin quản lý người dùng');
  // =========================================================================
  const userList = await request('/api/users', 'GET', null, tokenB);
  assert(userList.status === 403, 'User thường không xem được danh sách tài khoản', userList.data);

  const list = await request('/api/users', 'GET', null, tokenAdmin);
  assert(list.status === 200 && list.data.users[0].role === 'admin' && list.data.users.some(u => u.email === emailA), 'Admin liệt kê tài khoản (admin trước)', list.data.stats);

  const emailC = `user_c_${stamp}@test.com`;
  const createC = await request('/api/users', 'POST', { email: emailC, name: 'Người Dùng C', password: 'Password1', role: 'user' }, tokenAdmin);
  assert(createC.status === 201 && createC.data.user.verified === true, 'Admin tạo tài khoản (mặc định đã xác minh)', createC.data);
  const userCId = createC.data.user.id;
  const loginC = await request('/api/auth/login', 'POST', { email: emailC, password: 'Password1' });
  const tokenC = loginC.data.token;

  const lockC = await request(`/api/users/${userCId}`, 'PUT', { locked: true }, tokenAdmin);
  const meLocked = await request('/api/auth/me', 'GET', null, tokenC);
  const loginLocked = await request('/api/auth/login', 'POST', { email: emailC, password: 'Password1' });
  assert(lockC.status === 200 && meLocked.status === 403 && meLocked.data.code === 'ACCOUNT_LOCKED' && loginLocked.data.code === 'ACCOUNT_LOCKED',
    'Khóa tài khoản: token cũ bị từ chối ngay, không đăng nhập được', { meLocked: meLocked.data, loginLocked: loginLocked.data });

  const selfDemote = await request(`/api/users/${adminLogin.data.user.id}`, 'PUT', { role: 'user' }, tokenAdmin);
  const selfDelete = await request(`/api/users/${adminLogin.data.user.id}`, 'DELETE', null, tokenAdmin);
  assert(selfDemote.status === 400 && selfDelete.status === 400, 'Admin không tự hạ quyền / tự xóa mình', { selfDemote: selfDemote.data, selfDelete: selfDelete.data });

  const renameC = await request(`/api/users/${userCId}`, 'PUT', { name: 'C Mới', locked: false, verified: false }, tokenAdmin);
  assert(renameC.status === 200 && renameC.data.user.name === 'C Mới' && renameC.data.user.verified === false, 'Admin sửa tên / trạng thái xác minh', renameC.data);

  const deleteC = await request(`/api/users/${userCId}`, 'DELETE', null, tokenAdmin);
  const meDeleted = await request('/api/auth/me', 'GET', null, tokenC);
  assert(deleteC.status === 200 && meDeleted.status === 401, 'Admin xóa tài khoản', deleteC.data);

  // =========================================================================
  section('3. Danh mục');
  // =========================================================================
  const userCat = await request('/api/categories', 'POST', { name: `Hack ${stamp}` }, tokenA);
  assert(userCat.status === 403, 'User thường không tạo được danh mục', userCat.data);

  const catName = `Món Kiểm Thử ${String(stamp).slice(-5)}`;
  const cat = await request('/api/categories', 'POST', { name: catName }, tokenAdmin);
  assert(cat.status === 201 && cat.data.category.slug === `mon-kiem-thu-${String(stamp).slice(-5)}`, 'Admin tạo danh mục chỉ với tên → slug tự sinh', cat.data);
  const catId = cat.data.category.id;

  const dupCat = await request('/api/categories', 'POST', { name: catName.toUpperCase().replace('Ó', 'O') }, tokenAdmin);
  const reserved = await request('/api/categories', 'POST', { name: 'tat ca' }, tokenAdmin);
  const tooLong = await request('/api/categories', 'POST', { name: 'x'.repeat(31) }, tokenAdmin);
  assert(dupCat.status === 400 && reserved.status === 400 && tooLong.status === 400, 'Kiểm tra tên như app: trùng (bỏ dấu), "Tất cả", > 30 ký tự', { dupCat: dupCat.data.message, reserved: reserved.data.message, tooLong: tooLong.data.message });

  const cats = await request('/api/categories');
  const seeded = cats.data.categories.find(c => c.name === 'Món nhanh ⚡');
  assert(cats.status === 200 && typeof seeded?.recipeCount === 'number' && seeded.recipeCount > 0 && Array.isArray(cats.data.names), 'Danh sách danh mục kèm recipeCount + names', cats.data.categories.map(c => [c.name, c.recipeCount]));

  const reversed = [...cats.data.categories].reverse().map(c => c.id);
  const reorder = await request('/api/categories/reorder', 'PUT', { ids: reversed }, tokenAdmin);
  const partialReorder = await request('/api/categories/reorder', 'PUT', { ids: reversed.slice(1) }, tokenAdmin);
  assert(reorder.status === 200 && reorder.data.categories[0].id === reversed[0] && partialReorder.status === 400, 'Đổi thứ tự danh mục (phải gửi đủ danh sách)', reorder.data.names);
  await request('/api/categories/reorder', 'PUT', { names: cats.data.names }, tokenAdmin);

  const renameCat = await request(`/api/categories/${catId}`, 'PUT', { name: `${catName} Mới` }, tokenAdmin);
  assert(renameCat.status === 200 && renameCat.data.category.slug.endsWith('-moi'), 'Đổi tên danh mục → slug đi theo tên', renameCat.data);

  // =========================================================================
  section('4. Công thức: cá nhân / hệ thống / admin, riêng tư / công khai');
  // =========================================================================
  const badRecipe = await request('/api/recipes', 'POST', { description: 'Thiếu tên' }, tokenA);
  assert(badRecipe.status === 400, 'Thiếu tên công thức → 400', badRecipe.data);

  const recipeBody = {
    title: 'Món Thử Nghiệm Của User A',
    description: 'Công thức đặc biệt',
    category: `${catName} Mới`,
    prepTimeMinutes: 0,
    cookTimeMinutes: 20,
    servings: 2,
    calories: null,
    nutrition: { protein: 25, carbs: '', fat: 10 },
    tags: ['giau dam', 'Không tồn tại'],
    difficulty: 'Vừa',
    copiedFrom: 'rec_01',
    ingredients: [
      { id: 'i1', name: 'Thịt gà', amount: '300', unit: 'gram' },
      { id: 'i2', name: 'Cà rốt', amount: '', unit: '' }
    ],
    steps: [
      { id: 's1', title: 'Chuẩn bị', instruction: 'Rửa sạch thịt gà', image: 'https://img/step1.jpg', timerSeconds: 90 },
      { id: 's2', instruction: 'Nấu chín' }
    ]
  };
  const created = await request('/api/recipes', 'POST', recipeBody, tokenA);
  const r = created.data.recipe;
  assert(created.status === 201 && r.type === 'personal' && r.isCustom === true && r.isPublic === false, 'User tạo công thức cá nhân → mặc định riêng tư', r && { type: r.type, isPublic: r.isPublic });
  assert(r?.prepTimeMinutes === 0 && r?.calories === null && r?.nutrition.protein === 25 && r?.nutrition.carbs === null, 'Giữ 0 phút và kcal/macro chưa rõ là null (không tự bịa 10 phút / 250 kcal)', r && { prep: r.prepTimeMinutes, kcal: r.calories, nutrition: r.nutrition });
  assert(JSON.stringify(r?.tags) === '["Giàu đạm"]' && r?.copiedFrom === 'rec_01' && r?.category === `${catName} Mới`, 'Lưu tags (chuẩn hóa), copiedFrom, category theo tên', r && { tags: r.tags, category: r.category });
  assert(r?.ingredients.every(i => /^[a-f0-9]{24}$/.test(i.id)) && r?.ingredients[0].unit === 'g' && r?.ingredients[1].amount === 'Vừa đủ', 'Nguyên liệu có id ổn định, đơn vị chuẩn hóa, số lượng trống = "Vừa đủ"', r?.ingredients);
  assert(r?.steps[0].image === 'https://img/step1.jpg' && r?.steps[0].timerSeconds === 90 && r?.steps[1].title === 'Bước 2' && r?.steps.every(s => s.id), 'Bước nấu có id, ảnh bước, hẹn giờ', r?.steps);
  const recipeAId = r.id;

  const timerTooLong = await request('/api/recipes', 'POST', { title: 'Hẹn giờ dài', steps: [{ instruction: 'x', timerSeconds: 600 * 60 + 1 }], servings: 51 }, tokenA);
  assert(timerTooLong.status === 400, 'Giới hạn giống app: khẩu phần ≤ 50, hẹn giờ ≤ 600 phút', timerTooLong.data);

  const bGet = await request(`/api/recipes/${recipeAId}`, 'GET', null, tokenB);
  const anonList = await request('/api/recipes?limit=100');
  const bList = await request('/api/recipes?limit=100', 'GET', null, tokenB);
  const aList = await request('/api/recipes?mine=true', 'GET', null, tokenA);
  assert(bGet.status === 404 && !anonList.data.recipes.some(x => x.id === recipeAId) && !bList.data.recipes.some(x => x.id === recipeAId), 'Công thức riêng tư: người khác và khách không thấy', bGet.data);
  assert(aList.data.recipes.some(x => x.id === recipeAId && x.isOwner && x.canEdit), 'Chủ sở hữu thấy công thức của mình (isOwner, canEdit)', aList.data.total);

  const stepIds = r.steps.map(s => s.id);
  const update = await request(`/api/recipes/${recipeAId}`, 'PUT', {
    title: 'Món Đã Cập Nhật',
    steps: [{ id: 'new_local', instruction: 'Bước mới chèn đầu' }, ...r.steps]
  }, tokenA);
  assert(update.status === 200 && update.data.recipe.steps[1].id === stepIds[0] && update.data.recipe.steps[2].id === stepIds[1] && update.data.recipe.ingredients.length === 2,
    'Sửa từng phần: chèn bước mới, id các bước cũ giữ nguyên (timer không bị gán nhầm)', update.data.recipe?.steps?.map(s => s.id));

  const bEdit = await request(`/api/recipes/${recipeAId}`, 'PUT', { title: 'B sửa' }, tokenB);
  assert(bEdit.status === 404, 'Người khác sửa công thức riêng tư → 404 (không lộ sự tồn tại)', bEdit.data);

  const share = await request(`/api/recipes/${recipeAId}`, 'PATCH', { isPublic: true }, tokenA);
  const bGetPublic = await request(`/api/recipes/${recipeAId}`, 'GET', null, tokenB);
  const bEditPublic = await request(`/api/recipes/${recipeAId}`, 'PUT', { title: 'B sửa' }, tokenB);
  assert(share.status === 200 && bGetPublic.status === 200 && bGetPublic.data.recipe.canEdit === false && bEditPublic.status === 403, 'Chủ chia sẻ công khai → người khác xem được nhưng không sửa được', bEditPublic.data);

  const userSystem = await request('/api/recipes', 'POST', { title: 'Lén thêm vào kho', system: true }, tokenA);
  assert(userSystem.status === 403, 'User thường không tạo được công thức kho chung', userSystem.data);

  const adminRecipe = await request('/api/recipes', 'POST', { title: 'Món Admin Thêm', category: 'mon chinh', system: true, ingredients: [{ name: 'Muối' }] }, tokenAdmin);
  assert(adminRecipe.status === 201 && adminRecipe.data.recipe.type === 'admin' && adminRecipe.data.recipe.isPublic === true && adminRecipe.data.recipe.category === 'Món chính 🍲',
    'Admin thêm vào kho (system: true) → type "admin", công khai; danh mục khớp không dấu', adminRecipe.data.recipe && { type: adminRecipe.data.recipe.type, category: adminRecipe.data.recipe.category });

  const systemList = await request('/api/recipes?type=system');
  assert(systemList.data.total === 6 && systemList.data.recipes.every(x => x.type === 'system' && x.legacyId), '6 công thức mẫu của app được seed với type "system" + legacyId', systemList.data.total);

  const search = await request('/api/recipes?search=trung ngam');
  const searchIngredient = await request('/api/recipes?search=CA ROT', 'GET', null, tokenA);
  assert(search.data.recipes.some(x => x.title === 'Trứng Ngâm Tương Lòng Đào') && searchIngredient.data.recipes.some(x => x.id === recipeAId), 'Tìm kiếm không dấu theo tên và nguyên liệu', { a: search.data.total, b: searchIngredient.data.total });

  const byCategory = await request('/api/recipes?category=mon nhanh'); // helper encodes the URL
  assert(byCategory.data.recipes.length > 0 && byCategory.data.recipes.every(x => x.category === 'Món nhanh ⚡'), 'Lọc danh mục theo tên không dấu', byCategory.data.total);

  const adminSeesPrivate = await request('/api/recipes?type=personal&limit=100', 'GET', null, tokenAdmin);
  assert(adminSeesPrivate.data.recipes.some(x => x.id === recipeAId), 'Admin thấy mọi công thức', adminSeesPrivate.data.total);

  // Delete category -> its recipes move to the default category
  const delCat = await request(`/api/categories/${catId}`, 'DELETE', null, tokenAdmin);
  const afterDel = await request(`/api/recipes/${recipeAId}`, 'GET', null, tokenA);
  assert(delCat.status === 200 && delCat.data.movedRecipes === 1 && afterDel.data.recipe.category === 'Món chính 🍲', 'Xóa danh mục → công thức chuyển sang "Món chính 🍲"', delCat.data);

  // =========================================================================
  section('5. Yêu thích');
  // =========================================================================
  const sampleId = systemList.data.recipes[0].id;
  const favOn = await request(`/api/favorites/${sampleId}/toggle`, 'POST', null, tokenA);
  const favs = await request('/api/favorites', 'GET', null, tokenA);
  const favOff = await request(`/api/favorites/${sampleId}/toggle`, 'POST', null, tokenA);
  assert(favOn.data.isFavorite === true && favs.data.favoriteIds.includes(sampleId) && favOff.data.isFavorite === false, 'Thả / bỏ tim', favs.data.favoriteIds);

  const privateOfA = await request('/api/recipes', 'POST', { title: 'Bí mật của A' }, tokenA);
  const favPrivate = await request(`/api/favorites/${privateOfA.data.recipe.id}/toggle`, 'POST', null, tokenB);
  assert(favPrivate.status === 404, 'Không thả tim được công thức riêng tư của người khác', favPrivate.data);

  // =========================================================================
  section('6. Danh sách mua sắm');
  // =========================================================================
  const custom = await request('/api/shopping', 'POST', { name: 'Nấm đùi gà', amount: '200', unit: 'g' }, tokenA);
  assert(custom.status === 201 && custom.data.item.recipeTitle === 'Mua tự do', 'Thêm món mua tự do', custom.data);

  const bulk = await request('/api/shopping/bulk', 'POST', {
    recipeTitle: 'Canh Gà',
    ingredients: [
      { name: 'nam dui ga', amount: '0,5', unit: 'kg' },
      { name: 'Muối', amount: 'Vừa đủ', unit: '' },
      { name: 'muoi', amount: 'vừa đủ', unit: '' },
      { name: 'Cà rốt', amount: '2', unit: 'củ' }
    ]
  }, tokenA);
  const mushroom = bulk.data.items?.find(i => i.name === 'Nấm đùi gà');
  assert(bulk.status === 201 && bulk.data.added === 2 && bulk.data.merged === 2, 'Gộp dòng trùng tên (bỏ dấu) thay vì nhân bản', bulk.data);
  assert(mushroom?.amount === '700' && mushroom?.unit === 'g' && mushroom?.recipeTitle === 'Mua tự do, Canh Gà', '200 g + 0,5 kg = 700 g, ghi nguồn "Mua tự do, Canh Gà"', mushroom);

  const carrot = bulk.data.items.find(i => i.name === 'Cà rốt');
  const edit = await request(`/api/shopping/${carrot.id}`, 'PATCH', { name: 'Cà rốt Đà Lạt', amount: '', unit: 'cu' }, tokenA);
  assert(edit.status === 200 && edit.data.item.name === 'Cà rốt Đà Lạt' && edit.data.item.amount === 'Vừa đủ' && edit.data.item.unit === 'củ', 'PATCH sửa tên / số lượng / đơn vị', edit.data.item);

  const buy = await request(`/api/shopping/${carrot.id}`, 'PATCH', { checked: true }, tokenA);
  assert(buy.data.item.checked === true && buy.data.item.stockedToPantry === true && buy.data.pantry?.includes('Cà rốt Đà Lạt'), 'Đánh dấu đã mua → tự thêm vào kho nguyên liệu (autoStockPantry)', buy.data);
  const unbuy = await request(`/api/shopping/${carrot.id}/toggle`, 'PATCH', null, tokenA);
  assert(unbuy.data.item.checked === false && unbuy.data.item.stockedToPantry === false && !unbuy.data.pantry.includes('Cà rốt Đà Lạt'), 'Bỏ đánh dấu nhầm → lấy lại khỏi kho', unbuy.data);

  const del = await request(`/api/shopping/${custom.data.item.id}`, 'DELETE', null, tokenA);
  const restore = await request('/api/shopping/restore', 'POST', del.data.item, tokenA);
  assert(del.status === 200 && restore.status === 201 && restore.data.item.amount === '700' && restore.data.item.recipeTitle === 'Mua tự do, Canh Gà', 'Xóa trả về dòng đã xóa → hoàn tác (restore) giữ nguyên dữ liệu', restore.data);

  await request(`/api/shopping/${restore.data.item.id}/toggle`, 'PATCH', null, tokenA);
  const clearChecked = await request('/api/shopping/clear-checked', 'DELETE', null, tokenA);
  assert(clearChecked.data.deletedCount === 1, 'Xóa các món đã mua', clearChecked.data);

  // =========================================================================
  section('7. Kho nguyên liệu (so khớp bỏ dấu)');
  // =========================================================================
  const add = await request('/api/pantry', 'POST', { names: ['Hành lá', 'hanh la', 'Trứng gà ta', '  '] }, tokenA);
  assert(add.status === 201 && add.data.added.length === 2 && add.data.ingredients.includes('Trứng gà ta'), 'Thêm nhiều nguyên liệu, "hanh la" trùng "Hành lá" bị bỏ qua', add.data);
  const addAgain = await request('/api/pantry', 'POST', { ingredientName: 'HÀNH LÁ' }, tokenA);
  assert(addAgain.status === 200 && addAgain.data.added.length === 0, 'Thêm lại không bao giờ bật/tắt (khác toggle)', addAgain.data);
  const toggle = await request('/api/pantry/toggle', 'POST', { ingredientName: 'trung ga ta' }, tokenA);
  assert(toggle.data.action === 'removed' && !toggle.data.ingredients.includes('Trứng gà ta'), 'Toggle so khớp không dấu', toggle.data);
  const remove = await request('/api/pantry/remove', 'POST', { names: ['hanh la'] }, tokenA);
  assert(remove.data.removedCount === 1, 'Xóa nhiều nguyên liệu cùng lúc', remove.data);
  await request('/api/pantry', 'POST', { names: ['Trứng gà ta', 'Nước tương'] }, tokenA);
  const suggest = await request('/api/pantry/suggest-recipes', 'GET', null, tokenA);
  assert(suggest.status === 200 && Array.isArray(suggest.data.readyToCook), 'Gợi ý món theo kho (giữ lại endpoint cũ)', suggest.data.missingFew?.length);
  const clearPantry = await request('/api/pantry', 'DELETE', null, tokenA);
  assert(clearPantry.data.ingredients.length === 0, 'Dọn sạch kho', clearPantry.data);

  // =========================================================================
  section('8. Cài đặt cá nhân');
  // =========================================================================
  const settings = await request('/api/users/me/settings', 'PUT', { calorieGoal: 10000, allergies: ['egg', 'khong-co'], vibration: false, hasSeenOnboarding: true, unknown: 1 }, tokenA);
  assert(settings.status === 200 && settings.data.settings.calorieGoal === 6000 && JSON.stringify(settings.data.settings.allergies) === '["egg"]' && settings.data.settings.vibration === false && settings.data.hasSeenOnboarding === true,
    'Lưu cài đặt: mục tiêu kcal bị kẹp 800–6000, dị ứng lọc theo danh sách app', settings.data);

  // =========================================================================
  section('9. Lịch sử nấu');
  // =========================================================================
  const hist = await request('/api/history', 'POST', { recipeId: sampleId, servings: 3, startedAt: Date.now() - 600000, rating: 5, note: 'Ngon' }, tokenA);
  const hist2 = await request('/api/history', 'POST', { recipeId: sampleId, rating: 4 }, tokenA);
  const histList = await request(`/api/history?recipeId=${sampleId}`, 'GET', null, tokenA);
  assert(hist.status === 201 && typeof hist.data.entry.finishedAt === 'number' && histList.data.stats.count === 2 && histList.data.stats.avgRating === 4.5, 'Ghi lịch sử nấu (thời gian epoch ms) + thống kê', histList.data.stats);
  const histPrivate = await request('/api/history', 'POST', { recipeId: privateOfA.data.recipe.id }, tokenB);
  const histDel = await request(`/api/history/${hist2.data.entry.id}`, 'DELETE', null, tokenA);
  assert(histPrivate.status === 404 && histDel.status === 200, 'Không ghi lịch sử cho công thức không xem được; xóa mục lịch sử', histPrivate.data);

  // =========================================================================
  section('10. Kế hoạch bữa ăn');
  // =========================================================================
  const meal = await request('/api/meal-plans', 'POST', { date: '2030-01-06', slot: 'dinner', recipeId: sampleId, servings: 8, today: '2030-01-05' }, tokenA);
  const freeMeal = await request('/api/meal-plans', 'POST', { date: '2030-01-04', title: 'Phở ngoài hàng', calories: 450, today: '2030-01-05' }, tokenA);
  const noTitle = await request('/api/meal-plans', 'POST', { date: '2030-01-04' }, tokenA);
  const badDate = await request('/api/meal-plans', 'POST', { date: '06/01/2030', title: 'x' }, tokenA);
  assert(meal.status === 201 && meal.data.entry.eaten === false && meal.data.entry.title === systemList.data.recipes[0].title && freeMeal.data.entry.eaten === true && freeMeal.data.entry.slot === 'lunch',
    'Lên kế hoạch (tương lai) / ghi nhật ký (quá khứ → eaten), món tự do', { meal: meal.data.entry, freeMeal: freeMeal.data.entry });
  assert(noTitle.status === 400 && badDate.status === 400, 'Bắt buộc tên món hoặc công thức; ngày dạng YYYY-MM-DD', { noTitle: noTitle.data.message, badDate: badDate.data.message });

  const eat = await request(`/api/meal-plans/${freeMeal.data.entry.id}`, 'PATCH', { eaten: false, note: 'Ăn sáng muộn' }, tokenA);
  assert(eat.status === 200 && eat.data.entry.eaten === false && eat.data.entry.note === 'Ăn sáng muộn', 'Sửa món / đánh dấu đã ăn', eat.data.entry);

  const copy = await request('/api/meal-plans/copy-day', 'POST', { fromDate: '2030-01-06', toDate: '2030-01-07', today: '2030-01-05' }, tokenA);
  assert(copy.status === 201 && copy.data.copied === 1 && copy.data.entries[0].date === '2030-01-07', 'Sao chép thực đơn sang ngày khác', copy.data);

  const toShop = await request('/api/meal-plans/to-shopping', 'POST', { from: '2030-01-06', to: '2030-01-07' }, tokenA);
  assert(toShop.status === 201 && toShop.data.dishes === 2 && toShop.data.added > 0 && toShop.data.merged > 0, 'Đưa nguyên liệu kế hoạch vào giỏ (nhân theo khẩu phần, gộp dòng)', { dishes: toShop.data.dishes, added: toShop.data.added, merged: toShop.data.merged });

  const range = await request('/api/meal-plans?from=2030-01-04&to=2030-01-06', 'GET', null, tokenA);
  assert(range.data.count === 2 && range.data.entries[0].date === '2030-01-04', 'Lấy kế hoạch theo khoảng ngày (đã sắp xếp)', range.data.entries.map(e => e.date));
  const delMeal = await request(`/api/meal-plans/${meal.data.entry.id}`, 'DELETE', null, tokenA);
  assert(delMeal.status === 200 && delMeal.data.entry.id === meal.data.entry.id, 'Xóa món khỏi kế hoạch (trả lại để hoàn tác)', delMeal.data);

  // =========================================================================
  section('11. Yêu cầu & báo cáo công thức');
  // =========================================================================
  const reqNew = await request('/api/requests', 'POST', { type: 'new_recipe', title: 'Bún bò Huế', details: 'Mong có công thức bún bò chuẩn vị Huế' }, tokenA);
  const reqDup = await request('/api/requests', 'POST', { type: 'new_recipe', title: 'bún bò huế', details: 'Mong có công thức bún bò chuẩn vị Huế' }, tokenA);
  const reqNoRecipe = await request('/api/requests', 'POST', { type: 'wrong_info', details: 'Định lượng muối quá nhiều' }, tokenA);
  const reqShort = await request('/api/requests', 'POST', { type: 'new_recipe', title: 'Cơm tấm', details: 'ngắn' }, tokenA);
  const report = await request('/api/requests', 'POST', { type: 'wrong_info', recipeId: sampleId, details: 'Định lượng muối quá nhiều' }, tokenA);
  assert(reqNew.status === 201 && reqNew.data.request.status === 'pending' && reqNew.data.request.userEmail === emailA, 'Gửi yêu cầu món mới', reqNew.data);
  assert(reqDup.status === 400 && reqNoRecipe.status === 400 && reqShort.status === 400, 'Chặn yêu cầu trùng, báo cáo thiếu công thức, mô tả < 10 ký tự', { reqDup: reqDup.data.message, reqNoRecipe: reqNoRecipe.data.message, reqShort: reqShort.data.message });
  assert(report.status === 201 && report.data.request.title.startsWith('Sai thông tin: ') && report.data.request.recipeId === sampleId, 'Báo cáo công thức (tiêu đề tự sinh)', report.data.request);

  const mine = await request('/api/requests/mine', 'GET', null, tokenA);
  const userAll = await request('/api/requests', 'GET', null, tokenA);
  const adminAll = await request('/api/requests', 'GET', null, tokenAdmin);
  assert(mine.data.count === 2 && userAll.status === 403 && adminAll.data.counts.pending >= 2, 'User xem yêu cầu của mình; admin xem tất cả + đếm theo trạng thái', adminAll.data.counts);
  const userPatch = await request(`/api/requests/${reqNew.data.request.id}`, 'PATCH', { status: 'resolved' }, tokenA);
  const adminPatch = await request(`/api/requests/${reqNew.data.request.id}`, 'PATCH', { status: 'resolved', adminReply: 'Đã thêm công thức' }, tokenAdmin);
  assert(userPatch.status === 403 && adminPatch.data.request.status === 'resolved' && adminPatch.data.request.adminReply === 'Đã thêm công thức', 'Chỉ admin duyệt / trả lời yêu cầu', adminPatch.data);
  const bDelete = await request(`/api/requests/${report.data.request.id}`, 'DELETE', null, tokenB);
  const aDelete = await request(`/api/requests/${report.data.request.id}`, 'DELETE', null, tokenA);
  assert(bDelete.status === 404 && aDelete.status === 200, 'Chỉ người gửi (hoặc admin) xóa được yêu cầu', bDelete.data);

  // =========================================================================
  section('12. Thống kê admin');
  // =========================================================================
  const stats = await request('/api/admin/stats', 'GET', null, tokenAdmin);
  const statsUser = await request('/api/admin/stats', 'GET', null, tokenA);
  assert(stats.status === 200 && stats.data.stats.recipes.system === 6 && stats.data.stats.recipes.admin === 1 && statsUser.status === 403, 'Thống kê tổng quan cho admin', stats.data.stats);

  // =========================================================================
  section('13. Sao lưu / khôi phục / xóa dữ liệu cá nhân');
  // =========================================================================
  await request(`/api/favorites/${sampleId}/toggle`, 'POST', null, tokenA);
  const backup = await request('/api/users/me/data', 'GET', null, tokenA);
  const b = backup.data.backup;
  assert(backup.status === 200 && b.format === 'cookflow-backup' && b.data.recipes.length === 2 && b.data.favoriteIds.includes(sampleId) && b.data.mealPlan.length === 2,
    'Xuất dữ liệu theo đúng định dạng sao lưu của app', b && { recipes: b.data.recipes.length, meals: b.data.mealPlan.length });

  const resetData = await request('/api/users/me/data', 'DELETE', null, tokenA);
  const afterReset = await request('/api/recipes?mine=true', 'GET', null, tokenA);
  const settingsAfterReset = await request('/api/users/me/settings', 'GET', null, tokenA);
  assert(resetData.status === 200 && afterReset.data.total === 0 && settingsAfterReset.data.settings.calorieGoal === 2000 && settingsAfterReset.data.hasSeenOnboarding === true, 'Xóa toàn bộ dữ liệu cá nhân (onboarding vẫn giữ)', afterReset.data.total);

  // A backup made by the offline app: built-in recipe ids are "rec_01"... and recipe ids are local
  const appBackup = {
    format: 'cookflow-backup',
    version: 1,
    data: {
      recipes: [{ id: 'custom_abc', title: 'Món từ app cũ', category: 'Ăn kiêng 🥗', ingredients: [{ id: 'i1', name: 'Rau' }], steps: [{ id: 's1', instruction: 'Trộn' }], isCustom: true }],
      favoriteIds: ['rec_01', 'custom_abc', 'khong_ton_tai'],
      shoppingList: [{ id: 'shop_1', name: 'Sữa', amount: '1', unit: 'hộp', recipeTitle: 'Mua tự do', checked: false }],
      pantry: ['Muối'],
      settings: { calorieGoal: 1800, allergies: ['soy'] },
      history: [{ id: 'cook_1', recipeId: 'custom_abc', recipeTitle: 'Món từ app cũ', servings: 2, finishedAt: Date.now() - 86400000, rating: 4 }],
      mealPlan: [{ id: 'meal_1', date: '2030-02-01', slot: 'breakfast', recipeId: 'rec_01', title: 'Trứng', servings: 2, eaten: false }]
    }
  };
  const imported = await request('/api/users/me/data/import', 'POST', appBackup, tokenA);
  const favAfter = await request('/api/favorites', 'GET', null, tokenA);
  assert(imported.status === 200 && imported.data.summary.recipes === 1 && imported.data.summary.favorites === 2 && imported.data.summary.history === 1 && imported.data.summary.meals === 1,
    'Nhập bản sao lưu của app offline (id cục bộ được ánh xạ, "rec_01" khớp công thức mẫu)', imported.data);
  assert(favAfter.data.recipes.some(x => x.legacyId === 'rec_01') && favAfter.data.recipes.some(x => x.title === 'Món từ app cũ'), 'Yêu thích trỏ đúng công thức sau khi nhập', favAfter.data.favoriteIds);

  // =========================================================================
  section('14. Upload ảnh / video');
  // =========================================================================
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const imgForm = new FormData();
  imgForm.append('image', new Blob([png], { type: 'image/png' }), 'pixel.png');
  const img = await request('/api/upload/image', 'POST', imgForm, tokenA);
  assert(img.status === 201 && /\/uploads\/img-/.test(img.data.imageUrl), 'Upload ảnh', img.data);

  const badVideo = new FormData();
  badVideo.append('video', new Blob([png], { type: 'image/png' }), 'pixel.png');
  const vidBad = await request('/api/upload/video', 'POST', badVideo, tokenA);
  const vidForm = new FormData();
  vidForm.append('video', new Blob([Buffer.alloc(64)], { type: 'video/mp4' }), 'clip.mp4');
  const vid = await request('/api/upload/video', 'POST', vidForm, tokenA);
  assert(vidBad.status === 400 && vid.status === 201 && /\/uploads\/vid-.*\.mp4$/.test(vid.data.videoUrl), 'Upload video (chặn tệp không phải video)', { vidBad: vidBad.data, vid: vid.data });

  // Clean up uploaded test files
  const fs = require('fs');
  const path = require('path');
  [img.data.fileName, vid.data.fileName].filter(Boolean).forEach(name => {
    fs.rmSync(path.join(__dirname, '../public/uploads', name), { force: true });
  });

  // =========================================================================
  section('15. Đường dẫn không tồn tại');
  // =========================================================================
  const notFound = await request('/api/khong-co');
  assert(notFound.status === 404 && notFound.data.success === false && notFound.data.message, '404 cùng định dạng lỗi', notFound.data);

  return userAId;
}

(async () => {
  console.log('====================================================');
  console.log('🧪 KIỂM THỬ E2E TOÀN BỘ API COOKFLOW (MongoDB in-memory)');
  console.log('====================================================');
  let server;
  try {
    server = await startTestServer();
    await run(makeRequest(server.baseUrl));
  } catch (err) {
    console.error('Lỗi ngoại lệ trong quá trình test:', err);
    failed++;
  } finally {
    if (server) await server.stop();
  }
  console.log('\n====================================================');
  console.log(`🎉 KẾT QUẢ: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');
  process.exit(failed > 0 ? 1 : 0);
})();
