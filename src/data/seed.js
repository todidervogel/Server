/**
 * Ausgangsdatenbestand.
 *
 * Das ist die einzige Stelle mit erfundenen Inhalten. Die Struktur folgt dem
 * Datenmodell aus dem Konzept (Abschnitt 6), damit sich beim Umzug auf einen
 * echten Server nur die Herkunft ändert, nicht die Form.
 *
 * Zeiten stehen als Minuten seit Mitternacht — damit lässt sich „jetzt
 * geöffnet" wirklich rechnen statt nur anzuzeigen.
 */

/** Angebotsarten — was gibt es hier zu essen und zu trinken? (C.3, C.2, C.5) */
export const SERVING_KEYS = [
  'getraenke', 'fruehstueck', 'vegan', 'vegetarisch',
  'fleisch', 'fisch', 'meeresfruechte', 'suess', 'halal', 'glutenfrei',
]

/** Die vierzehn kennzeichnungspflichtigen Allergene. */
export const ALLERGEN_KEYS = [
  'gluten', 'krebstiere', 'ei', 'fisch', 'erdnuss', 'soja', 'milch',
  'schalenfruechte', 'sellerie', 'senf', 'sesam', 'sulfite', 'lupine', 'weichtiere',
]

/** Ausgangsposition des Geräts, solange kein echtes GPS vorliegt. */
export const HOME_POSITION = { lat: 52.5390, lng: 13.4116, label: 'Prenzlauer Berg, Berlin' }

const hm = (h, m = 0) => h * 60 + m

/* ==========================================================================
   Nutzer
   ========================================================================== */
export const users = [
  {
    id: 'u1', username: 'maxmuster', name: 'Max Muster', email: 'max@beispiel.de',
    password: 'Passwort123', role: 'user', private: false, joined: '2026-03-12',
    bio: 'Isst sich einmal quer durch Prenzlauer Berg. Immer auf der Suche nach dem besten Sauerteig.',
    radius: 5, status: 'active', reportCount: 0, notify: { follows: true, likes: true, replies: true, moderation: true },
  },
  {
    id: 'u2', username: 'lisa_k', name: 'Lisa K.', email: 'lisa@beispiel.de',
    password: 'Passwort123', role: 'user', private: false, joined: '2026-05-02',
    bio: 'Kaffee zuerst.', radius: 5, status: 'active', reportCount: 1,
    notify: { follows: true, likes: true, replies: true, moderation: true },
  },
  {
    id: 'u3', username: 'jonas.isst', name: 'Jonas', email: 'jonas@beispiel.de',
    password: 'Passwort123', role: 'user', private: true, joined: '2026-01-18',
    bio: 'Streetfood, Suppen, Sonstiges.', radius: 10, status: 'warned', reportCount: 4,
    notify: { follows: true, likes: false, replies: true, moderation: true },
  },
  {
    id: 'u4', username: 'fatima_b', name: 'Fatima B.', email: 'fatima@beispiel.de',
    password: 'Passwort123', role: 'user', private: false, joined: '2026-06-21',
    bio: '', radius: 5, status: 'active', reportCount: 0,
    notify: { follows: true, likes: true, replies: true, moderation: true },
  },
  {
    id: 'u5', username: 'spamking', name: 'Spam King', email: 'noreply@spam.example',
    password: 'Passwort123', role: 'user', private: false, joined: '2026-08-30',
    bio: '', radius: 5, status: 'banned', reportCount: 9,
    notify: { follows: false, likes: false, replies: false, moderation: true },
  },
  {
    id: 'g1', username: 'trattoria-bella', name: 'Trattoria Bella', email: 'chef@trattoria-bella.de',
    password: 'Gastro123', role: 'gastro', placeId: 'p1', mustChangePassword: false,
    private: false, joined: '2026-04-02', bio: '', status: 'active', reportCount: 0,
    notify: { reviews: true, videos: true, moderation: true },
  },
  {
    id: 'g2', username: 'cafe-morgenrot', name: 'Café Morgenrot', email: 'hallo@morgenrot-cafe.de',
    password: 'Start1234', role: 'gastro', placeId: 'p2', mustChangePassword: true,
    private: false, joined: '2026-09-01', bio: '', status: 'active', reportCount: 0,
    notify: { reviews: true, videos: true, moderation: true },
  },
  {
    id: 'a1', username: 'ana', name: 'Ana (Redaktion)', email: 'ana@intern',
    password: 'Admin1234', role: 'admin', private: true, joined: '2026-01-02',
    bio: '', status: 'active', reportCount: 0, notify: {},
  },
]

/* ==========================================================================
   Betriebe
   ========================================================================== */
