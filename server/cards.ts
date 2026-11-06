import { randomInt } from 'node:crypto';
import type {
  CardCategory,
  CardView,
  DeckKind,
  Suit,
} from '../src/shared/types.js';
import { GENERAL_BLUEPRINTS } from './generals.js';

export type Card = CardView;

interface NormalBlueprint {
  name: string;
  category: Exclude<CardCategory, 'general'>;
  count: number;
}

const SUITS: Suit[] = ['spade', 'heart', 'club', 'diamond'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const NORMAL_BLUEPRINTS: NormalBlueprint[] = [
  { name: '杀', category: 'basic', count: 25 },
  { name: '闪', category: 'basic', count: 15 },
  { name: '桃', category: 'basic', count: 8 },
  { name: '决斗', category: 'trick', count: 3 },
  { name: '过河拆桥', category: 'trick', count: 4 },
  { name: '顺手牵羊', category: 'trick', count: 3 },
  { name: '无中生有', category: 'trick', count: 3 },
  { name: '借刀杀人', category: 'trick', count: 2 },
  { name: '无懈可击', category: 'trick', count: 5 },
  { name: '南蛮入侵', category: 'trick', count: 2 },
  { name: '万箭齐发', category: 'trick', count: 1 },
  { name: '桃园结义', category: 'trick', count: 1 },
  { name: '五谷丰登', category: 'trick', count: 2 },
  { name: '乐不思蜀', category: 'trick', count: 3 },
  { name: '闪电', category: 'trick', count: 2 },
  { name: '兵粮寸断', category: 'trick', count: 2 },
  { name: '铁索连环', category: 'trick', count: 4 },
  { name: '火攻', category: 'trick', count: 2 },
  { name: '诸葛连弩', category: 'equipment', count: 1 },
  { name: '青釭剑', category: 'equipment', count: 1 },
  { name: '雌雄双股剑', category: 'equipment', count: 1 },
  { name: '青龙偃月刀', category: 'equipment', count: 1 },
  { name: '丈八蛇矛', category: 'equipment', count: 1 },
  { name: '方天画戟', category: 'equipment', count: 1 },
  { name: '麒麟弓', category: 'equipment', count: 1 },
  { name: '贯石斧', category: 'equipment', count: 1 },
  { name: '寒冰剑', category: 'equipment', count: 1 },
  { name: '朱雀羽扇', category: 'equipment', count: 1 },
  { name: '八卦阵', category: 'equipment', count: 2 },
  { name: '仁王盾', category: 'equipment', count: 1 },
  { name: '藤甲', category: 'equipment', count: 1 },
  { name: '白银狮子', category: 'equipment', count: 1 },
  { name: '的卢', category: 'equipment', count: 1 },
  { name: '赤兔', category: 'equipment', count: 1 },
  { name: '爪黄飞电', category: 'equipment', count: 1 },
  { name: '绝影', category: 'equipment', count: 1 },
  { name: '大宛', category: 'equipment', count: 1 },
  { name: '紫骍', category: 'equipment', count: 1 },
];


export function createCards(): {
  cards: Map<string, Card>;
  decks: Record<DeckKind, string[]>;
} {
  const cards = new Map<string, Card>();
  const normalIds: string[] = [];
  const generalIds: string[] = [];

  let normalIndex = 0;
  for (const blueprint of NORMAL_BLUEPRINTS) {
    for (let copy = 0; copy < blueprint.count; copy += 1) {
      const id = `n-${String(normalIndex + 1).padStart(3, '0')}`;
      const card: Card = {
        id,
        deck: 'normal',
        name: blueprint.name,
        category: blueprint.category,
        suit: SUITS[(normalIndex * 3 + 1) % SUITS.length],
        rank: RANKS[(normalIndex * 7 + 2) % RANKS.length],
      };
      cards.set(id, card);
      normalIds.push(id);
      normalIndex += 1;
    }
  }

  GENERAL_BLUEPRINTS.forEach((blueprint, index) => {
    const id = `g-${String(index + 1).padStart(3, '0')}`;
    const card: Card = {
      id,
      deck: 'general',
      name: blueprint.name,
      category: 'general',
      kingdom: blueprint.kingdom,
      hp: blueprint.hp,
      skills: blueprint.skills,
      image: `/hero/${encodeURIComponent(blueprint.name)}.jpg`,
    };
    cards.set(id, card);
    generalIds.push(id);
  });

  shuffleInPlace(normalIds);
  shuffleInPlace(generalIds);

  return {
    cards,
    decks: { normal: normalIds, general: generalIds },
  };
}

export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function toCardView(card: Card): CardView {
  return { ...card };
}
