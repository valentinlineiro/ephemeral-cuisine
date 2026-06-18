export interface TechniqueStep {
  order: number;
  text: string;
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type MasteryGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';

export interface Technique {
  id: string;
  user_id: string;
  name: string;
  base_steps: TechniqueStep[];
  equipment: string[];
  skill_level: SkillLevel;
  created_at: string;
}

export interface TechniqueWithStats extends Technique {
  cook_count: number;
  avg_rating: number;
  mastery: MasteryGrade;
}

export function calcMastery(cook_count: number, avg_rating: number): MasteryGrade {
  if (cook_count === 0) return 'F';
  if (cook_count < 2) return 'D';
  if (cook_count < 5) {
    if (avg_rating >= 8) return 'C+';
    if (avg_rating >= 6) return 'C';
    return 'C-';
  }
  if (cook_count < 10) {
    if (avg_rating >= 9) return 'B+';
    if (avg_rating >= 7) return 'B';
    return 'B-';
  }
  if (avg_rating >= 9.5) return 'A+';
  if (avg_rating >= 8.5) return 'A';
  return 'A-';
}

export const MASTERY_COLOR: Record<MasteryGrade, string> = {
  'A+': 'text-green-700', 'A': 'text-green-600', 'A-': 'text-green-500',
  'B+': 'text-blue-600', 'B': 'text-blue-500', 'B-': 'text-blue-400',
  'C+': 'text-yellow-600', 'C': 'text-yellow-500', 'C-': 'text-yellow-400',
  'D': 'text-orange-500', 'F': 'text-red-500',
};

const NUDGE_GRADES = new Set<MasteryGrade>(['B+', 'A-', 'A', 'A+']);

const NEXT_STEP_TABLE: Array<{ keyword: string; next: string }> = [
  { keyword: 'stir-fry',  next: 'Wok hei technique' },
  { keyword: 'sushi',     next: 'Inside-out roll (uramaki)' },
  { keyword: 'pasta',     next: 'Fresh pasta from scratch' },
  { keyword: 'roast',     next: 'Spatchcock & dry brine' },
  { keyword: 'grill',     next: 'Reverse sear' },
  { keyword: 'baking',    next: 'Laminated dough' },
  { keyword: 'omelette',  next: 'French omelette' },
  { keyword: 'pan sauce', next: 'Beurre blanc' },
  { keyword: 'brais',     next: 'Pressure cooking' },
  { keyword: 'knife',     next: 'Brunoise & chiffonade' },
];

export function getNextStep(techniqueName: string, mastery: MasteryGrade): string | null {
  if (!NUDGE_GRADES.has(mastery)) return null;
  const lower = techniqueName.toLowerCase();
  return NEXT_STEP_TABLE.find(e => lower.includes(e.keyword))?.next ?? null;
}
