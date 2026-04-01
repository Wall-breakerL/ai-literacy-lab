import { Constraint } from '@/types';

export const HARD_CONSTRAINTS: Constraint[] = [
  {
    id: 'price',
    name: '价格',
    type: 'hard',
    description: '价格 ≤ 5500元/月',
    check: (housing) => housing.price <= 5500,
  },
];

export const SOFT_CONSTRAINTS: Constraint[] = [
  {
    id: 'metro',
    name: '交通',
    type: 'soft',
    description: '地铁 ≤ 600米',
    check: (housing) => housing.metroDistance <= 600,
  },
  {
    id: 'area',
    name: '面积',
    type: 'soft',
    description: '面积 ≥ 60㎡',
    check: (housing) => housing.area >= 60,
  },
  {
    id: 'decoration',
    name: '装修',
    type: 'soft',
    description: '简装或精装',
    check: (housing) => housing.decoration === '精装' || housing.decoration === '简装',
  },
  {
    id: 'age',
    name: '房龄',
    type: 'soft',
    description: '房龄 ≤ 15年',
    check: (housing) => housing.age <= 15,
  },
  {
    id: 'floor',
    name: '楼层',
    type: 'soft',
    description: '中高层',
    check: (housing) => housing.floor.includes('中层') || housing.floor.includes('高层'),
  },
];

export const ALL_CONSTRAINTS = [...HARD_CONSTRAINTS, ...SOFT_CONSTRAINTS];

export function checkConstraint(housing: any, constraint: Constraint): boolean {
  return constraint.check(housing);
}

export function getViolatedSoftConstraints(housing: any): string[] {
  return SOFT_CONSTRAINTS
    .filter((c) => !c.check(housing))
    .map((c) => c.name);
}