const H = {
  trattoria: { mo: [[hm(11, 30), hm(22)]], di: [[hm(11, 30), hm(22)]], mi: [[hm(11, 30), hm(22)]], do: [[hm(11, 30), hm(23)]], fr: [[hm(11, 30), hm(23, 30)]], sa: [[hm(12), hm(23, 30)]], so: [[hm(12), hm(21)]] },
  cafe: { mo: [], di: [[hm(8), hm(18)]], mi: [[hm(8), hm(18)]], do: [[hm(8), hm(18)]], fr: [[hm(8), hm(19)]], sa: [[hm(9), hm(19)]], so: [[hm(9), hm(17)]] },
  imbiss: { mo: [[hm(11), hm(20)]], di: [[hm(11), hm(20)]], mi: [[hm(11), hm(20)]], do: [[hm(11), hm(20)]], fr: [[hm(11), hm(21)]], sa: [[hm(11), hm(21)]], so: [] },
  baecker: { mo: [[hm(6, 30), hm(18, 30)]], di: [[hm(6, 30), hm(18, 30)]], mi: [[hm(6, 30), hm(18, 30)]], do: [[hm(6, 30), hm(18, 30)]], fr: [[hm(6, 30), hm(18, 30)]], sa: [[hm(7), hm(14)]], so: [] },
  bar: { mo: [], di: [[hm(18), hm(25)]], mi: [[hm(18), hm(25)]], do: [[hm(18), hm(26)]], fr: [[hm(18), hm(27)]], sa: [[hm(18), hm(27)]], so: [[hm(18), hm(24)]] },
  eis: { mo: [[hm(12), hm(21)]], di: [[hm(12), hm(21)]], mi: [[hm(12), hm(21)]], do: [[hm(12), hm(21)]], fr: [[hm(12), hm(22)]], sa: [[hm(11), hm(22)]], so: [[hm(11), hm(22)]] },
  sushi: { mo: [], di: [[hm(17), hm(23)]], mi: [[hm(17), hm(23)]], do: [[hm(17), hm(23)]], fr: [[hm(17), hm(24)]], sa: [[hm(17), hm(24)]], so: [[hm(17), hm(22)]] },
  wirtshaus: { mo: [[hm(16), hm(23)]], di: [[hm(16), hm(23)]], mi: [[hm(16), hm(23)]], do: [[hm(16), hm(23, 30)]], fr: [[hm(16), hm(24, 0)]], sa: [[hm(12), hm(24, 0)]], so: [[hm(12), hm(22)]] },
  bistro: { mo: [[hm(11, 30), hm(21)]], di: [[hm(11, 30), hm(21)]], mi: [[hm(11, 30), hm(21)]], do: [[hm(11, 30), hm(21)]], fr: [[hm(11, 30), hm(22)]], sa: [[hm(10), hm(22)]], so: [[hm(10), hm(18)]] },
  kontor: { mo: [], di: [[hm(16), hm(24, 0)]], mi: [[hm(16), hm(24, 0)]], do: [[hm(16), hm(25)]], fr: [[hm(15), hm(26)]], sa: [[hm(14), hm(26)]], so: [[hm(14), hm(22)]] },
}

