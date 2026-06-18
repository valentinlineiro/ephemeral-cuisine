# Ephemeral Cuisine — Personal Culinary Optimizer

**Date:** 2026-06-16  
**Status:** Vision document  
**Scope:** Full product design for a multi-constraint personal cooking assistant

---

## 1. Product Statement

A personal culinary optimizer that learns how you cook, who you cook for, and what your body needs — then suggests the best thing to make tonight given what's available. It optimizes for novelty, health, efficiency, and mastery simultaneously.

Generic apps optimize for browsing. This app optimizes for **decision-making under constraints**. The fewer options shown, the better.

---

## 2. User Profile

| Trait | Detail |
|---|---|
| Cooking style | Experimental — loves new ingredients, cuisines, techniques |
| Core drive | Never repeat the same combination of flavors |
| Health | High blood pressure (needs sodium tracking) |
| Partner | Gluten-free + lactose-free |
| Goal | Get fit together — auto-calorie/macro counting |
| Audience | Cooks for self, partner, and extended family (both sides) |
| Efficiency pain | Throws away ingredients every week |
| Mastery drive | Perfects techniques over repeated cooks |
| Exploration style | Follows exactly first time, modifies on subsequent cooks |
| Approach to recipes | Starts with the technique, varies the combination |

The app is for one user who cooks for multiple people. Not multi-user — one user with a dietary context.

---

## 3. Core Model

A recipe is not a static document. It is a **technique template + combination log**.

### 3.1 Technique (the "how")

Base procedure that can be varied infinitely:

```json
{
  "id": "sushi-roll",
  "name": "Sushi roll",
  "base_steps": [
    { "order": 1, "text": "Cook and season sushi rice" },
    { "order": 2, "text": "Prepare filling ingredients" },
    { "order": 3, "text": "Roll with nori" },
    { "order": 4, "text": "Slice and plate" }
  ],
  "equipment": ["bamboo_mat", "sharp_knife"],
  "skill_level": "intermediate",
  "default_servings": 2
}
```

### 3.2 Combination (the "what")

What varies per cook:

```json
{
  "technique_id": "sushi-roll",
  "date": "2026-06-10",
  "combo": {
    "protein": "salmon",
    "produce": ["mango", "avocado"],
    "seasoning": "ponzu"
  },
  "ratings": {
    "self": 8,
    "partner": 9,
    "mom": 7
  },
  "notes": "Too much soy — BP was high after",
  "modifications": ["tamari sub for soy"],
  "nutrition": { "calories": 420, "sodium_mg": 480, "protein_g": 32 },
  "family_present": ["partner", "mom"],
  "leftovers": { "remaining_g": 200, "suggested_use": "salmon rice bowl" }
}
```

### 3.3 Dietary profile

```json
{
  "owner": {
    "max_sodium_mg_per_day": 1500,
    "calorie_target": 2200,
    "protein_target_g": 120
  },
  "partner": {
    "gluten_free": true,
    "lactose_free": true,
    "preferences": {
      "dislikes": ["mushrooms", "cilantro"]
    }
  }
}
```

### 3.4 Equipment inventory

```json
["oven", "microwave", "hand_mixer", "bamboo_mat", "air_fryer", "sharp_knife"]
```

---

## 4. The Constraint Matrix

Every suggestion is the result of solving:

| Constraint | Weight | Source |
|---|---|---|
| Novelty | High | Never repeat same (technique + combo) pair |
| Health | High | Sodium ≤ daily budget, GF/DF safe for partner |
| Fitness | Medium | Calories + macros per serving |
| Inventory | High | What's in the fridge, what expires soonest |
| Expiry | High | "This cilantro goes bad tomorrow" |
| Technique mastery | Medium | "You're great at stir-fry (A-), weak at baking (C)" |
| Past feedback | Medium | "Your family rated pork 7/10, chicken 9/10" |
| Diet gap | Low | "You haven't had omega-3s this week" |
| Effort | Low | "You're tired — 20 min recipe" |
| Equipment gap | High | "You don't have a stand mixer — skip this dessert" |

