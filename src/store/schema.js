/**
 * Das Datenbankschema — eine Tabelle je Sache, mit Typen und Indizes.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/store/sqlite-store.js   baut daraus CREATE TABLE und alle Abfragen  │
 * │  src/store/datenbank.js      wendet sie beim Start an                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Warum eine Beschreibung statt einer .sql-Datei: Die Fachlogik in
 * `src/domain/` arbeitet mit gewöhnlichen JavaScript-Objekten. Damit aus einer
 * Zeile ein solches Objekt wird und umgekehrt, muss der Store ohnehin wissen,
 * welche Felder es gibt, welche davon Wahrheitswerte sind (SQLite kennt keine)
 * und welche verschachtelt sind (die kommen als JSON in eine Textspalte).
 * Steht das an einer Stelle, kann es nicht auseinanderlaufen.
 *
 * Die Spalten heißen wie die Felder in der Fachlogik — `placeId`, nicht
 * `betrieb_id`. Das ist Absicht: Jede Umbenennung wäre eine Fehlerquelle mehr,
 * und wer den Code neben dem Schema liest, sucht denselben Namen.
 *
 * ── Was hier NICHT steht ──────────────────────────────────────────────────
 * Passwörter. Die liegen in `zugaenge` (siehe src/store/zugaenge.js), gehasht
 * und gesalzen, und werden nie zusammen mit dem Konto gelesen. Ein Feld, das
 * es im Nutzerobjekt nicht gibt, kann auch nicht versehentlich in einer
 * Antwort landen.
 */

/**
 * Eine Tabelle beschreibt sich so:
 *
 *   spalten   Name → SQLite-Typ mit Bedingungen
 *   schluessel  Spalten, über die eine Zeile eindeutig ist
 *   json      Spalten, deren Inhalt ein Objekt oder eine Liste ist
 *   bool      Spalten, die true/false führen (SQLite speichert 0/1)
 *   indizes   zusätzliche Indizes für die Abfragen, die die Fachlogik stellt
 */