export const places = [
  {
    id: 'p1', slug: 'trattoria-bella', name: 'Trattoria Bella', osmId: 'node/1001',
    cuisine: 'Italienisch', tags: ['Italienisch', 'Pizza'], price: '€€', category: 'restaurant',
    serving: ['fleisch', 'fisch', 'vegetarisch', 'suess'],
    lat: 52.5385, lng: 13.4098,
    address: 'Kastanienallee 42', zip: '10435', city: 'Berlin',
    phone: '+49 30 1234567', website: 'trattoria-bella.de',
    claimStatus: 'verified', claimedBy: 'g1', status: 'active', hasCover: true,
    description: 'Kleine Familientrattoria seit 1998. Wir backen im Holzofen, machen die Pasta selbst und beziehen Tomaten und Öl von einem Hof in Apulien.',
    features: ['aussenplaetze', 'vegetarisch', 'reservierung', 'kartenzahlung', 'wlan'],
    hours: H.trattoria, menuNote: 'Alle Preise in Euro inkl. MwSt. Allergene auf Anfrage auch mündlich.',
  },
  {
    id: 'p2', slug: 'cafe-morgenrot', name: 'Café Morgenrot', osmId: 'node/1002',
    cuisine: 'Café', tags: ['Café', 'Frühstück'], price: '€', category: 'cafe',
    serving: ['fruehstueck', 'vegan', 'vegetarisch', 'suess', 'getraenke'],
    lat: 52.5399, lng: 13.4088,
    address: 'Oderberger Str. 7', zip: '10435', city: 'Berlin',
    phone: '+49 30 7654321', website: 'morgenrot-cafe.de',
    claimStatus: 'unclaimed', claimedBy: null, status: 'active', hasCover: false,
    description: 'Frühstück den ganzen Tag, Filterkaffee aus der Rösterei um die Ecke.',
    features: ['vegan', 'vegetarisch', 'hunde', 'wlan', 'barrierefrei'],
    hours: H.cafe, menuNote: '',
  },
  {
    id: 'p3', slug: 'dong-xuan-imbiss', name: 'Dong Xuan Imbiss', osmId: 'node/1003',
    cuisine: 'Vietnamesisch', tags: ['Vietnamesisch', 'Suppe'], price: '€', category: 'imbiss',
    serving: ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
    lat: 52.5250, lng: 13.4900,
    address: 'Herzbergstr. 128', zip: '10365', city: 'Berlin',
    phone: '+49 30 5556677', website: '',
    claimStatus: 'verified', claimedBy: null, status: 'active', hasCover: true,
    description: 'Pho, Bun Bo und Sommerrollen. Bar bezahlen, schnell essen, glücklich sein.',
    features: ['abholung', 'lieferung', 'vegetarisch'],
    hours: H.imbiss, menuNote: '',
  },
  {
    id: 'p4', slug: 'baeckerei-sommer', name: 'Bäckerei Sommer', osmId: 'node/1004',
    cuisine: 'Bäckerei', tags: ['Bäckerei'], price: '€', category: 'baeckerei',
    serving: ['fruehstueck', 'suess', 'vegetarisch', 'getraenke'],
    lat: 52.5470, lng: 13.4130,
    address: 'Schönhauser Allee 118', zip: '10437', city: 'Berlin',
    phone: '+49 30 4443322', website: '',
    claimStatus: 'unclaimed', claimedBy: null, status: 'active', hasCover: false,
    description: 'Sauerteigbrot, Franzbrötchen und Kaffee zum Mitnehmen.',
    features: ['abholung', 'kartenzahlung'],
    hours: H.baecker, menuNote: '',
  },
  {
    id: 'p5', slug: 'bar-nordlicht', name: 'Bar Nordlicht', osmId: 'node/1005',
    cuisine: 'Bar', tags: ['Bar', 'Cocktails'], price: '€€€', category: 'bar',
    serving: ['getraenke', 'vegetarisch', 'fleisch'],
    lat: 52.4830, lng: 13.4380,
    address: 'Weichselstr. 3', zip: '12043', city: 'Berlin',
    phone: '+49 30 9998877', website: 'bar-nordlicht.de',
    claimStatus: 'verified', claimedBy: null, status: 'active', hasCover: true,
    description: 'Kleine Karte, große Drinks. Küche bis 23 Uhr.',
    features: ['reservierung', 'kartenzahlung', 'aussenplaetze'],
    hours: H.bar, menuNote: '',
  },
  {
    id: 'p6', slug: 'eis-luisa', name: 'Eis Luisa', osmId: 'node/1006',
    cuisine: 'Eisdiele', tags: ['Eisdiele'], price: '€', category: 'eisdiele',
    serving: ['suess', 'vegan', 'vegetarisch', 'glutenfrei'],
    lat: 52.5100, lng: 13.4600,
    address: 'Boxhagener Str. 84', zip: '10245', city: 'Berlin',
    phone: '', website: '',
    claimStatus: 'unclaimed', claimedBy: null, status: 'active', hasCover: true,
    description: 'Handgemachtes Eis, jeden Tag frisch. Auch vegan.',
    features: ['vegan', 'barrierefrei'],
    hours: H.eis, menuNote: '',
  },
  {
    id: 'p7', slug: 'sushi-kaito', name: 'Sushi Kaito', osmId: 'node/1007',
    cuisine: 'Japanisch', tags: ['Japanisch', 'Sushi'], price: '€€€', category: 'restaurant',
    serving: ['fisch', 'meeresfruechte', 'vegetarisch', 'glutenfrei'],
    lat: 52.5290, lng: 13.4050,
    address: 'Torstr. 90', zip: '10119', city: 'Berlin',
    phone: '+49 30 2223344', website: 'sushi-kaito.de',
    claimStatus: 'verified', claimedBy: null, status: 'active', hasCover: true,
    description: 'Omakase an acht Plätzen. Fisch kommt dienstags und freitags.',
    features: ['reservierung', 'kartenzahlung'],
    hours: H.sushi, menuNote: 'Rohe Fischprodukte. Bitte weisen Sie uns auf Unverträglichkeiten hin.',
  },
  {
    id: 'p8', slug: 'zum-goldenen-hahn', name: 'Zum Goldenen Hahn', osmId: 'node/1008',
    cuisine: 'Deutsch', tags: ['Deutsch', 'Wirtshaus'], price: '€€', category: 'pub',
    serving: ['fleisch', 'getraenke', 'vegetarisch'],
    lat: 52.5330, lng: 13.4230,
    address: 'Prenzlauer Allee 30', zip: '10405', city: 'Berlin',
    phone: '+49 30 3334455', website: '',
    claimStatus: 'unclaimed', claimedBy: null, status: 'active', hasCover: false,
    description: 'Schnitzel, Bier vom Fass, Stammtisch am Donnerstag.',
    features: ['aussenplaetze', 'hunde'],
    hours: H.wirtshaus, menuNote: '',
  },
  {
    id: 'p9', slug: 'gruenkern', name: 'Grünkern', osmId: 'node/1009',
    cuisine: 'Vegan', tags: ['Vegan', 'Bowls'], price: '€€', category: 'restaurant',
    serving: ['vegan', 'vegetarisch', 'glutenfrei', 'fruehstueck'],
    lat: 52.5410, lng: 13.4260,
    address: 'Danziger Str. 60', zip: '10435', city: 'Berlin',
    phone: '+49 30 6667788', website: 'gruenkern-berlin.de',
    claimStatus: 'verified', claimedBy: null, status: 'active', hasCover: true,
    description: 'Rein pflanzlich, saisonal, ohne Ersatzprodukte. Mittagskarte wechselt wöchentlich.',
    features: ['vegan', 'barrierefrei', 'kartenzahlung', 'abholung'],
    hours: H.bistro, menuNote: 'Komplett pflanzlich. Glutenfreie Varianten mit ⌀ gekennzeichnet.',
  },
  {
    id: 'p10', slug: 'craft-beer-kontor', name: 'Craft Beer Kontor', osmId: 'node/1010',
    cuisine: 'Bar', tags: ['Bar', 'Bier'], price: '€€', category: 'bar',
    serving: ['getraenke'],
    lat: 52.5320, lng: 13.4290,
    address: 'Greifswalder Str. 12', zip: '10405', city: 'Berlin',
    phone: '+49 30 1112233', website: '',
    claimStatus: 'unclaimed', claimedBy: null, status: 'active', hasCover: false,
    description: 'Sechzehn Hähne, kein Essen. Wer Hunger hat, bringt sich was mit.',
    features: ['kartenzahlung', 'hunde'],
    hours: H.kontor, menuNote: 'Ausschank ohne Speisen.',
  },
]

