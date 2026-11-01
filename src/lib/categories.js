// Categorías y clasificación automática de gastos.
import { normName, cleanRut } from './format.js';

export const CATEGORIES = [
  { id: 'super', name: 'Supermercado', icon: '🛒', color: '#2a9d8f' },
  { id: 'comida', name: 'Restaurantes y café', icon: '🍽️', color: '#e76f51' },
  { id: 'delivery', name: 'Delivery', icon: '🛵', color: '#f4a261' },
  { id: 'transporte', name: 'Transporte', icon: '🚌', color: '#457b9d' },
  { id: 'combustible', name: 'Combustible', icon: '⛽', color: '#6d597a' },
  { id: 'salud', name: 'Salud y farmacia', icon: '💊', color: '#e63946' },
  { id: 'hogar', name: 'Hogar', icon: '🏠', color: '#8d6e63' },
  { id: 'servicios', name: 'Cuentas y servicios', icon: '💡', color: '#3d5a80' },
  { id: 'ropa', name: 'Ropa y calzado', icon: '👕', color: '#b5838d' },
  { id: 'entretencion', name: 'Entretención', icon: '🎬', color: '#9b5de5' },
  { id: 'educacion', name: 'Educación', icon: '📚', color: '#277da1' },
  { id: 'tecno', name: 'Tecnología', icon: '💻', color: '#577590' },
  { id: 'mascotas', name: 'Mascotas', icon: '🐾', color: '#90be6d' },
  { id: 'personal', name: 'Cuidado personal', icon: '💇', color: '#f15bb5' },
  { id: 'otros', name: 'Otros', icon: '📦', color: '#8d99ae' },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const catOf = (id) => CAT[id] || CAT.otros;

// Palabras clave por categoría (comercios chilenos comunes + rubros).
// Se evalúan sobre el nombre del comercio normalizado y, con menor peso, sobre los ítems.
const RULES = {
  super: ['lider', 'jumbo', 'unimarc', 'santa isabel', 'tottus', 'acuenta', 'mayorista 10', 'alvi', 'ekono', 'oxxo', 'ok market', 'okm', 'supermercado', 'minimarket', 'botilleria', 'almacen', 'hiper', 'walmart', 'cencosud', 'smu', 'super 10', 'montserrat', 'el trebol', 'fruteria', 'verduleria', 'carniceria', 'panaderia', 'pronto', 'upa'],
  comida: ['restaurant', 'restoran', 'cafe', 'cafeteria', 'starbucks', 'juan maestro', 'doggis', 'mcdonald', 'burger king', 'kfc', 'telepizza', 'domino', 'pizza hut', 'papa john', 'sushi', 'fuente', 'schopdog', 'dominó', 'tavelli', 'bar ', 'pub', 'sanguch', 'emporio', 'heladeria', 'pasteleria', 'pizzeria', 'wendys', 'subway', 'castano', 'castaño', 'gastronomia', 'comida', 'cocineria', 'picada'],
  delivery: ['rappi', 'uber eats', 'ubereats', 'pedidosya', 'pedidos ya', 'justo', 'cornershop', 'didi food'],
  transporte: ['metro', 'bip', 'red movilidad', 'transantiago', 'uber', 'cabify', 'didi', 'taxi', 'turbus', 'pullman', 'efe', 'estacionamiento', 'parking', 'autopista', 'tag', 'costanera', 'vespucio', 'peaje', 'latam', 'sky airline', 'jetsmart'],
  combustible: ['copec', 'shell', 'petrobras', 'aramco', 'esmax', 'enex', 'terpel', 'bencina', 'combustible', 'gasolina', 'diesel', 'servicentro'],
  salud: ['farmacia', 'cruz verde', 'salcobrand', 'ahumada', 'dr simi', 'similares', 'clinica', 'hospital', 'centro medico', 'integramedica', 'redsalud', 'laboratorio', 'dental', 'optica', 'isapre', 'fonasa', 'kinesiolog', 'medic'],
  hogar: ['sodimac', 'easy', 'homecenter', 'construmart', 'imperial', 'ferreteria', 'casaideas', 'ikea', 'falabella hogar', 'mueble', 'deco', 'lavanderia', 'jardin', 'vivero', 'chilemat', 'mts'],
  servicios: ['enel', 'cge', 'aguas andinas', 'esval', 'essbio', 'metrogas', 'lipigas', 'abastible', 'gasco', 'entel', 'movistar', 'claro', 'wom', 'vtr', 'mundo', 'gtd', 'netflix', 'spotify', 'disney', 'hbo', 'max ', 'prime video', 'youtube premium', 'gastos comunes', 'arriendo', 'seguro', 'contribuciones', 'permiso circulacion'],
  ropa: ['zara', 'h&m', 'h m', 'falabella', 'paris', 'ripley', 'hites', 'la polar', 'corona', 'tricot', 'bata', 'skechers', 'adidas', 'nike', 'puma', 'decathlon', 'forever 21', 'family shop', 'zapateria', 'ropa', 'tienda', 'mango', 'gap'],
  entretencion: ['cine', 'cinemark', 'cinepolis', 'cineplanet', 'hoyts', 'teatro', 'concierto', 'puntoticket', 'ticketmaster', 'passline', 'steam', 'playstation', 'xbox', 'nintendo', 'museo', 'parque', 'fantasilandia', 'kidzania', 'bowling', 'casino', 'enjoy', 'dreams'],
  educacion: ['libreria', 'colegio', 'universidad', 'instituto', 'curso', 'antartica', 'buscalibre', 'feria chilena del libro', 'udemy', 'coursera', 'matricula', 'utiles', 'jardin infantil'],
  tecno: ['pc factory', 'pcfactory', 'sp digital', 'spdigital', 'apple', 'samsung', 'xiaomi', 'mercadolibre', 'mercado libre', 'aliexpress', 'amazon', 'temu', 'shein', 'lider tech', 'tecnologia', 'computacion', 'electronica'],
  mascotas: ['veterinaria', 'pet', 'mascota', 'superzoo', 'club de perros', 'petco', 'tus mascotas', 'kennel'],
  personal: ['peluqueria', 'barberia', 'spa ', 'estetica', 'preunic', 'maicao', 'perfumeria', 'cosmetic', 'manicure', 'gimnasio', 'smartfit', 'sportlife', 'energy', 'pacific fitness'],
};

// Palabras de ítems que sugieren categoría (cuando el comercio no lo dice)
const ITEM_RULES = {
  super: ['pan', 'leche', 'huevo', 'arroz', 'fideo', 'aceite', 'azucar', 'yogurt', 'queso', 'jamon', 'pollo', 'carne', 'tomate', 'palta', 'papel hig', 'detergente', 'bebida', 'agua min', 'cerveza', 'vino'],
  comida: ['cafe', 'capuccino', 'latte', 'completo', 'hamburgues', 'pizza', 'sandwich', 'empanada', 'menu', 'almuerzo', 'propina'],
  combustible: ['gasolina', '93 oct', '95 oct', '97 oct', 'diesel', 'kerosene'],
  salud: ['paracetamol', 'ibuprofeno', 'comprimido', 'jarabe', 'mg ', 'capsula', 'receta'],
  mascotas: ['alimento perro', 'alimento gato', 'arena gato', 'dog chow', 'cat chow', 'pedigree', 'whiskas'],
};

export function guessCategory({ merchant = '', rut = '', items = [] }, learned = {}) {
  // 1) Reglas aprendidas del usuario: por RUT y por nombre normalizado
  const r = cleanRut(rut);
  if (r && learned['rut:' + r]) return learned['rut:' + r];
  const n = normName(merchant);
  if (n && learned['name:' + n]) return learned['name:' + n];

  // 2) Reglas por nombre de comercio
  const text = ' ' + n + ' ';
  let best = null, bestLen = 0;
  for (const [cat, words] of Object.entries(RULES)) {
    for (const w of words) {
      const ww = normName(w);
      if (ww && text.includes(' ' + ww) && ww.length > bestLen) { best = cat; bestLen = ww.length; }
    }
  }
  if (best) return best;

  // 3) Votación por ítems
  const votes = {};
  for (const it of items) {
    const d = ' ' + normName(it.desc || it.name || '') + ' ';
    for (const [cat, words] of Object.entries(ITEM_RULES)) {
      if (words.some((w) => d.includes(w))) votes[cat] = (votes[cat] || 0) + 1;
    }
  }
  const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : 'otros';
}

// Aprende la categoría elegida por el usuario para un comercio
export function learnCategory(learned, { merchant, rut }, cat) {
  const out = { ...learned };
  const r = cleanRut(rut || '');
  if (r) out['rut:' + r] = cat;
  const n = normName(merchant || '');
  if (n) out['name:' + n] = cat;
  return out;
}