export const TABELLEN = {
  /* ── Konten ─────────────────────────────────────────────────────────── */
  users: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      username: 'TEXT NOT NULL',
      name: 'TEXT NOT NULL DEFAULT ""',
      email: 'TEXT NOT NULL',
      phone: 'TEXT NOT NULL DEFAULT ""',
      role: "TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','gastro','admin'))",
      placeId: 'TEXT',
      mustChangePassword: 'INTEGER NOT NULL DEFAULT 0',
      private: 'INTEGER NOT NULL DEFAULT 1',
      joined: 'TEXT NOT NULL DEFAULT ""',
      bio: 'TEXT NOT NULL DEFAULT ""',
      website: 'TEXT NOT NULL DEFAULT ""',
      radius: 'INTEGER NOT NULL DEFAULT 5',
      status: "TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','warned','banned'))",
      reportCount: 'INTEGER NOT NULL DEFAULT 0',
      notify: 'TEXT NOT NULL DEFAULT "{}"',
      /* Verifizierung darf im MVP übersprungen werden — siehe domain/auth.js */
      emailVerified: 'INTEGER NOT NULL DEFAULT 0',
      phoneVerified: 'INTEGER NOT NULL DEFAULT 0',
      verificationSkipped: 'INTEGER NOT NULL DEFAULT 0',
    },
    schluessel: ['id'],
    json: ['notify'],
    bool: ['mustChangePassword', 'private', 'emailVerified', 'phoneVerified', 'verificationSkipped'],
    indizes: [
      /* Anmeldung sucht über beides — deshalb eindeutig und indiziert. */
      { spalten: ['email'], eindeutig: true },
      { spalten: ['username'], eindeutig: true },
      { spalten: ['role'] },
    ],
  },

  /* ── Betriebe ───────────────────────────────────────────────────────── */
  places: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      slug: 'TEXT NOT NULL',
      name: 'TEXT NOT NULL',
      osmId: 'TEXT',
      cuisine: 'TEXT NOT NULL DEFAULT ""',
      price: 'TEXT NOT NULL DEFAULT "€"',
      category: 'TEXT NOT NULL DEFAULT "sonstiges"',
      lat: 'REAL NOT NULL',
      lng: 'REAL NOT NULL',
      address: 'TEXT NOT NULL DEFAULT ""',
      zip: 'TEXT NOT NULL DEFAULT ""',
      city: 'TEXT NOT NULL DEFAULT ""',
      country: 'TEXT NOT NULL DEFAULT ""',
      region: 'TEXT NOT NULL DEFAULT ""',
      phone: 'TEXT NOT NULL DEFAULT ""',
      website: 'TEXT NOT NULL DEFAULT ""',
      description: 'TEXT NOT NULL DEFAULT ""',
      menuNote: 'TEXT NOT NULL DEFAULT ""',
      claimStatus: 'TEXT NOT NULL DEFAULT "unclaimed"',
      claimedBy: 'TEXT',
      status: 'TEXT NOT NULL DEFAULT "active"',
      closingSince: 'TEXT',
      hasCover: 'INTEGER NOT NULL DEFAULT 0',
      /* Titelbild: Adresse, Urheber, Lizenz — alles drei oder nichts. */
      bildUrl: 'TEXT',
      bildQuelle: 'TEXT',
      bildLizenz: 'TEXT',
      /* Woher die Beschreibung stammt (src/data/anreicherung.js). */
      quelleUrl: 'TEXT',
      quelleStand: 'TEXT',
      tags: 'TEXT NOT NULL DEFAULT "[]"',
      serving: 'TEXT NOT NULL DEFAULT "[]"',
      features: 'TEXT NOT NULL DEFAULT "[]"',
      hours: 'TEXT',
    },
    schluessel: ['id'],
    json: ['tags', 'serving', 'features', 'hours'],
    bool: ['hasCover'],
    indizes: [
      { spalten: ['slug'], eindeutig: true },
      /* Die Kartenabfrage schneidet ein Rechteck aus — dafür beide Achsen. */
      { spalten: ['lat', 'lng'] },
      { spalten: ['region'] },
      { spalten: ['category'] },
    ],
  },

  /* ── Speisekarte ────────────────────────────────────────────────────── */
  menuCategories: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      placeId: 'TEXT NOT NULL',
      name: 'TEXT NOT NULL',
      description: 'TEXT NOT NULL DEFAULT ""',
      sort: 'INTEGER NOT NULL DEFAULT 0',
    },
    schluessel: ['id'],
    indizes: [{ spalten: ['placeId'] }],
  },

  dishes: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      placeId: 'TEXT NOT NULL',
      categoryId: 'TEXT NOT NULL',
      name: 'TEXT NOT NULL',
      description: 'TEXT NOT NULL DEFAULT ""',
      priceCents: 'INTEGER NOT NULL DEFAULT 0',
      spicy: 'INTEGER NOT NULL DEFAULT 0',
      popular: 'INTEGER NOT NULL DEFAULT 0',
      available: 'INTEGER NOT NULL DEFAULT 1',
      confirmed: 'INTEGER NOT NULL DEFAULT 0',
      sort: 'INTEGER NOT NULL DEFAULT 0',
      diet: 'TEXT NOT NULL DEFAULT "[]"',
      allergens: 'TEXT NOT NULL DEFAULT "[]"',
    },
    schluessel: ['id'],
    json: ['diet', 'allergens'],
    bool: ['popular', 'available', 'confirmed'],
    indizes: [{ spalten: ['placeId'] }, { spalten: ['categoryId'] }],
  },

  /* ── Beiträge ───────────────────────────────────────────────────────── */
  videos: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      placeId: 'TEXT NOT NULL',
      authorId: 'TEXT',
      authorType: 'TEXT NOT NULL DEFAULT "user"',
      caption: 'TEXT NOT NULL DEFAULT ""',
      views: 'INTEGER NOT NULL DEFAULT 0',
      durationSec: 'INTEGER NOT NULL DEFAULT 0',
      verifiedOnSite: 'INTEGER NOT NULL DEFAULT 0',
      visibility: 'TEXT NOT NULL DEFAULT "public"',
      status: 'TEXT NOT NULL DEFAULT "pending_review"',
      rejectReason: 'TEXT',
      createdAt: 'TEXT NOT NULL DEFAULT ""',
    },
    schluessel: ['id'],
    bool: ['verifiedOnSite'],
    indizes: [{ spalten: ['placeId'] }, { spalten: ['authorId'] }, { spalten: ['status'] }],
  },

  reviews: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      videoId: 'TEXT',
      placeId: 'TEXT NOT NULL',
      authorId: 'TEXT',
      createdAt: 'TEXT NOT NULL DEFAULT ""',
      verifiedOnSite: 'INTEGER NOT NULL DEFAULT 0',
      /* Drei Achsen, nie zu einer Zahl zusammengefasst — siehe domain/derive.js */
      ratingFood: 'INTEGER',
      ratingService: 'INTEGER',
      ratingPrice: 'INTEGER',
      groupSize: 'INTEGER',
      foodHot: 'INTEGER',
      text: 'TEXT NOT NULL DEFAULT ""',
      likes: 'INTEGER NOT NULL DEFAULT 0',
      anonymized: 'INTEGER NOT NULL DEFAULT 0',
      dishes: 'TEXT NOT NULL DEFAULT "[]"',
      answer: 'TEXT',
    },
    schluessel: ['id'],
    json: ['dishes', 'answer'],
    bool: ['verifiedOnSite', 'anonymized', 'foodHot'],
    indizes: [{ spalten: ['placeId'] }, { spalten: ['authorId'] }, { spalten: ['videoId'] }],
  },

  /* ── Beziehungen ────────────────────────────────────────────────────── */
  follows: {
    spalten: {
      followerId: 'TEXT NOT NULL',
      followingId: 'TEXT NOT NULL',
      status: 'TEXT NOT NULL DEFAULT "pending"',
    },
    schluessel: ['followerId', 'followingId'],
    indizes: [{ spalten: ['followingId'] }],
  },

  likes: {
    spalten: {
      userId: 'TEXT NOT NULL',
      videoId: 'TEXT NOT NULL',
    },
    schluessel: ['userId', 'videoId'],
    indizes: [{ spalten: ['videoId'] }],
  },

  saves: {
    spalten: {
      userId: 'TEXT NOT NULL',
      type: 'TEXT NOT NULL',
      targetId: 'TEXT NOT NULL',
    },
    schluessel: ['userId', 'type', 'targetId'],
    indizes: [{ spalten: ['userId'] }],
  },

  /* ── Betrieb der Anwendung ──────────────────────────────────────────── */
  notifications: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      userId: 'TEXT NOT NULL',
      type: 'TEXT NOT NULL',
      actor: 'TEXT',
      text: 'TEXT NOT NULL DEFAULT ""',
      createdAt: 'TEXT NOT NULL DEFAULT ""',
      unread: 'INTEGER NOT NULL DEFAULT 1',
      link: 'TEXT',
    },
    schluessel: ['id'],
    bool: ['unread'],
    indizes: [{ spalten: ['userId'] }],
  },

  reports: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      createdAt: 'TEXT NOT NULL DEFAULT ""',
      reporterId: 'TEXT',
      targetType: 'TEXT NOT NULL',
      targetId: 'TEXT NOT NULL',
      label: 'TEXT NOT NULL DEFAULT ""',
      reason: 'TEXT NOT NULL DEFAULT ""',
      note: 'TEXT NOT NULL DEFAULT ""',
      count: 'INTEGER NOT NULL DEFAULT 1',
      status: 'TEXT NOT NULL DEFAULT "open"',
      handledBy: 'TEXT',
    },
    schluessel: ['id'],
    indizes: [{ spalten: ['status'] }, { spalten: ['targetType', 'targetId'] }],
  },

  invites: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      placeId: 'TEXT',
      email: 'TEXT NOT NULL DEFAULT ""',
      sentAt: 'TEXT NOT NULL DEFAULT ""',
      status: 'TEXT NOT NULL DEFAULT "sent"',
    },
    schluessel: ['id'],
  },

  suggestions: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      name: 'TEXT NOT NULL DEFAULT ""',
      address: 'TEXT NOT NULL DEFAULT ""',
      type: 'TEXT NOT NULL DEFAULT ""',
      reportedBy: 'TEXT',
      createdAt: 'TEXT NOT NULL DEFAULT ""',
      status: 'TEXT NOT NULL DEFAULT "open"',
    },
    schluessel: ['id'],
  },

  auditLog: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      at: 'TEXT NOT NULL DEFAULT ""',
      admin: 'TEXT NOT NULL DEFAULT ""',
      action: 'TEXT NOT NULL DEFAULT ""',
      object: 'TEXT NOT NULL DEFAULT ""',
      note: 'TEXT NOT NULL DEFAULT ""',
    },
    schluessel: ['id'],
  },

  locations: {
    spalten: {
      id: 'TEXT PRIMARY KEY',
      name: 'TEXT NOT NULL',
      detail: 'TEXT NOT NULL DEFAULT ""',
      lat: 'REAL NOT NULL',
      lng: 'REAL NOT NULL',
    },
    schluessel: ['id'],
  },
}

/**
 * Felder, die keine Tabelle sind, sondern eine Liste von Texten:
 * `searchHistory`, `searchPopular`, `seenVideos`.
 *
 * Sie stehen zusammen in `listen(name, position, wert)`. Eine eigene Tabelle
 * je Liste wäre drei Tabellen mit je einer Spalte — das ist kein Gewinn.
 */
export const LISTEN = ['seenVideos', 'searchHistory', 'searchPopular']

/** Alle Namen, die im Datenbestand vorkommen dürfen. */
export const BEREICHE = [...Object.keys(TABELLEN), ...LISTEN]
