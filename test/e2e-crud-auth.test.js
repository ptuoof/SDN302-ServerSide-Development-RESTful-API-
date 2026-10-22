const http = require('http');

const PORT = 9999;

function request(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: encodeURI(path),
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runComprehensiveTests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN CRUD & PHÂN QUYỀN RBAC');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: AUTHENTICATION & VALIDATION
    // ----------------------------------------------------
    console.log('📌 1. Kiểm thử Đăng ký & Đăng nhập & Validation:');

    // 1.1 Validation error on register (short password)
    const badReg = await request('/api/auth/register', 'POST', {
      username: 'test_short',
      email: 'short@test.com',
      password: '123',
      fullName: 'Test Short'
    });
    assert(badReg.status === 400, 'Từ chối đăng ký mật khẩu ngắn (< 6 ký tự) - Status 400');

    // 1.2 Successful Register User A
    const userAEmail = `user_a_${Date.now()}@test.com`;
    const userAUsername = `user_a_${Date.now()}`;
    const regUserA = await request('/api/auth/register', 'POST', {
      username: userAUsername,
      email: userAEmail,
      password: 'password123',
      fullName: 'Người Dùng A'
    });
    assert(regUserA.status === 201 && regUserA.data.token, 'Đăng ký User A thành công với JWT token - Status 201');
    const tokenA = regUserA.data.token;
    const userAId = regUserA.data.user.id;

    // 1.3 Duplicate email registration
    const dupReg = await request('/api/auth/register', 'POST', {
      username: `other_${Date.now()}`,
      email: userAEmail,
      password: 'password123',
      fullName: 'Trùng Email'
    });
    assert(dupReg.status === 409 || dupReg.status === 400, 'Ngăn chặn đăng ký trùng Email - Status 409/400');

    // 1.4 Successful Register User B
    const userBEmail = `user_b_${Date.now()}@test.com`;
    const userBUsername = `user_b_${Date.now()}`;
    const regUserB = await request('/api/auth/register', 'POST', {
      username: userBUsername,
      email: userBEmail,
      password: 'password123',
      fullName: 'Người Dùng B'
    });
    assert(regUserB.status === 201, 'Đăng ký User B thành công - Status 201');
    const tokenB = regUserB.data.token;

    // 1.5 Login Admin
    const adminLogin = await request('/api/auth/login', 'POST', {
      usernameOrEmail: 'admin@cookflow.com',
      password: '123456'
    });
    assert(adminLogin.status === 200 && adminLogin.data.user.role === 'admin', 'Đăng nhập tài khoản Admin thành công - Status 200');
    const tokenAdmin = adminLogin.data.token;

    // 1.6 Login with wrong password
    const wrongLogin = await request('/api/auth/login', 'POST', {
      usernameOrEmail: 'admin@cookflow.com',
      password: 'wrong_password'
    });
    assert(wrongLogin.status === 401, 'Từ chối đăng nhập sai mật khẩu - Status 401');

    // 1.7 Get current profile (Me)
    const getMe = await request('/api/auth/me', 'GET', null, tokenA);
    assert(getMe.status === 200 && getMe.data.user.email === userAEmail, 'Lấy thông tin tài khoản hiện tại qua JWT Bearer - Status 200');

    // ----------------------------------------------------
    // TEST SUITE 2: RBAC (ROLE-BASED ACCESS CONTROL)
    // ----------------------------------------------------
    console.log('\n📌 2. Kiểm thử Phân quyền (RBAC - Admin vs User):');

    // 2.1 Regular User attempts to create Category -> Should be 403 Forbidden!
    const userCreateCat = await request('/api/categories', 'POST', {
      name: `Hack Cat ${Date.now()}`,
      slug: `hack-cat-${Date.now()}`
    }, tokenA);
    assert(userCreateCat.status === 403, 'Chặn User thường tạo Danh mục (Cần quyền Admin) - Status 403 Forbidden');

    // 2.2 Admin creates Category -> 201 Created!
    const testCatSlug = `mon-test-${Date.now()}`;
    const adminCreateCat = await request('/api/categories', 'POST', {
      name: `Món Kiểm Thử ${Date.now()}`,
      slug: testCatSlug,
      icon: '🧪',
      order: 99
    }, tokenAdmin);
    assert(adminCreateCat.status === 201 && adminCreateCat.data.category._id, 'Admin tạo Danh mục thành công - Status 201');
    const newCatId = adminCreateCat.data.category._id;

    // 2.3 Admin updates Category
    const adminUpdateCat = await request(`/api/categories/${newCatId}`, 'PUT', {
      name: `Món Đã Cập Nhật ${Date.now()}`
    }, tokenAdmin);
    assert(adminUpdateCat.status === 200, 'Admin cập nhật Danh mục thành công - Status 200');

    // 2.4 User attempts to delete Category -> Should be 403 Forbidden!
    const userDeleteCat = await request(`/api/categories/${newCatId}`, 'DELETE', null, tokenA);
    assert(userDeleteCat.status === 403, 'Chặn User thường xóa Danh mục - Status 403 Forbidden');

    // 2.5 Admin deletes Category
    const adminDeleteCat = await request(`/api/categories/${newCatId}`, 'DELETE', null, tokenAdmin);
    assert(adminDeleteCat.status === 200, 'Admin xóa Danh mục thành công - Status 200');

    // ----------------------------------------------------
    // TEST SUITE 3: RECIPES CRUD & OWNERSHIP AUTHORIZATION
    // ----------------------------------------------------
    console.log('\n📌 3. Kiểm thử CRUD Công Thức & Quyền Sở Hữu:');

    // 3.1 Validation error when creating recipe without title
    const badRecipe = await request('/api/recipes', 'POST', {
      description: 'Thiếu tiêu đề',
      imageUrl: 'http://img.png'
    }, tokenA);
    assert(badRecipe.status === 400, 'Validation chặn tạo công thức thiếu dữ liệu bắt buộc - Status 400');

    // 3.2 User A creates Recipe
    const createRecipeRes = await request('/api/recipes', 'POST', {
      title: 'Món Thử Nghiệm Của User A',
      description: 'Công thức đặc biệt do User A nấu',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
      categoryName: 'Món chính 🍲',
      prepTimeMinutes: 15,
      cookTimeMinutes: 20,
      servings: 2,
      calories: 320,
      difficulty: 'Dễ',
      ingredients: [
        { name: 'Thịt gà', amount: '300', unit: 'g' }
      ],
      steps: [
        { stepNumber: 1, title: 'Chuẩn bị', instruction: 'Rửa sạch thịt gà' }
      ]
    }, tokenA);
    assert(createRecipeRes.status === 201 && createRecipeRes.data.recipe.id, 'User A tạo công thức mới thành công - Status 201');
    const recipeAId = createRecipeRes.data.recipe.id;

    // 3.3 User B attempts to edit User A's Recipe -> 403 Forbidden!
    const userBEditA = await request(`/api/recipes/${recipeAId}`, 'PUT', {
      title: 'B muốn hack đổi tên công thức của A'
    }, tokenB);
    assert(userBEditA.status === 403, 'Ngăn chặn User B sửa công thức của User A - Status 403 Forbidden');

    // 3.4 User B attempts to delete User A's Recipe -> 403 Forbidden!
    const userBDeleteA = await request(`/api/recipes/${recipeAId}`, 'DELETE', null, tokenB);
    assert(userBDeleteA.status === 403, 'Ngăn chặn User B xóa công thức của User A - Status 403 Forbidden');

    // 3.5 User A updates own Recipe -> 200 OK!
    const userAUpdate = await request(`/api/recipes/${recipeAId}`, 'PUT', {
      title: 'Món Đã Được User A Cập Nhật Thành Công'
    }, tokenA);
    assert(userAUpdate.status === 200 && userAUpdate.data.recipe.title.includes('Cập Nhật'), 'User A cập nhật công thức của chính mình thành công - Status 200');

    // 3.6 Advanced Query: Filter & Search
    const searchRes = await request(`/api/recipes?search=User A&difficulty=Dễ`);
    assert(searchRes.status === 200 && searchRes.data.recipes.length >= 1, 'Bộ lọc tìm kiếm từ khóa và độ khó hoạt động chuẩn xác - Status 200');

    // 3.7 Admin deletes Recipe (Admin Override) -> 200 OK!
    const adminDeleteRecipe = await request(`/api/recipes/${recipeAId}`, 'DELETE', null, tokenAdmin);
    assert(adminDeleteRecipe.status === 200, 'Admin có quyền xóa công thức vi phạm (Admin Override) - Status 200');

    // ----------------------------------------------------
    // TEST SUITE 4: FAVORITES CRUD
    // ----------------------------------------------------
    console.log('\n📌 4. Kiểm thử Món Ăn Yêu Thích (Favorites):');

    // Get an existing recipe to toggle favorite
    const allRecipes = await request('/api/recipes');
    const sampleRecipeId = allRecipes.data.recipes[0].id;

    // 4.1 Toggle ON
    const favOn = await request(`/api/favorites/${sampleRecipeId}/toggle`, 'POST', null, tokenA);
    assert(favOn.status === 200 && favOn.data.isFavorite === true, 'User A thả tim món ăn thành công - isFavorite: true');

    // 4.2 Get Favorites list
    const getFavs = await request('/api/favorites', 'GET', null, tokenA);
    assert(getFavs.status === 200 && getFavs.data.favoriteIds.includes(sampleRecipeId), 'Danh sách yêu thích của User A chứa ID món vừa thả tim');

    // 4.3 Toggle OFF
    const favOff = await request(`/api/favorites/${sampleRecipeId}/toggle`, 'POST', null, tokenA);
    assert(favOff.status === 200 && favOff.data.isFavorite === false, 'User A bỏ tim món ăn thành công - isFavorite: false');

    // ----------------------------------------------------
    // TEST SUITE 5: SHOPPING LIST CRUD
    // ----------------------------------------------------
    console.log('\n📌 5. Kiểm thử Giỏ Đi Chợ (Shopping List):');

    // 5.1 Add custom shopping item
    const addShop = await request('/api/shopping', 'POST', {
      name: 'Nấm đùi gà tươi',
      amount: '200',
      unit: 'g'
    }, tokenA);
    assert(addShop.status === 201 && addShop.data.item.id, 'Thêm nguyên liệu mua tự do thành công - Status 201');
    const shopItemId = addShop.data.item.id;

    // 5.2 Add bulk ingredients from recipe
    const addBulkShop = await request('/api/shopping/bulk', 'POST', {
      ingredients: [
        { name: 'Cà rốt Đà Lạt', amount: '2', unit: 'củ' },
        { name: 'Khoai tây vàng', amount: '3', unit: 'củ' }
      ],
      recipeTitle: 'Canh Hầm Củ Quả'
    }, tokenA);
    assert(addBulkShop.status === 201 && addBulkShop.data.items.length === 2, 'Thêm hàng loạt nguyên liệu từ công thức vào giỏ thành công - Status 201');

    // 5.3 Toggle item checked
    const toggleShop = await request(`/api/shopping/${shopItemId}/toggle`, 'PATCH', null, tokenA);
    assert(toggleShop.status === 200 && toggleShop.data.item.checked === true, 'Đánh dấu nguyên liệu đã mua (checked: true) - Status 200');

    // 5.4 Clear checked items
    const clearChecked = await request('/api/shopping/clear-checked', 'DELETE', null, tokenA);
    assert(clearChecked.status === 200 && clearChecked.data.deletedCount >= 1, 'Xóa toàn bộ các nguyên liệu đã mua hoàn tất - Status 200');

    // ----------------------------------------------------
    // TEST SUITE 6: PANTRY FINDER CRUD
    // ----------------------------------------------------
    console.log('\n📌 6. Kiểm thử Tủ Lạnh Nhà Tôi (Pantry Finder):');

    // 6.1 Toggle ingredient in pantry
    const togglePantry = await request('/api/pantry/toggle', 'POST', {
      ingredientName: 'Trứng gà ta'
    }, tokenA);
    assert(togglePantry.status === 200 && togglePantry.data.action === 'added', 'Thêm nguyên liệu vào tủ lạnh thành công - Status 200');

    // 6.2 Suggest recipes
    const suggest = await request('/api/pantry/suggest-recipes', 'GET', null, tokenA);
    assert(suggest.status === 200 && Array.isArray(suggest.data.readyToCook), 'Thuật toán gợi ý món ăn theo nguyên liệu tủ lạnh phản hồi chính xác - Status 200');

    // 6.3 Clear pantry
    const clearPantry = await request('/api/pantry', 'DELETE', null, tokenA);
    assert(clearPantry.status === 200 && clearPantry.data.ingredients.length === 0, 'Dọn sạch tủ lạnh thành công - Status 200');

    console.log('\n====================================================');
    console.log(`🎉 KẾT QUẢ: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Lỗi ngoại lệ trong quá trình test:', err);
    process.exit(1);
  }
}

runComprehensiveTests();
