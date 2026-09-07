import { db, insert, nextId, patch, remove, update } from './store.js'
import { dishRatingOf } from './derive.js'

/** Die Speisekarte eines Betriebs, nach Kategorien gegliedert. */
export function get(placeId) {
  const data = db()
  return data.menuCategories
    .filter((c) => c.placeId === placeId)
    .sort((a, b) => a.sort - b.sort)
    .map((c) => ({
      ...c,
      items: data.dishes
        .filter((d) => d.categoryId === c.id)
        .sort((a, b) => a.sort - b.sort)
        .map((d) => ({ ...d, ...dishRatingOf(d.id, data) })),
    }))
}

/** Flache Liste aller Gerichte — für Bewertung und Suche. */
export function dishes(placeId) {
  const data = db()
  return data.dishes
    .filter((d) => d.placeId === placeId)
    .map((d) => ({ ...d, ...dishRatingOf(d.id, data) }))
}

export function addCategory(placeId, name) {
  const sort = db().menuCategories.filter((c) => c.placeId === placeId).length
  const row = { id: nextId('menuCategories', 'mc'), placeId, name, description: '', sort }
  update((d) => ({ menuCategories: [...d.menuCategories, row] }))
  return row
}

export function updateCategory(id, changes) {
  patch('menuCategories', id, { name: changes.name, description: changes.description })
  return true
}

export function removeCategory(id) {
  remove('dishes', (d) => d.categoryId === id)
  remove('menuCategories', (c) => c.id === id)
  return true
}

/** Verschiebt eine Kategorie um eine Position nach oben oder unten. */
export function moveCategory(id, direction) {
  update((d) => {
    const category = d.menuCategories.find((c) => c.id === id)
    if (!category) return null
    const siblings = d.menuCategories
      .filter((c) => c.placeId === category.placeId)
      .sort((a, b) => a.sort - b.sort)
    const index = siblings.findIndex((c) => c.id === id)
    const target = index + direction
    if (target < 0 || target >= siblings.length) return null

    const swapped = [...siblings]
    ;[swapped[index], swapped[target]] = [swapped[target], swapped[index]]
    const order = new Map(swapped.map((c, i) => [c.id, i]))
    return {
      menuCategories: d.menuCategories.map((c) => (order.has(c.id) ? { ...c, sort: order.get(c.id) } : c)),
    }
  })
  return true
}

const DISH_FIELDS = ['name', 'description', 'priceCents', 'categoryId', 'diet', 'allergens', 'spicy', 'popular', 'available', 'confirmed']
const onlyDishFields = (dish) =>
  Object.fromEntries(Object.entries(dish ?? {}).filter(([key]) => DISH_FIELDS.includes(key)))

export function addDish(placeId, categoryId, dish) {
  const sort = db().dishes.filter((d) => d.categoryId === categoryId).length
  const row = {
    id: nextId('dishes', 'd'), placeId, categoryId, sort,
    name: '', description: '', priceCents: 0, diet: [], allergens: [],
    spicy: 0, popular: false, available: true, confirmed: true,
    ...onlyDishFields(dish),
  }
  insert('dishes', row)
  return row
}

export function updateDish(id, changes) {
  patch('dishes', id, onlyDishFields(changes))
  return true
}

export function removeDish(id) {
  remove('dishes', (d) => d.id === id)
  return true
}

/** Zu welchem Betrieb gehört diese Kategorie bzw. dieses Gericht? */
export function placeOfCategory(id) {
  return db().menuCategories.find((c) => c.id === id)?.placeId ?? null
}

export function placeOfDish(id) {
  return db().dishes.find((d) => d.id === id)?.placeId ?? null
}
