export const TOTAL_ROOMS = 8;
export const ROOMS = [
  { id: 1, name: 'Sunflower', description: 'Warm tones with olive wood accents', price: 120, capacity: { adults: 2, children: 1 } },
  { id: 2, name: 'Lily', description: 'Sun-drenched citrus palette', price: 135, capacity: { adults: 3, children: 1 } },
  { id: 3, name: 'Marigold', description: 'Earthy sage and linen textures', price: 110, capacity: { adults: 2, children: 0 } },
  { id: 4, name: 'Lavender', description: 'Rich clay and rustic warmth', price: 145, capacity: { adults: 2, children: 0 } },
  { id: 5, name: 'Dahlia', description: 'Soft lavender and white stone', price: 130, capacity: { adults: 2, children: 0 } },
  { id: 6, name: 'Gardenia', description: 'Deep greens with cypress views', price: 140, capacity: { adults: 2, children: 0 } },
  { id: 7, name: 'Petunia', description: 'Vineyard-facing with wood beams', price: 155, capacity: { adults: 7, children: 0 } },
  { id: 8, name: 'Gardenia', description: 'West-facing sunset panorama', price: 160, capacity: { adults: 7, children: 0 } }
];
export const SESSION_CONFIG = {
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
};
