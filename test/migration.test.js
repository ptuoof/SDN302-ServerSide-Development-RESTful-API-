// Checks that a database created by the previous API version is upgraded at startup.
//   npm run test:migration
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

(async () => {
  const mongod = await MongoMemoryServer.create();
  let failed = 0;
  const assert = (ok, msg, detail) => {
    console.log(`  ${ok ? '✅ [PASS]' : '❌ [FAIL]'} ${msg}`);
    if (!ok) {
      failed++;
      if (detail !== undefined) console.error('         ', JSON.stringify(detail));
    }
  };
  try {
    await mongoose.connect(mongod.getUri('cookflow_migration'));
    const db = mongoose.connection.db;
    const userId = new mongoose.Types.ObjectId();
    const categoryId = new mongoose.Types.ObjectId();

    // --- v1 data, written raw (as the old API stored it) ---
    await db.collection('recipes').insertMany([
      { title: 'Món Cũ Của User', description: 'x', imageUrl: 'http://img', category: categoryId, author: userId, isCustom: true, isPublic: true, calories: 250, ingredients: [{ name: 'Cà rốt', amount: '1', unit: 'củ' }], steps: [] },
      { title: 'Món Mẫu Cũ', description: 'y', imageUrl: 'http://img', category: categoryId, author: userId, isCustom: false, isPublic: true, ingredients: [], steps: [] }
    ]);
    await db.collection('pantryitems').createIndex({ user: 1, ingredientName: 1 }, { unique: true });
    await db.collection('pantryitems').insertMany([
      { user: userId, ingredientName: 'Hành lá' },
      { user: userId, ingredientName: 'hanh la' },
      { user: userId, ingredientName: 'Trứng' }
    ]);

    const { runMigrations } = require('../utils/migrations');
    await runMigrations();
    await runMigrations(); // idempotent

    const recipes = await db.collection('recipes').find().sort({ title: -1 }).toArray();
    const personal = recipes.find(r => r.title === 'Món Cũ Của User');
    const system = recipes.find(r => r.title === 'Món Mẫu Cũ');
    assert(personal.type === 'personal' && personal.isPublic === false, 'Công thức người dùng cũ → personal, riêng tư', personal);
    assert(system.type === 'system' && system.isPublic === true, 'Công thức mẫu cũ → system, công khai', system);
    assert(personal.searchText.includes('ca rot'), 'Tạo chỉ mục tìm kiếm không dấu', personal.searchText);

    const pantry = await db.collection('pantryitems').find().toArray();
    const indexes = (await db.collection('pantryitems').indexes()).map(i => Object.keys(i.key).join('+'));
    assert(pantry.length === 2 && pantry.every(p => p.normalizedName), 'Kho: điền normalizedName, bỏ dòng trùng do dấu', pantry);
    assert(indexes.includes('user+normalizedName') && !indexes.includes('user+ingredientName'), 'Kho: index unique mới thay index cũ', indexes);
  } catch (err) {
    console.error(err);
    failed++;
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
  console.log(failed ? `\n❌ ${failed} FAILED` : '\n🎉 Migration OK');
  process.exit(failed ? 1 : 0);
})();
