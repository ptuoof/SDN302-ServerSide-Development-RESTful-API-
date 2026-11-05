// Who may see / change a recipe.
//
//   type      | default isPublic | who can see                     | who can edit / delete
//   ----------|------------------|---------------------------------|----------------------
//   system    | true             | everyone (admin if hidden)      | admin
//   admin     | true             | everyone (admin if hidden)      | admin
//   personal  | false            | owner + admin (everyone if public) | owner + admin
//
// Signed-out visitors only see public recipes.

const toId = value => (value && value._id ? value._id : value)?.toString();

/** MongoDB filter of the recipes `user` may see (null = signed out). */
const visibilityFilter = user => {
  if (!user) return { isPublic: true };
  if (user.role === 'admin') return {};
  return { $or: [{ isPublic: true }, { author: user._id }] };
};

const isOwner = (recipe, user) => !!user && toId(recipe.author) === user._id.toString();

const canView = (recipe, user) => {
  if (!recipe) return false;
  if (recipe.isPublic !== false) return true;
  if (!user) return false;
  return user.role === 'admin' || isOwner(recipe, user);
};

const canEdit = (recipe, user) => {
  if (!recipe || !user) return false;
  if (user.role === 'admin') return true;
  return (recipe.type || 'personal') === 'personal' && isOwner(recipe, user);
};

module.exports = { visibilityFilter, canView, canEdit, isOwner };