/* ==========================================================================
   Speisekarten — Kategorien und Gerichte
   ========================================================================== */
export const menuCategories = [
  { id: 'mc1', placeId: 'p1', name: 'Vorspeisen', description: 'Zum Teilen gedacht.', sort: 0 },
  { id: 'mc2', placeId: 'p1', name: 'Pizza aus dem Holzofen', description: '', sort: 1 },
  { id: 'mc3', placeId: 'p1', name: 'Pasta', description: 'Täglich frisch gerollt.', sort: 2 },
  { id: 'mc4', placeId: 'p1', name: 'Dolci', description: '', sort: 3 },
  { id: 'mc5', placeId: 'p1', name: 'Getränke', description: '', sort: 4 },

  { id: 'mc6', placeId: 'p2', name: 'Frühstück', description: 'Den ganzen Tag.', sort: 0 },
  { id: 'mc7', placeId: 'p2', name: 'Kuchen', description: '', sort: 1 },
  { id: 'mc8', placeId: 'p2', name: 'Kaffee', description: '', sort: 2 },

  { id: 'mc9', placeId: 'p9', name: 'Bowls', description: 'Alles rein pflanzlich.', sort: 0 },
  { id: 'mc10', placeId: 'p9', name: 'Kleinigkeiten', description: '', sort: 1 },
  { id: 'mc11', placeId: 'p9', name: 'Getränke', description: '', sort: 2 },

  { id: 'mc12', placeId: 'p7', name: 'Nigiri & Sashimi', description: 'Preis pro zwei Stück.', sort: 0 },
  { id: 'mc13', placeId: 'p7', name: 'Maki', description: '', sort: 1 },
  { id: 'mc14', placeId: 'p7', name: 'Warm', description: '', sort: 2 },

  { id: 'mc15', placeId: 'p10', name: 'Vom Fass', description: 'Wechselt wöchentlich.', sort: 0 },
  { id: 'mc16', placeId: 'p10', name: 'Flasche', description: '', sort: 1 },
]

