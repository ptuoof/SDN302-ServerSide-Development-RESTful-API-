// Unit catalog ported 1:1 from the mobile app (src/utils/units.js): one canonical spelling per unit
// ("gram", "gr", "g" -> "g") and conversion inside a family (g <-> kg, ml <-> lít), so the shopping
// list can merge 300 g + 0,5 kg into one row exactly like the app does.
const { normalizeVi } = require('./text');
const { formatNumber, parseAmount } = require('./quantity');

const UNIT_DEFS = [
  { unit: 'g', family: 'mass', factor: 1, aliases: ['gr', 'gram', 'grams', 'gam'] },
  { unit: 'kg', family: 'mass', factor: 1000, aliases: ['kilogram', 'kilo', 'ki lo', 'ky', 'ki'] },
  { unit: 'ml', family: 'volume', factor: 1, aliases: ['mililit', 'mi li lit', 'milliliter', 'cc'] },
  { unit: 'lít', family: 'volume', factor: 1000, aliases: ['l', 'lit', 'liter', 'litre'] },
  { unit: 'muỗng canh', aliases: ['thia canh', 'tbsp'] },
  { unit: 'muỗng cà phê', aliases: ['thia ca phe', 'muong cafe', 'thia cafe', 'tsp'] },
  { unit: 'quả', aliases: ['trai'] },
  { unit: 'củ', aliases: [] },
  { unit: 'tép', aliases: [] },
  { unit: 'nhánh', aliases: [] },
  { unit: 'cây', aliases: [] },
  { unit: 'bó', aliases: [] },
  { unit: 'lát', aliases: [] },
  { unit: 'miếng', aliases: [] },
  { unit: 'gói', aliases: [] },
  { unit: 'hộp', aliases: [] },
  { unit: 'chai', aliases: [] },
  { unit: 'lon', aliases: [] },
  { unit: 'chén', aliases: ['bat'] },
  { unit: 'ly', aliases: ['coc'] },
  { unit: 'phần', aliases: [] }
];

const BY_KEY = new Map();
UNIT_DEFS.forEach(def => [def.unit, ...def.aliases].forEach(alias => BY_KEY.set(normalizeVi(alias), def)));

const unitDef = unit => BY_KEY.get(normalizeVi(unit).replace(/\.$/, '')) || null;

/** Canonical spelling of a known unit; unknown units are kept as typed (trimmed). */
const normalizeUnit = unit => unitDef(unit)?.unit ?? String(unit ?? '').trim();

const fromBase = (value, family) => {
  const units = UNIT_DEFS.filter(def => def.family === family).sort((a, b) => b.factor - a.factor);
  const isExact = def => Math.abs(Math.round(value / def.factor * 10) / 10 * def.factor - value) < 1e-9;
  const target = units.find(def => value >= def.factor && isExact(def)) || units[units.length - 1];
  return { amount: formatNumber(value / target.factor), unit: target.unit };
};

/**
 * Adds two quantities ({ amount, unit }). Returns { amount, unit }, or null when they cannot be
 * added (text amounts like "Vừa đủ", or units of different kinds such as g + quả).
 */
const addQuantities = (a, b) => {
  const pa = parseAmount(a?.amount);
  const pb = parseAmount(b?.amount);
  if (!pa || !pb || pa.rest.trim() || pb.rest.trim()) return null;
  const da = unitDef(a.unit);
  const db = unitDef(b.unit);
  if (da?.family && da.family === db?.family) {
    return fromBase(pa.value * da.factor + pb.value * db.factor, da.family);
  }
  const ua = normalizeUnit(a.unit);
  if (normalizeVi(ua) !== normalizeVi(normalizeUnit(b.unit))) return null;
  return { amount: formatNumber(pa.value + pb.value), unit: ua };
};

module.exports = { normalizeUnit, addQuantities };