### Output format

One recommendation:

> *"You have chicken thighs, yogurt, and cilantro expiring today. You know stir-fry (B+) and roasting (A-). Last time you made stir-fry, your partner said it was salty. Go with yogurt-marinated chicken skewers — 320 cal, 480mg sodium, GF/DF. Your mom rates your grilled chicken 9/10."*

---

## 5. Features

### 5.1 Tier 1 — Core Loop

| Feature | Description |
|---|---|
| **Inventory** | Log what you buy (barcode scan + manual). Quantity + expiry date. Deducts when you cook. |
| **Technique library** | Define techniques you know. Each has base steps + required equipment. |
| **Combination logger** | Every cook logs protein + produce + seasoning used. Tags that combo as "done" for that technique. |
| **Constraint suggestion** | Given inventory + never-done combos + health profile → suggests one dish. |
| **Expiry alerts** | "Your cilantro expires tomorrow — make this cilantro-lime chicken." |
| **Per-cook feedback** | Rating, notes, modifications logged after every cook. |

### 5.2 Tier 2 — Health & Fitness

| Feature | Description |
|---|---|
| **Sodium tracking** | Per-serving estimate, daily budget, per-meal breakdown. Color-coded everywhere (green/yellow/red). |
| **Calorie/macro estimation** | Calculated from ingredients + portions. |
| **GF/DF auto-substitution** | When partner is eating, globally swaps ingredients (soy → tamari, cream → cashew cream). |
| **Weekly health summary** | "This week: avg 1400mg sodium/day, 2200 cal/day. Protein target hit 4/7 days." |

### 5.3 Tier 3 — Mastery & Sharing

| Feature | Description |
|---|---|
| **Hall of Fame (Rankings)** | Best dishes overall, by audience, by technique, most improved. |
| **Technique mastery score** | A-F grade based on cook count + average rating per technique. |
| **My version** | Auto-merges notes + modifications into a living personal recipe. |
| **Family feedback** | Quick rating widget after each cook — separate responses from you, partner, family. |
| **Recipe export** | Clean recipe card from any "my version" to share. |

### 5.4 Tier 4 — Efficiency

| Feature | Description |
|---|---|
| **Batch mode** | "Double the rice — leftovers for fried rice tomorrow." |
| **Clean-as-you-go steps** | Cooking mode inserts "meanwhile, wash the cutting board" during inactive time. |
| **Leftover blueprint** | After logging cook, suggests: "leftover salmon? Salmon rice bowls tomorrow." |
| **Shopping gap** | "You're only missing one ingredient to make this." |
| **Multi-dish timeline** | Sequences multiple dishes to finish at the same time. |

---

## 6. The 10 Ideas

Originally discussed as specific to this user's psychology:

