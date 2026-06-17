const FLAVOR_MAP: Array<{ keywords: string[]; flavor: string }> = [
  { keywords: ['lemon', 'lime', 'limón', 'orange', 'naranja', 'ponzu', 'yuzu'], flavor: 'bright' },
  { keywords: ['soy', 'miso', 'fish sauce', 'parmesan', 'anchovy', 'mushroom', 'tamari'], flavor: 'umami' },
  { keywords: ['honey', 'teriyaki', 'mango', 'coconut', 'maple', 'dates'], flavor: 'sweet' },
  { keywords: ['chili', 'jalapeño', 'sriracha', 'gochujang', 'harissa', 'cayenne'], flavor: 'spicy' },
  { keywords: ['garlic', 'onion', 'ajo', 'cebolla', 'shallot'], flavor: 'aromatic' },
  { keywords: ['cream', 'coconut milk', 'butter', 'tahini'], flavor: 'rich' },
  { keywords: ['tomato', 'vinegar', 'tamarind', 'pomegranate'], flavor: 'tangy' },
  { keywords: ['cumin', 'coriander', 'cinnamon', 'cardamom', 'turmeric'], flavor: 'warm' },
];

export function predictFlavors(ingredientNames: string[]): string[] {
  const lower = ingredientNames.map(n => n.toLowerCase());
  const result: string[] = [];
  for (const entry of FLAVOR_MAP) {
    if (entry.keywords.some(k => lower.some(n => n.includes(k)))) {
      if (!result.includes(entry.flavor)) result.push(entry.flavor);
    }
  }
  return result.slice(0, 3);
}
