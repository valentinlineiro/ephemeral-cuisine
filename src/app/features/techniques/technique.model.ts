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