export const dishes = [
  /* Trattoria Bella */
  { id: 'd1', placeId: 'p1', categoryId: 'mc2', name: 'Pizza Margherita', description: 'Tomate, Fior di Latte, Basilikum, Olivenöl.', priceCents: 950, diet: ['vegetarisch'], allergens: ['gluten', 'milch'], spicy: 0, popular: true, available: true, confirmed: true, sort: 0 },
  { id: 'd2', placeId: 'p1', categoryId: 'mc3', name: 'Tagliatelle al Ragù', description: 'Frische Bandnudeln, Rinderragout, vier Stunden geschmort.', priceCents: 1400, diet: [], allergens: ['gluten', 'ei', 'sellerie'], spicy: 0, popular: true, available: true, confirmed: true, sort: 0 },
  { id: 'd3', placeId: 'p1', categoryId: 'mc1', name: 'Bruschetta', description: 'Geröstetes Brot, Tomate, Knoblauch.', priceCents: 600, diet: ['vegan', 'vegetarisch'], allergens: ['gluten'], spicy: 0, popular: false, available: true, confirmed: false, sort: 0 },
  { id: 'd4', placeId: 'p1', categoryId: 'mc4', name: 'Tiramisu', description: 'Hausgemacht, mit Espresso aus der eigenen Röstung.', priceCents: 550, diet: ['vegetarisch'], allergens: ['gluten', 'ei', 'milch'], spicy: 0, popular: true, available: true, confirmed: true, sort: 0 },
  { id: 'd5', placeId: 'p1', categoryId: 'mc5', name: 'Hausrotwein 0,2 l', description: 'Primitivo, Apulien.', priceCents: 500, diet: ['vegan'], allergens: ['sulfite'], spicy: 0, popular: false, available: true, confirmed: true, sort: 0 },
  { id: 'd6', placeId: 'p1', categoryId: 'mc1', name: 'Vitello Tonnato', description: 'Kalbsrücken, Thunfischcreme, Kapern.', priceCents: 1150, diet: [], allergens: ['fisch', 'ei', 'sellerie'], spicy: 0, popular: false, available: true, confirmed: true, sort: 1 },
  { id: 'd7', placeId: 'p1', categoryId: 'mc2', name: 'Pizza Diavola', description: 'Scharfe Salami, Chili, Mozzarella.', priceCents: 1250, diet: [], allergens: ['gluten', 'milch'], spicy: 2, popular: false, available: true, confirmed: true, sort: 1 },
  { id: 'd8', placeId: 'p1', categoryId: 'mc3', name: 'Cacio e Pepe', description: 'Pecorino, schwarzer Pfeffer, sonst nichts.', priceCents: 1200, diet: ['vegetarisch'], allergens: ['gluten', 'milch'], spicy: 0, popular: false, available: false, confirmed: true, sort: 1 },

  /* Café Morgenrot */
  { id: 'd9', placeId: 'p2', categoryId: 'mc6', name: 'Großes Frühstück', description: 'Brot, Aufstriche, Obst, Ei nach Wunsch.', priceCents: 1250, diet: ['vegetarisch'], allergens: ['gluten', 'ei', 'milch'], spicy: 0, popular: true, available: true, confirmed: false, sort: 0 },
  { id: 'd10', placeId: 'p2', categoryId: 'mc6', name: 'Porridge mit Apfel', description: 'Haferbrei mit Zimt und Röstmandeln.', priceCents: 690, diet: ['vegan', 'vegetarisch'], allergens: ['gluten', 'schalenfruechte'], spicy: 0, popular: false, available: true, confirmed: false, sort: 1 },
  { id: 'd11', placeId: 'p2', categoryId: 'mc7', name: 'Zimtschnecke', description: 'Morgens gebacken, mittags meist weg.', priceCents: 390, diet: ['vegetarisch'], allergens: ['gluten', 'milch', 'ei'], spicy: 0, popular: true, available: true, confirmed: false, sort: 0 },
  { id: 'd12', placeId: 'p2', categoryId: 'mc8', name: 'Filterkaffee', description: 'Rösterei um die Ecke, wechselnde Herkunft.', priceCents: 320, diet: ['vegan'], allergens: [], spicy: 0, popular: false, available: true, confirmed: false, sort: 0 },

  /* Grünkern */
  { id: 'd13', placeId: 'p9', categoryId: 'mc9', name: 'Ottolenghi-Bowl', description: 'Rote Bete, Linsen, Tahini, geröstete Haselnuss.', priceCents: 1390, diet: ['vegan', 'vegetarisch'], allergens: ['sesam', 'schalenfruechte'], spicy: 0, popular: true, available: true, confirmed: true, sort: 0 },
  { id: 'd14', placeId: 'p9', categoryId: 'mc9', name: 'Kimchi-Reis', description: 'Kurzkornreis, hausgemachtes Kimchi, Frühlingszwiebel.', priceCents: 1250, diet: ['vegan', 'vegetarisch', 'glutenfrei'], allergens: ['soja'], spicy: 2, popular: false, available: true, confirmed: true, sort: 1 },
  { id: 'd15', placeId: 'p9', categoryId: 'mc10', name: 'Hummus mit Fladenbrot', description: 'Kichererbse, Zitrone, viel Olivenöl.', priceCents: 720, diet: ['vegan', 'vegetarisch'], allergens: ['gluten', 'sesam'], spicy: 0, popular: false, available: true, confirmed: true, sort: 0 },
  { id: 'd16', placeId: 'p9', categoryId: 'mc11', name: 'Ingwer-Limonade', description: 'Selbst angesetzt, nicht zu süß.', priceCents: 450, diet: ['vegan', 'glutenfrei'], allergens: [], spicy: 1, popular: false, available: true, confirmed: true, sort: 0 },

  /* Sushi Kaito */
  { id: 'd17', placeId: 'p7', categoryId: 'mc12', name: 'Lachs Nigiri', description: 'Zwei Stück, Norwegen.', priceCents: 620, diet: ['glutenfrei'], allergens: ['fisch'], spicy: 0, popular: true, available: true, confirmed: true, sort: 0 },
  { id: 'd18', placeId: 'p7', categoryId: 'mc12', name: 'Garnele Nigiri', description: 'Zwei Stück, kurz gegart.', priceCents: 580, diet: [], allergens: ['krebstiere'], spicy: 0, popular: false, available: true, confirmed: true, sort: 1 },
  { id: 'd19', placeId: 'p7', categoryId: 'mc13', name: 'Gurken-Maki', description: 'Sechs Stück.', priceCents: 450, diet: ['vegan', 'vegetarisch', 'glutenfrei'], allergens: [], spicy: 0, popular: false, available: true, confirmed: true, sort: 0 },
  { id: 'd20', placeId: 'p7', categoryId: 'mc14', name: 'Miso-Suppe', description: 'Dashi, Tofu, Wakame.', priceCents: 420, diet: ['vegetarisch'], allergens: ['soja', 'fisch'], spicy: 0, popular: false, available: true, confirmed: true, sort: 0 },

  /* Craft Beer Kontor */
  { id: 'd21', placeId: 'p10', categoryId: 'mc15', name: 'Pils vom Fass 0,3 l', description: 'Ungefiltert, aus Brandenburg.', priceCents: 420, diet: ['vegan'], allergens: ['gluten'], spicy: 0, popular: true, available: true, confirmed: false, sort: 0 },
  { id: 'd22', placeId: 'p10', categoryId: 'mc15', name: 'IPA vom Fass 0,3 l', description: 'Wechselnd, siehe Tafel.', priceCents: 490, diet: ['vegan'], allergens: ['gluten'], spicy: 0, popular: false, available: true, confirmed: false, sort: 1 },
  { id: 'd23', placeId: 'p10', categoryId: 'mc16', name: 'Alkoholfreies Weizen 0,5 l', description: '', priceCents: 430, diet: ['vegan'], allergens: ['gluten'], spicy: 0, popular: false, available: true, confirmed: false, sort: 0 },
]

