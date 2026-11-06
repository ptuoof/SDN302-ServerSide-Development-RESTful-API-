// Seeds the accounts, categories and built-in recipes the mobile app expects.
//   npm run seed
// Idempotent: existing accounts / categories / recipes (matched by email / slug / title) are kept.
//
// Accounts (same as the demo accounts of the app):
//   admin@cookflow.demo / Admin123!   (role admin)
//   chef@cookflow.demo  / Chef123!    (role user)
require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Category, Recipe } = require('../models');
const { runMigrations } = require('../utils/migrations');
const { buildRecipeFields } = require('../utils/recipeInput');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cookflow_db';

// Same list and order as the app's default categories (src/types/recipe.js)
const CATEGORIES_DATA = [
  { name: 'Món nhanh ⚡', slug: 'mon-nhanh', icon: '⚡', order: 1 },
  { name: 'Món chính 🍲', slug: 'mon-chinh', icon: '🍲', order: 2 },
  { name: 'Ăn kiêng 🥗', slug: 'an-kieng', icon: '🥗', order: 3 },
  { name: 'Tráng miệng 🍰', slug: 'trang-mieng', icon: '🍰', order: 4 },
  { name: 'Thức uống 🍹', slug: 'thuc-uong', icon: '🍹', order: 5 }
];

const USERS_DATA = [
  {
    username: 'admin',
    email: 'admin@cookflow.demo',
    password: 'Admin123!',
    fullName: 'Quản trị viên',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
  },
  {
    username: 'chef',
    email: 'chef@cookflow.demo',
    password: 'Chef123!',
    fullName: 'Đầu bếp CookFlow',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80'
  }
];

// The app's built-in recipes (src/data/mockRecipes.js), exported to JSON
const RECIPES_DATA = require(path.join(__dirname, 'recipes.data.json'));

/** Seeds into the current mongoose connection. */
async function seedDatabase({ quiet = false } = {}) {
  const log = (...args) => !quiet && console.log(...args);

  // 1. Users
  log('[Seed] Seeding Users...');
  const users = {};
  for (const data of USERS_DATA) {
    let user = await User.findOne({ email: data.email });
    if (!user) {
      user = await User.create({ ...data, password: await bcrypt.hash(data.password, 10), verified: true });
      log(`  -> Created ${data.role}: ${data.email} / ${data.password}`);
    } else {
      log(`  -> ${data.email} already exists.`);
    }
    users[data.role] = users[data.role] || user;
  }
  const admin = users.admin;

  // 2. Categories
  log('[Seed] Seeding Categories...');
  const categoryMap = {};
  for (const cat of CATEGORIES_DATA) {
    let existing = await Category.findOne({ $or: [{ slug: cat.slug }, { name: cat.name }] });
    if (!existing) {
      existing = await Category.create(cat);
      log(`  -> Created Category: ${cat.name}`);
    }
    categoryMap[cat.name] = existing._id;
  }

  // 3. Built-in recipes (type "system", public)
  log('[Seed] Seeding Recipes...');
  for (const item of RECIPES_DATA) {
    const categoryId = categoryMap[item.categoryName];
    if (!categoryId) {
      console.warn(`  -> Warning: Category not found for ${item.categoryName}`);
      continue;
    }
    const exists = await Recipe.exists({ $or: [{ legacyId: item.legacyId }, { title: item.title, type: 'system' }] });
    if (exists) {
      log(`  -> Recipe already exists: ${item.title}`);
      continue;
    }
    await Recipe.create({
      ...buildRecipeFields(item),
      legacyId: item.legacyId,
      category: categoryId,
      author: admin._id,
      type: 'system',
      isPublic: true
    });
    log(`  -> Created Recipe: ${item.title}`);
  }

  log('[Seed] Seeding completed successfully! 🌟');
}

async function main() {
  try {
    console.log('[Seed] Connecting to MongoDB:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('[Seed] Connected successfully.');
    await runMigrations();
    await seedDatabase();
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedDatabase, USERS_DATA };
