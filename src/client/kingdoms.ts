import type { Kingdom } from '../shared/types';

export const KINGDOM_SLUG: Record<Kingdom, string> = {
  魏: 'wei',
  蜀: 'shu',
  吴: 'wu',
  群: 'qun',
  晋: 'jin',
};

export function kingdomClass(kingdom?: Kingdom): string {
  return kingdom ? `kingdom-${KINGDOM_SLUG[kingdom]}` : 'kingdom-none';
}