/* ==========================================================================
   Videos, Bewertungen, Beziehungen
   ========================================================================== */
export const videos = [
  { id: 'v1', placeId: 'p1', authorId: 'u1', authorType: 'user', caption: 'Die Pizza kam nach zwölf Minuten und war noch am Blubbern. Der Teig hat 48 Stunden Gare, sagt der Chef.', views: 12400, durationSec: 35, verifiedOnSite: true, visibility: 'public', status: 'published', createdAt: '2026-09-03' },
  { id: 'v2', placeId: 'p2', authorId: 'u2', authorType: 'user', caption: 'Zimtschnecke, noch warm. Mehr muss ich nicht sagen.', views: 3910, durationSec: 18, verifiedOnSite: true, visibility: 'public', status: 'published', createdAt: '2026-09-01' },
  { id: 'v3', placeId: 'p3', authorId: 'u3', authorType: 'user', caption: 'Pho um halb elf morgens. Die Brühe köchelt seit gestern.', views: 48100, durationSec: 52, verifiedOnSite: false, visibility: 'public', status: 'published', createdAt: '2026-08-30' },
  { id: 'v4', placeId: 'p5', authorId: 'u4', authorType: 'user', caption: 'Negroni mit Rauchnote. Die Karte wechselt jede Woche.', views: 1302, durationSec: 22, verifiedOnSite: true, visibility: 'friends', status: 'pending_review', createdAt: '2026-08-28' },
  { id: 'v5', placeId: 'p6', authorId: 'u1', authorType: 'user', caption: 'Pistazie und Zitrone. Beides vegan.', views: 890, durationSec: 14, verifiedOnSite: true, visibility: 'private', status: 'published', createdAt: '2026-08-24' },
  { id: 'v6', placeId: 'p1', authorId: 'u3', authorType: 'user', caption: 'Tiramisu im Glas — süß, aber nicht zu süß.', views: 5640, durationSec: 27, verifiedOnSite: false, visibility: 'public', status: 'rejected', rejectReason: 'Falscher Betrieb', createdAt: '2026-08-20' },
  { id: 'v7', placeId: 'p9', authorId: 'u2', authorType: 'user', caption: 'Die Bowl sieht aus wie gemalt und schmeckt auch so.', views: 2210, durationSec: 24, verifiedOnSite: true, visibility: 'public', status: 'published', createdAt: '2026-09-05' },
  { id: 'v8', placeId: 'p7', authorId: 'u4', authorType: 'user', caption: 'Acht Plätze, ein Koch, kein Menü zum Aussuchen. Vertrauenssache.', views: 7420, durationSec: 44, verifiedOnSite: true, visibility: 'public', status: 'pending_review', createdAt: '2026-09-06' },
  { id: 'v9', placeId: 'p1', authorId: 'g1', authorType: 'gastro', caption: 'Ein Blick in den Holzofen bei 480 Grad.', views: 940, durationSec: 16, verifiedOnSite: true, visibility: 'public', status: 'published', createdAt: '2026-09-04' },
  { id: 'v10', placeId: 'p8', authorId: 'u1', authorType: 'user', caption: 'Schnitzel größer als der Teller. Klassiker.', views: 1580, durationSec: 20, verifiedOnSite: false, visibility: 'public', status: 'pending_review', createdAt: '2026-09-06' },
]