| # | Idea | Description |
|---|---|---|
| 1 | **Substitution intelligence** | Pre-suggest subs before cooking: "Swap avocado for mango — you rated mango higher in past fruit+salmon combos." |
| 2 | **Flavor diversity dashboard** | "You've used citrus 8× this month, warm spices 0×. Try something with cardamom." Prevents flavor ruts. |
| 3 | **Dessert improvement bootcamp** | Structured path by equipment level. Tier 1: no equipment (panna cotta). Tier 2: oven + hand mixer. Tier 3: stand mixer. Unlock by mastering previous tier. |
| 4 | **"What if I swap X?" calculator** | "Chicken breast instead of thighs? → -120 cal, -5g fat, +3 min cook, slightly drier." One tap recalculates. |
| 5 | **Menu → Inspiration** | Snap a restaurant menu → OCR extracts dishes → cross-references your technique library. "You can make 3 of these. Here's how to adapt the others with your equipment." |
| 6 | **Family preference memory** | Partner hates mushrooms. Mom loves spicy. When you log who's eating, suggestion weights shift automatically. |
| 7 | **New ingredient onboarding** | First time you log sumac → app teaches usage, best pairings, beginner recipe. Lowers barrier to using exotic buys. |
| 8 | **Mood-aware suggestion** | "I want comfort" → past high-rated dishes. "I want adventure" → highest novelty. "I want to impress" → family's top-rated. |
| 9 | **Progressive complexity ladder** | Each technique silently increases difficulty on repeat cooks. Panna cotta → layer cake → laminated dough. |
| 10 | **Waste prediction** | Not just alerts — behavior insight: "You buy cilantro every 14 days but only use 60%. Buy less." |
| 11 | **"What's my current trend?" dashboard** | "Last 8 cooks: Thai-heavy, no desserts in 3 weeks. Your partner rated all Thai 8+. You're in a groove." |
| 12 | **Prep debt calculator** | "Chopping: 5 min. Marinating: 10 active. Total active: 22 min. 8 min to wash dishes while sauce simmers." |
| 13 | **Flavor outcome prediction** | Before cooking: "This will be bright + savory + slightly sweet. Similar to Thai basil chicken you rated 9/10." |
| 14 | **Predictive combo rating** | "You'll rate this 8.5/10 based on history with similar pairings." Limited cooks on high-probability thrillers. |
| 15 | **Multi-dish timeline** | Sequences dishes to finish together. "Start rice 6:45, chicken 7:00, salad 7:15. Everything ready 7:30." |
| 16 | **Leftover blueprint** | "300g chicken used out of 600g. Tomorrow: chicken salad + cucumber. Add 2 min." |
| 17 | **Cooking confidence score** | Per technique: "Stir-fry B+ (12 cooks, avg 7.8). Baking C- (2 cooks, avg 5). Next dessert improves baking more." |

---

## 7. UX Design

### 7.1 Navigation

| Tab | Content |
|---|---|
| **Tonight** | One suggestion based on constraints. Expiry alerts. Low inventory warnings. |
| **Ranking** | Hall of Fame — best dishes overall, by audience, by technique, most improved. |
| **Inventario** | What you have, what expires, what's missing. Kitchen equipment list. |
| **Técnicas** | Your skills library. Each technique shows mastery score, cook count, avg rating, recent combos. |
| **Ajustes** | Health targets, dietary profile, equipment inventory. |

### 7.2 "Tonight" screen (primary landing)

```
┌─────────────────────────────────────┐
│  🌙 Tonight                         │
│                                     │
│  🔴 Cilantro expires tomorrow       │
│  🟡 Low on protein (only chicken)   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Suggested: Chicken tagine    │    │
│  │ New combo · 430mg · GF ✓    │    │
│  │ Partner's last rating: 9/10 │    │
│  │                              │    │
│  │  [Cook]  [Not tonight]       │    │
│  └─────────────────────────────┘    │
│                                     │
│  See other options →                │
└─────────────────────────────────────┘
```

One recommendation. If user wants more, secondary view shows alternatives ranked.

### 7.3 Ranking screen (Hall of Fame)

```
┌─────────────────────────────────────┐
│  🏆 My Best Dishes                  │
│                                     │
│  OVERALL                            │
│  1. Salmon + Mango Sushi      ⭐ 9.2│
│  2. Chicken Tagine            ⭐ 8.9│
│  3. Pasta al Limone           ⭐ 8.7│
│                                     │
│  BY AUDIENCE                        │
│  Partner ❤️: Salmon Sushi (9.5)     │
│  Mom ❤️: Chicken Tagine (9.0)       │
│                                     │
│  BY TECHNIQUE                       │
│  Sushi: Salmon Mango (9.2)          │
│  Stir-fry: Thai Basil (8.5)         │
│  Tagine: Lamb Apricot (8.3)         │
│                                     │
│  MOST IMPROVED 📈                   │
│  Omelette: 5.0 → 8.0 (8 cooks)     │
│                                     │
│  WORTH REPEATING                    │
│  (rated 9+ but only made once)      │
└─────────────────────────────────────┘
```

### 7.4 Recipe detail screen

