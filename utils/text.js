// Vietnamese-aware text helpers (ported 1:1 from the mobile app: src/utils/text.js)
// so the server matches names exactly like the app does ("hanh" === "Hành", "duong" === "đường").
// NFD does not decompose "đ/Đ", so it is mapped explicitly.

const normalizeVi = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

// Word tokens (letters/digits only) of a normalized string.
const tokensOf = value => normalizeVi(value).split(/[^a-z0-9]+/).filter(Boolean);

// True when every word of `phrase` appears in `text` as consecutive whole words.
const containsPhrase = (text, phrase) => {
  const hay = ` ${tokensOf(text).join(' ')} `;
  const needle = tokensOf(phrase).join(' ');
  return needle.length > 0 && hay.includes(` ${needle} `);
};

// Key used to compare category names: ignores accents, case and emoji ("Món chính 🍲" === "mon chinh").
const categoryKey = value => tokensOf(value).join(' ');

// URL-friendly identifier built from a name: "Món chính 🍲" -> "mon-chinh".
const slugify = value => tokensOf(value).join('-');

module.exports = { normalizeVi, tokensOf, containsPhrase, categoryKey, slugify };