export const reviews = [
  { id: 'r1', videoId: 'v1', placeId: 'p1', authorId: 'u2', createdAt: '2026-09-03', verifiedOnSite: true, ratingFood: 4, ratingService: 5, ratingPrice: 3, groupSize: 2, foodHot: true, dishes: [{ dishId: 'd1', name: 'Pizza Margherita', rating: 5 }, { dishId: 'd4', name: 'Tiramisu', rating: 4 }], text: 'Wir saßen draußen, es war voll, trotzdem hat alles keine 20 Minuten gedauert. Die Pizza war top, beim Preis merkt man die Lage. Tiramisu unbedingt teilen, die Portion ist groß.', likes: 12, answer: null },
  { id: 'r2', videoId: null, placeId: 'p1', authorId: 'u3', createdAt: '2026-08-28', verifiedOnSite: false, ratingFood: 5, ratingService: 3, ratingPrice: 4, groupSize: 4, foodHot: true, dishes: [{ dishId: 'd2', name: 'Tagliatelle al Ragù', rating: 5 }], text: 'Essen war hervorragend. Der Service war überfordert, wir mussten zweimal nach Wasser fragen. Kommen trotzdem wieder.', likes: 4, answer: { text: 'Danke für die ehrliche Rückmeldung! Freitag war bei uns eine Kollegin krank. Wir haben nachbesetzt — beim nächsten Mal klappt das besser.', createdAt: '2026-08-29' } },
  { id: 'r3', videoId: null, placeId: 'p1', authorId: 'u4', createdAt: '2026-08-19', verifiedOnSite: true, ratingFood: 3, ratingService: 4, ratingPrice: 2, groupSize: 2, foodHot: false, dishes: [{ dishId: 'd3', name: 'Bruschetta', rating: 3 }], text: 'Nett, aber für den Preis erwarte ich mehr. Die Bruschetta kam lauwarm.', likes: 1, answer: null },
  { id: 'r4', videoId: 'v2', placeId: 'p2', authorId: 'u2', createdAt: '2026-09-01', verifiedOnSite: true, ratingFood: 5, ratingService: 4, ratingPrice: 5, groupSize: 1, foodHot: null, dishes: [{ dishId: 'd11', name: 'Zimtschnecke', rating: 5 }], text: 'Beste Zimtschnecke im Bezirk. Punkt.', likes: 9, answer: null },
  { id: 'r5', videoId: 'v3', placeId: 'p3', authorId: 'u3', createdAt: '2026-08-30', verifiedOnSite: false, ratingFood: 5, ratingService: 4, ratingPrice: 5, groupSize: 2, foodHot: true, dishes: [], text: 'Brühe wie bei der Oma, wenn die Oma aus Hanoi käme.', likes: 31, answer: null },
  { id: 'r6', videoId: 'v7', placeId: 'p9', authorId: 'u2', createdAt: '2026-09-05', verifiedOnSite: true, ratingFood: 5, ratingService: 5, ratingPrice: 3, groupSize: 3, foodHot: true, dishes: [{ dishId: 'd13', name: 'Ottolenghi-Bowl', rating: 5 }], text: 'Teuer für eine Schüssel Gemüse — und trotzdem jeden Cent wert.', likes: 17, answer: null },
  { id: 'r7', videoId: null, placeId: 'p7', authorId: 'u1', createdAt: '2026-09-02', verifiedOnSite: true, ratingFood: 5, ratingService: 5, ratingPrice: 2, groupSize: 2, foodHot: null, dishes: [{ dishId: 'd17', name: 'Lachs Nigiri', rating: 5 }], text: 'Ohne Reservierung chancenlos. Mit Reservierung der beste Abend seit langem.', likes: 22, answer: null },
  { id: 'r8', videoId: null, placeId: 'p6', authorId: 'u4', createdAt: '2026-08-24', verifiedOnSite: true, ratingFood: 5, ratingService: 4, ratingPrice: 4, groupSize: 2, foodHot: null, dishes: [], text: 'Pistazie schmeckt nach Pistazie und nicht nach grüner Farbe.', likes: 6, answer: null },
]

export const follows = [
  { followerId: 'u1', followingId: 'u2', status: 'accepted' },
  { followerId: 'u2', followingId: 'u1', status: 'accepted' },
  { followerId: 'u4', followingId: 'u1', status: 'accepted' },
  { followerId: 'u1', followingId: 'u3', status: 'pending' },
]

export const likes = [
  { userId: 'u2', videoId: 'v1' },
  { userId: 'u4', videoId: 'v1' },
  { userId: 'u1', videoId: 'v3' },
]

export const saves = [
  { userId: 'u1', type: 'video', targetId: 'v3' },
  { userId: 'u1', type: 'place', targetId: 'p9' },
  { userId: 'u1', type: 'place', targetId: 'p7' },
]