```
┌─────────────────────────────────────┐
│  ← Back                             │
│                                     │
│  Salmon + Mango Sushi               │
│  8th sushi cook · 1st time combo    │
│                                     │
│  Health                             │
│  Sodium: 480mg 🟢  ·  Cal: 420      │
│  GF ✓  ·  DF ✓                     │
│                                     │
│  🎯 Equipment: requires bamboo mat  │
│  ✅ You have it                      │
│                                     │
│  Past performance                   │
│  ⭐ 9.2 avg · Partner: 9.5 · Mom: 8 │
│                                     │
│  Technique: sushi rolling           │
│  Mastery: A- (12 cooks)             │
│                                     │
│  Ingredients (for this combo)       │
│  ...                                │
│                                     │
│  Steps                              │
│  ...                                │
│                                     │
│  [Cook]                             │
└─────────────────────────────────────┘
```

Health signals are visible at all times via color:
- Green 🟢 = within healthy range
- Yellow 🟡 = approaching limit
- Red 🔴 = exceeds daily budget

Novelty signal: sparkle ✨ on never-tried combinations.  
Equipment gap: ⚠️ warning when suggestion requires gear you don't own.

### 7.5 Post-cook flow (mandatory, single-swipe)

After tapping "I cooked this":

```
┌─────────────────────────────────────┐
│  Great! How did it go?              │
│                                     │
│  Your rating: ⭐⭐⭐⭐⭐⭐☆☆☆☆       │
│                                     │
│  Partner's rating: ⭐⭐⭐⭐⭐☆☆☆☆☆   │
│                                     │
│  Who ate?                           │
│  [Me] [Partner] [Mom] [Other...]   │
│                                     │
│  Modifications?                     │
│  [None] [Had to sub ___]           │
│                                     │
│  Notes                              │
│  "Add more garlic next time"        │
│                                     │
│  Ingredients used?                  │
│  [Auto-detected] [Adjust]          │
│                                     │
│  Leftover ingredients?              │
│  [300g chicken remaining]          │
│                                     │
│  [Save]                             │
└─────────────────────────────────────┘
```

One swipe. Not a multi-page form.

### 7.6 Cooking mode

For this user specifically:
- Shows "meanwhile" efficiency hints (clean the pan, prep next ingredient)
- Displays health info for the current dish
- At end: "You used 300g of 600g chicken. Plan: chicken salad tomorrow."
- First cook on a technique: exact mode only
- Second cook onward: unlocks "my version" editing (swap ingredients)

### 7.7 Post-cook "Leftover blueprint"

Automatically generated after logging:
> *"Leftover salmon + rice? Tomorrow: salmon rice bowls with cucumber + lime. Add 2 min. 340 cal, 380mg sodium, GF/DF."*

---

## 8. Equipment Gap Detection

When a recipe is suggested, the app compares:

```
recipe.equipment_required - user.equipment_owned
```

If non-empty:

```
⚠️ Necesitas: batidora de pie
This recipe requires a stand mixer. You don't have one.
Alternatives: try this no-mixer dessert instead.
```

Stored as `equipment text[]` on the `users` table. Set in Ajustes as a toggle grid.

---

## 9. Schema Evolution (v2 additions)

Beyond the v1 schema, v2 adds:

### cooked_versions

```sql
CREATE TABLE cooked_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id    uuid REFERENCES recipes(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  cooked_at    timestamptz DEFAULT now(),
  combo        jsonb,  -- { protein, produce[], seasoning }
  ratings      jsonb,  -- { self: 8, partner: 9, mom: 7 }
  notes        text,
  modifications text[],
  nutrition    jsonb,  -- { calories, sodium_mg, protein_g }
  family_present text[],
  technique_id uuid    -- optional, links to technique
);
```

### Users additions

```sql
ALTER TABLE users ADD COLUMN equipment text[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN dietary_profile jsonb;  -- { max_sodium, calorie_target, partner_gf, partner_df }
```

### Technique table (future)

