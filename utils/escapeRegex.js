// Escape special RegExp characters in user input to prevent
// RegExp injection / ReDoS when building dynamic regex queries.
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = escapeRegex;
