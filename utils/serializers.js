// Shapes every resource the way the mobile app reads it:
// - every document has a string `id` (and `_id` for older clients)
// - recipe `category` is the category NAME (the app filters by name); the object is in `categoryObj`
// - ingredients / steps carry their own stable `id`
// - personal data (history, meal plan, requests) uses epoch milliseconds for times, like the app's local storage did
const idOf = value => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
};
const ms = value => (value ? new Date(value).getTime() : null);
const plain = doc => (doc && typeof doc.toObject === 'function' ? doc.toObject({ virtuals: false }) : { ...doc });

const formatUser = user => {
  if (!user) return null;
  const obj = plain(user);
  return {
    id: idOf(obj._id),
    _id: idOf(obj._id),
    username: obj.username,
    email: obj.email,
    fullName: obj.fullName,
    name: obj.fullName, // the app calls it "name"
    avatar: obj.avatar,
    role: obj.role,
    verified: obj.verified !== false,
    locked: !!obj.locked,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

const formatSettings = user => {
  const s = plain(user).settings || {};
  return {
    keepAwake: s.keepAwake !== false,
    timerSound: s.timerSound !== false,
    vibration: s.vibration !== false,
    timerNotifications: s.timerNotifications !== false,
    assumeStaples: s.assumeStaples !== false,
    autoStockPantry: s.autoStockPantry !== false,
    allergies: Array.isArray(s.allergies) ? s.allergies : [],
    hideAllergenRecipes: s.hideAllergenRecipes !== false,
    calorieGoal: s.calorieGoal ?? 2000
  };
};

const formatAuthor = author => {
  if (!author) return null;
  if (typeof author === 'object' && author.fullName !== undefined) {
    return { id: idOf(author._id), _id: idOf(author._id), fullName: author.fullName, username: author.username, avatar: author.avatar, role: author.role };
  }
  return idOf(author);
};

/**
 * @param recipe  mongoose doc or plain object (category/author populated or not)
 * @param viewer  req.user (optional) - adds isOwner / canEdit flags for the app
 */
const formatRecipe = (recipe, viewer = null) => {
  const obj = plain(recipe);
  const catObj = obj.category && typeof obj.category === 'object' && obj.category.name !== undefined ? obj.category : null;
  const categoryName = catObj ? catObj.name : 'Món chính 🍲';
  const recipeId = idOf(obj._id) || obj.id;
  const ownerId = idOf(obj.author);
  const viewerId = viewer?._id ? viewer._id.toString() : null;
  const isAdmin = viewer?.role === 'admin';
  const type = obj.type || (obj.isCustom ? 'personal' : 'system');
  const isOwner = !!viewerId && viewerId === ownerId;

  const { searchText, __v, ...rest } = obj;
  return {
    ...rest,
    id: recipeId,
    _id: recipeId,
    category: categoryName,
    categoryId: catObj ? idOf(catObj._id) : idOf(obj.category),
    categoryObj: catObj ? { id: idOf(catObj._id), _id: idOf(catObj._id), name: catObj.name, slug: catObj.slug, icon: catObj.icon } : null,
    categoryName,
    author: formatAuthor(obj.author),
    ownerId,
    authorName: obj.author && typeof obj.author === 'object' ? obj.author.fullName ?? null : null,
    type,
    isCustom: type === 'personal',
    isPublic: obj.isPublic !== false,
    isOwner,
    canEdit: isAdmin || (isOwner && type === 'personal'),
    calories: obj.calories ?? null,
    nutrition: {
      protein: obj.nutrition?.protein ?? null,
      carbs: obj.nutrition?.carbs ?? null,
      fat: obj.nutrition?.fat ?? null
    },
    tags: obj.tags || [],
    aiChanges: obj.aiChanges || [],
    ingredients: (obj.ingredients || []).map(ing => ({
      id: idOf(ing._id),
      _id: idOf(ing._id),
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      group: ing.group
    })),
    steps: (obj.steps || []).map((step, idx) => ({
      id: idOf(step._id),
      _id: idOf(step._id),
      stepNumber: idx + 1,
      title: step.title,
      instruction: step.instruction,
      image: step.image || '',
      videoUrl: step.videoUrl || '',
      timerSeconds: step.timerSeconds ?? null,
      tip: step.tip || ''
    }))
  };
};

const formatShoppingItem = item => {
  const obj = plain(item);
  return {
    id: idOf(obj._id),
    _id: idOf(obj._id),
    name: obj.name,
    amount: obj.amount,
    unit: obj.unit,
    recipeTitle: obj.recipeTitle,
    checked: !!obj.checked,
    stockedToPantry: !!obj.stockedToPantry,
    createdAt: obj.createdAt
  };
};

const formatHistory = entry => {
  const obj = plain(entry);
  return {
    id: idOf(obj._id),
    recipeId: idOf(obj.recipe),
    recipeTitle: obj.recipeTitle,
    servings: obj.servings,
    startedAt: ms(obj.startedAt),
    finishedAt: ms(obj.finishedAt),
    rating: obj.rating ?? null,
    note: obj.note || ''
  };
};

const formatMealEntry = entry => {
  const obj = plain(entry);
  return {
    id: idOf(obj._id),
    date: obj.date,
    slot: obj.slot,
    recipeId: idOf(obj.recipe),
    title: obj.title,
    calories: obj.calories ?? null,
    servings: obj.servings,
    eaten: !!obj.eaten,
    note: obj.note || '',
    createdAt: ms(obj.createdAt)
  };
};

const formatRequest = request => {
  const obj = plain(request);
  return {
    id: idOf(obj._id),
    type: obj.type,
    title: obj.title,
    details: obj.details,
    recipeId: idOf(obj.recipe),
    recipeTitle: obj.recipeTitle || '',
    userId: idOf(obj.user),
    userEmail: obj.userEmail,
    userName: obj.userName,
    status: obj.status,
    adminReply: obj.adminReply || '',
    createdAt: ms(obj.createdAt),
    updatedAt: ms(obj.updatedAt)
  };
};

const formatCategory = (category, recipeCount) => {
  const obj = plain(category);
  return {
    id: idOf(obj._id),
    _id: idOf(obj._id),
    name: obj.name,
    slug: obj.slug,
    icon: obj.icon,
    order: obj.order,
    ...(recipeCount !== undefined ? { recipeCount } : {}),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

module.exports = {
  idOf,
  formatUser,
  formatSettings,
  formatRecipe,
  formatShoppingItem,
  formatHistory,
  formatMealEntry,
  formatRequest,
  formatCategory
};