```sql
CREATE TABLE techniques (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  base_steps  jsonb NOT NULL,
  equipment   text[] NOT NULL DEFAULT '{}',
  skill_level text
);
```

---

## 10. UX Principles

| Principle | Meaning |
|---|---|
| **One suggestion** | The optimizer outputs one dish. Secondary list is available but not primary. |
| **Health visible at all times** | Sodium/calories are never hidden — color-coded green/yellow/red on every screen. |
| **Novelty first** | ✨ sparkle on never-tried combos. Ranking defaults to "best never repeated." |
| **Mandatory post-cook** | App gets smarter only if you log. Single-swipe flow, not optional. |
| **Fewer options = better** | This is a decision-making tool, not a browsing catalog. |
| **Equipment-aware** | Never suggest something you can't cook. Warn before you discover the gap. |
| **Family-aware** | Suggest based on who's eating, not just what's available. |
| **Mastery grows** | Every cook is a data point. The app gets better with use. |

---

## 11. Phase Map

```
Phase 1 (MVP — current plan)
├── Import recipes (JSON/MD)
├── Full-text + ingredient search
├── Cooking mode with timers
├── i18n (es/en)
├── Auth + RLS
└── Basic feedback (cooked/not cooked)

Phase 2 (Inventory + Constraints)
├── Inventory management (log purchases, expiry, deduction)
├── Technique model (extracted from flat recipes)
├── Combination logger
├── Constraint suggestion engine (one dish output)
├── GF/DF substitution rules
├── Expiry alerts
├── Equipment gap detection
└── Post-cook mandatory flow

Phase 3 (Health)
├── Sodium tracking + daily budget
├── Calorie/macro estimation
├── Health summary dashboard
├── "What if I swap X?" calculator
├── Weekly fitness health summary
└── Color-coded health signals everywhere

Phase 4 (Inspiration)
├── Menu → Inspiration (OCR + technique matching)
├── Mood-aware suggestion (comfort / adventure / impress)
├── New ingredient onboarding
├── Flavor outcome prediction
├── "What's my current trend?" dashboard
├── Progressive complexity ladder per technique
├── Prep debt calculator
└── Flavor diversity dashboard

Phase 5 (Mastery + Social)
├── Hall of Fame / Ranking screen
├── Technique mastery scores (A-F)
├── Dessert improvement bootcamp
├── Predictive combo rating engine
├── "My version" auto-recipes
├── Family feedback widget
├── Waste prediction + behavior insight
├── Multi-dish timeline
├── Leftover blueprint
├── Cooking confidence score per technique
└── Recipe export / sharing
```

---

## 12. What Makes This Hard To Copy

- Constraint optimization is a combinatorial search problem, not a CRUD app
- Learning from feedback — the app gets better with every cook
- Personal health data — switching costs are high after 100 logged cooks
- Technique + combination model is not how any existing recipe app works
- One-user-multi-audience is the reality of home cooking, ignored by every recipe platform
- Predictive combo rating requires a data moat — 50+ logged cooks minimum

---

## 13. Open Questions

- How does the combination logger know what you used? Manual entry? Photo? Voice?
- Sodium tracking: USDA database lookup or user inputs per ingredient?
- Should barcode scan on purchase auto-populate nutritional data?
- How does the optimizer weigh constraints? User-configurable sliders?
- Technique mastery: auto-calculated (cook count + ratings) or user-declared?
- What's the minimum viable inventory to make suggestions useful? (5 items? 10?)
- How does the "one suggestion" handle user rejection? Simple skip, or does it learn why?

---

## 14. The Name

"Ephemeral Cuisine" fits — each combination is ephemeral. You try it, learn from it, and move on. The technique lives, the health data accumulates, the mastery grows. Only the single cook is gone.

If the name ever changes, alternatives:
- **Constraint Kitchen** — honest about what it does
- **The Next Cook** — forward-looking, optimistic
- **Solver** — short, tool-like
- **Efficient Plates** — both efficiency and health

---

*This is a living document. Updated as the product evolves beyond the initial import-based MVP.*
