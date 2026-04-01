export interface Housing {
  id: string;
  name: string;
  price: number;
  area: number;
  metroDistance: number;
  orientation: string;
  floor: string;
  decoration: string;
  facility: string;
  age: number;
}

export interface Constraint {
  id: string;
  name: string;
  type: 'hard' | 'soft';
  check: (housing: Housing) => boolean;
  description: string;
}

export interface Probe {
  type: 'active' | 'passive' | 'fallback';
  trigger: string;
  signal: string;
  dimensions: Dimension[];
  raw: string;
  timestamp: number;
}

export type Dimension =
  | 'FAA.Frame'
  | 'FAA.Ask'
  | 'FAA.Review'
  | 'FAA.Edit'
  | 'FAA.Synthesize'
  | 'MBTI.Relation'
  | 'MBTI.Workflow'
  | 'MBTI.Epistemic'
  | 'MBTI.RepairScope';

export interface FAAScore {
  frame: number;
  ask: number;
  review: number;
  edit: number;
  synthesize: number;
  total: number;
}

export interface MBTIScore {
  relation: number;
  workflow: number;
  epistemic: number;
  repairScope: number;
}

export interface Profile {
  summary: string;
  tags: string[];
}

export interface EvaluationResult {
  faa: FAAScore;
  mbti: MBTIScore;
  profile: Profile;
  decision: {
    choice: string;
    isOptimal: boolean;
  };
}

export type ConversationMessage = {
  role: 'agent' | 'user';
  content: string;
  timestamp: number;
};
