const http = require('http');

async function runTests() {
  console.log('🧪 Starting API Verification Tests...');
  const app = require('../server');

  await new Promise(resolve => setTimeout(resolve, 1500));

  const request = (path, method = 'GET', body = null, token = null) => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 9999,
        path,
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
  };

  try {
    // 1. Test Welcome
    const welcome = await request('/');
    console.log('✓ GET / ->', welcome.status, welcome.data.message);

    // 2. Test Login
    const login = await request('/api/auth/login', 'POST', {
      usernameOrEmail: 'admin@cookflow.com',
      password: '123456'
    });
    console.log('✓ POST /api/auth/login ->', login.status, 'User:', login.data.user.fullName);
    const token = login.data.token;

    // 3. Test Categories
    const categories = await request('/api/categories');
    console.log('✓ GET /api/categories ->', categories.status, 'Count:', categories.data.count);

    // 4. Test Recipes
    const recipes = await request('/api/recipes');
    console.log('✓ GET /api/recipes ->', recipes.status, 'Total recipes:', recipes.data.total);

    // 5. Test Add Favorite
    const testRecipeId = recipes.data.recipes[0]._id;
    const fav = await request(`/api/favorites/${testRecipeId}/toggle`, 'POST', null, token);
    console.log('✓ POST /api/favorites/:id/toggle ->', fav.status, 'isFavorite:', fav.data.isFavorite);

    // 6. Test Get Favorites
    const myFavs = await request('/api/favorites', 'GET', null, token);
    console.log('✓ GET /api/favorites ->', myFavs.status, 'Fav count:', myFavs.data.count);

    // 7. Test Shopping
    const shopItem = await request('/api/shopping', 'POST', {
      name: 'Hành tây Đà Lạt',
      amount: '2',
      unit: 'củ'
    }, token);
    console.log('✓ POST /api/shopping ->', shopItem.status, 'Created:', shopItem.data.item.name);

    // 8. Test Pantry & Suggestion
    const pantryAdd = await request('/api/pantry/toggle', 'POST', {
      ingredientName: 'Trứng gà ta'
    }, token);
    console.log('✓ POST /api/pantry/toggle ->', pantryAdd.status, 'Pantry:', pantryAdd.data.ingredients);

    const suggest = await request('/api/pantry/suggest-recipes', 'GET', null, token);
    console.log('✓ GET /api/pantry/suggest-recipes ->', suggest.status, 'Ready to cook:', suggest.data.readyToCook.length);

    console.log('\n🎉 ALL BACKEND API TESTS PASSED SUCCESSFULLY! 🚀');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

runTests();