export const notifications = [
  { id: 'n1', userId: 'u1', type: 'follow', actor: 'fatima_b', text: 'folgt dir jetzt.', createdAt: '2026-09-07T07:10:00', unread: true },
  { id: 'n2', userId: 'u1', type: 'like', actor: 'lisa_k', text: 'gefällt dein Video.', createdAt: '2026-09-07T04:20:00', unread: true },
  { id: 'n3', userId: 'u1', type: 'reply', actor: 'Trattoria Bella', text: 'hat auf deine Bewertung geantwortet.', createdAt: '2026-09-06T18:00:00', unread: false },
  { id: 'n4', userId: 'u1', type: 'approved', text: 'Dein Video wurde freigegeben und ist jetzt sichtbar.', createdAt: '2026-09-05T12:00:00', unread: false },
  { id: 'n5', userId: 'u1', type: 'rejected', text: 'Dein Video wurde nicht freigegeben.', createdAt: '2026-09-03T09:00:00', unread: false, link: 'why' },
]

export const reports = [
  { id: 'm1', createdAt: '2026-09-06', reporterId: 'u2', targetType: 'video', targetId: 'v6', label: 'v6 · Trattoria Bella', reason: 'wrong_place', note: '', count: 3, status: 'open', handledBy: null },
  { id: 'm2', createdAt: '2026-09-05', reporterId: 'u4', targetType: 'review', targetId: 'r3', label: 'r3 · Trattoria Bella', reason: 'fake', note: '', count: 1, status: 'in_review', handledBy: 'a1' },
  { id: 'm3', createdAt: '2026-09-04', reporterId: 'u1', targetType: 'place', targetId: 'p4', label: 'Bäckerei Sommer', reason: 'venue_closed', note: 'Zettel an der Tür seit zwei Wochen.', count: 5, status: 'open', handledBy: null },
  { id: 'm4', createdAt: '2026-09-02', reporterId: 'u1', targetType: 'profile', targetId: 'u5', label: '@spamking', reason: 'spam', note: '', count: 2, status: 'resolved', handledBy: 'a1' },
]

export const invites = [
  { id: 'i1', placeId: 'p2', email: 'hallo@morgenrot-cafe.de', sentAt: '2026-09-01', status: 'opened' },
  { id: 'i2', placeId: 'p6', email: 'info@eis-luisa.de', sentAt: '2026-09-01', status: 'activated' },
  { id: 'i3', placeId: 'p4', email: 'kontakt@baeckerei-sommer.de', sentAt: '2026-08-29', status: 'bounced' },
  { id: 'i4', placeId: 'p5', email: 'bar@nordlicht.de', sentAt: '2026-08-28', status: 'sent' },
]

export const suggestions = [
  { id: 's1', name: 'Trattoria da Enzo', address: 'Danziger Str. 12, 10435 Berlin', type: 'restaurant', reportedBy: 'lisa_k', createdAt: '2026-09-05', status: 'open' },
  { id: 's2', name: 'Späti Kastanie', address: 'Kastanienallee 90, 10435 Berlin', type: 'sonstiges', reportedBy: 'maxmuster', createdAt: '2026-09-03', status: 'rejected' },
  { id: 's3', name: 'Kombüse', address: 'Simon-Dach-Str. 5, 10245 Berlin', type: 'imbiss', reportedBy: 'fatima_b', createdAt: '2026-09-01', status: 'created' },
]

export const auditLog = [
  { id: 'lg1', at: '2026-09-06T09:14:00', admin: 'ana@intern', action: 'Video freigegeben', object: 'v1', note: '' },
  { id: 'lg2', at: '2026-09-06T08:52:00', admin: 'ana@intern', action: 'Betrieb verifiziert', object: 'Trattoria Bella', note: 'Code telefonisch bestätigt' },
  { id: 'lg3', at: '2026-09-05T17:30:00', admin: 'ben@intern', action: 'Nutzer verwarnt', object: '@jonas.isst', note: 'Wiederholte Meldungen' },
  { id: 'lg4', at: '2026-09-05T14:08:00', admin: 'ben@intern', action: 'Meldung abgewiesen', object: 'r3', note: 'Kein Verstoß erkennbar' },
]

export const searchPopular = ['Sauerteigbrot', 'Bowls', 'Sonntagsbrunch', 'Craft Beer', 'Baklava']

export const locations = [
  { id: 'l1', name: 'Berlin', detail: 'Deutschland · 3,8 Mio. Einwohner', lat: 52.5200, lng: 13.4050 },
  { id: 'l2', name: 'Prenzlauer Berg', detail: 'Stadtteil · Berlin', lat: 52.5390, lng: 13.4116 },
  { id: 'l3', name: 'Kastanienallee', detail: 'Straße · 10435 Berlin', lat: 52.5385, lng: 13.4098 },
  { id: 'l4', name: 'Friedrichshain', detail: 'Stadtteil · Berlin', lat: 52.5150, lng: 13.4540 },
  { id: 'l5', name: 'Neukölln', detail: 'Stadtteil · Berlin', lat: 52.4810, lng: 13.4350 },
]

/** Alles zusammen — so sieht die Datenbank beim ersten Start aus. */
export function initialDatabase() {
  return {
    users, places, menuCategories, dishes, videos, reviews,
    follows, likes, saves, notifications, reports, invites, suggestions, auditLog,
    locations, searchPopular,
    seenVideos: [],
    searchHistory: ['ramen', 'frühstück kreuzberg', 'pizza napoletana'],
  }
}
