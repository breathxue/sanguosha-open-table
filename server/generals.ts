import type { Kingdom, SkillInfo } from '../src/shared/types';

export interface GeneralBlueprint {
  name: string;
  kingdom: Kingdom;
  hp: number;
  skills: SkillInfo[];
}

/**
 * 标准包 + 风林火山，共 57 名非神武将。
 * 技能文本采用经典版描述；牌桌本身不做任何技能结算。
 */
export const GENERAL_BLUEPRINTS: GeneralBlueprint[] = [
  // ------------------------------------------------------------------ 标准包
  {
    name: '曹操',
    kingdom: '魏',
    hp: 4,
    skills: [
      { name: '奸雄', description: '当你受到伤害后，你可以获得造成此伤害的牌。' },
      {
        name: '护驾',
        description:
          '当你需要使用或打出一张【闪】时，你可以令其他魏势力角色选择是否打出一张【闪】（视为由你使用或打出）。',
        tags: ['lord'],
      },
    ],
  },
  {
    name: '司马懿',
    kingdom: '魏',
    hp: 3,
    skills: [
      { name: '反馈', description: '当你受到伤害后，你可以获得伤害来源的一张牌。' },
      {
        name: '鬼才',
        description: '当一名角色的判定牌生效前，你可以打出一张手牌代替之。',
      },
    ],
  },
  {
    name: '夏侯惇',
    kingdom: '魏',
    hp: 4,
    skills: [
      {
        name: '刚烈',
        description:
          '当你受到伤害后，你可以进行判定，若结果不为红桃，伤害来源选择一项：弃置两张手牌，或受到你造成的1点伤害。',
      },
    ],
  },
  {
    name: '张辽',
    kingdom: '魏',
    hp: 4,
    skills: [
      {
        name: '突袭',
        description: '摸牌阶段，你可以放弃摸牌，然后获得至多两名其他角色各一张手牌。',
      },
    ],
  },
  {
    name: '许褚',
    kingdom: '魏',
    hp: 4,
    skills: [
      {
        name: '裸衣',
        description:
          '摸牌阶段，你可以少摸一张牌；若如此做，本回合你使用【杀】或【决斗】造成的伤害+1。',
      },
    ],
  },
  {
    name: '郭嘉',
    kingdom: '魏',
    hp: 3,
    skills: [
      { name: '天妒', description: '当你的判定牌生效后，你可以获得此牌。' },
      {
        name: '遗计',
        description: '当你受到1点伤害后，你可以摸两张牌，然后可以将这两张牌交给任意角色。',
      },
    ],
  },
  {
    name: '甄姬',
    kingdom: '魏',
    hp: 3,
    skills: [
      { name: '倾国', description: '你可以将一张黑色手牌当【闪】使用或打出。' },
      {
        name: '洛神',
        description:
          '准备阶段，你可以进行判定，若结果为黑色，你获得此牌，然后你可以重复此流程。',
      },
    ],
  },
  {
    name: '刘备',
    kingdom: '蜀',
    hp: 4,
    skills: [
      {
        name: '仁德',
        description:
          '出牌阶段，你可以将任意张手牌交给其他角色。若你于此阶段内给出的牌首次达到两张，你回复1点体力。',
      },
      {
        name: '激将',
        description:
          '当你需要使用或打出一张【杀】时，你可以令其他蜀势力角色选择是否打出一张【杀】（视为由你使用或打出）。',
        tags: ['lord'],
      },
    ],
  },
  {
    name: '关羽',
    kingdom: '蜀',
    hp: 4,
    skills: [{ name: '武圣', description: '你可以将一张红色牌当【杀】使用或打出。' }],
  },
  {
    name: '张飞',
    kingdom: '蜀',
    hp: 4,
    skills: [{ name: '咆哮', description: '你使用【杀】无次数限制。', tags: ['locked'] }],
  },
  {
    name: '赵云',
    kingdom: '蜀',
    hp: 4,
    skills: [
      {
        name: '龙胆',
        description: '你可以将一张【杀】当【闪】、一张【闪】当【杀】使用或打出。',
      },
    ],
  },
  {
    name: '马超',
    kingdom: '蜀',
    hp: 4,
    skills: [
      {
        name: '马术',
        description: '你计算与其他角色的距离-1。',
        tags: ['locked'],
      },
      {
        name: '铁骑',
        description:
          '当你使用【杀】指定目标后，你可以进行判定，若结果为红色，该角色不能使用【闪】响应此【杀】。',
      },
    ],
  },
  {
    name: '诸葛亮',
    kingdom: '蜀',
    hp: 3,
    skills: [
      {
        name: '观星',
        description:
          '准备阶段，你可以观看牌堆顶的X张牌（X为存活角色数且至多为5），然后以任意顺序放回牌堆顶或牌堆底。',
      },
      {
        name: '空城',
        description: '若你没有手牌，你不能成为【杀】或【决斗】的目标。',
        tags: ['locked'],
      },
    ],
  },
  {
    name: '黄月英',
    kingdom: '蜀',
    hp: 3,
    skills: [
      {
        name: '集智',
        description: '当你使用一张非延时类锦囊牌时，你可以摸一张牌。',
      },
      {
        name: '奇才',
        description: '你使用锦囊牌无距离限制。',
        tags: ['locked'],
      },
    ],
  },
  {
    name: '孙权',
    kingdom: '吴',
    hp: 4,
    skills: [
      {
        name: '制衡',
        description: '出牌阶段限一次，你可以弃置任意张牌，然后摸等量的牌。',
      },
      {
        name: '救援',
        description: '其他吴势力角色对你使用【桃】时，你额外回复1点体力。',
        tags: ['lord', 'locked'],
      },
    ],
  },
  {
    name: '甘宁',
    kingdom: '吴',
    hp: 4,
    skills: [{ name: '奇袭', description: '你可以将一张黑色牌当【过河拆桥】使用。' }],
  },
  {
    name: '吕蒙',
    kingdom: '吴',
    hp: 4,
    skills: [
      {
        name: '克己',
        description: '若你于出牌阶段内未使用或打出过【杀】，你可以跳过弃牌阶段。',
      },
    ],
  },
  {
    name: '黄盖',
    kingdom: '吴',
    hp: 4,
    skills: [
      {
        name: '苦肉',
        description: '出牌阶段，你可以失去1点体力，然后摸两张牌。',
      },
    ],
  },
  {
    name: '周瑜',
    kingdom: '吴',
    hp: 3,
    skills: [
      { name: '英姿', description: '摸牌阶段，你可以额外摸一张牌。' },
      {
        name: '反间',
        description:
          '出牌阶段限一次，你可以令一名其他角色选择一种花色，然后获得你的一张手牌并展示之。若此牌花色与其所选花色不同，你对其造成1点伤害。',
      },
    ],
  },
  {
    name: '大乔',
    kingdom: '吴',
    hp: 3,
    skills: [
      { name: '国色', description: '你可以将一张方块牌当【乐不思蜀】使用。' },
      {
        name: '流离',
        description:
          '当你成为【杀】的目标时，你可以弃置一张牌，然后将此【杀】转移给你攻击范围内的一名其他角色。',
      },
    ],
  },
  {
    name: '陆逊',
    kingdom: '吴',
    hp: 3,
    skills: [
      {
        name: '谦逊',
        description: '你不能成为【顺手牵羊】和【乐不思蜀】的目标。',
        tags: ['locked'],
      },
      {
        name: '连营',
        description: '当你失去最后的手牌后，你可以摸一张牌。',
      },
    ],
  },
  {
    name: '孙尚香',
    kingdom: '吴',
    hp: 3,
    skills: [
      {
        name: '结姻',
        description:
          '出牌阶段限一次，你可以弃置两张手牌，令你和一名已受伤的男性角色各回复1点体力。',
      },
      {
        name: '枭姬',
        description: '当你失去装备区里的一张牌后，你可以摸两张牌。',
      },
    ],
  },
  {
    name: '华佗',
    kingdom: '群',
    hp: 3,
    skills: [
      {
        name: '急救',
        description: '你的回合外，你可以将一张红色牌当【桃】使用。',
      },
      {
        name: '青囊',
        description:
          '出牌阶段限一次，你可以弃置一张手牌，令一名已受伤的角色回复1点体力。',
      },
    ],
  },
  {
    name: '吕布',
    kingdom: '群',
    hp: 4,
    skills: [
      {
        name: '无双',
        description:
          '当你使用【杀】指定目标后，该角色需依次使用两张【闪】才能抵消；当你使用【决斗】指定目标后，或成为【决斗】的目标后，对方每次需依次打出两张【杀】。',
        tags: ['locked'],
      },
    ],
  },
  {
    name: '貂蝉',
    kingdom: '群',
    hp: 3,
    skills: [
      {
        name: '离间',
        description:
          '出牌阶段限一次，你可以弃置一张牌并选择两名男性角色，视为其中一名男性角色对另一名男性角色使用一张【决斗】。',
      },
      { name: '闭月', description: '结束阶段，你可以摸一张牌。' },
    ],
  },

  // ------------------------------------------------------------------ 风
  {
    name: '夏侯渊',
    kingdom: '魏',
    hp: 4,
    skills: [
      {
        name: '神速',
        description:
          '你可以选择一项：1.跳过判定阶段和摸牌阶段；2.跳过出牌阶段并弃置一张装备牌。你每选择一项，视为使用一张无距离限制的【杀】。',
      },
    ],
  },
  {
    name: '曹仁',
    kingdom: '魏',
    hp: 4,
    skills: [
      {
        name: '据守',
        description: '结束阶段，你可以翻面并摸三张牌。',
      },
    ],
  },
  {
    name: '黄忠',
    kingdom: '蜀',
    hp: 4,
    skills: [
      {
        name: '烈弓',
        description:
          '当你使用【杀】指定目标后，若目标角色的手牌数不小于你的体力值，或不大于你的攻击范围，你可以令此【杀】不可被【闪】响应。',
      },
    ],
  },
  {
    name: '魏延',
    kingdom: '蜀',
    hp: 4,
    skills: [
      {
        name: '狂骨',
        description: '当你对距离1以内的一名角色造成1点伤害后，你回复1点体力。',
        tags: ['locked'],
      },
    ],
  },
  {
    name: '小乔',
    kingdom: '吴',
    hp: 3,
    skills: [
      {
        name: '天香',
        description:
          '当你受到伤害时，你可以弃置一张红桃手牌，然后选择一名其他角色，将此伤害转移给该角色，然后该角色摸X张牌（X为其已损失的体力值）。',
      },
      {
        name: '红颜',
        description: '你的黑桃牌视为红桃牌。',
        tags: ['locked'],
      },
    ],
  },
  {
    name: '周泰',
    kingdom: '吴',
    hp: 4,
    skills: [
      {
        name: '不屈',
        description:
          '当你处于濒死状态时，你将牌堆顶的一张牌置于你的武将牌上，称为“创”。若此牌点数与已有的“创”均不同，你回复至1点体力；若相同，将此牌置入弃牌堆。',
        tags: ['locked'],
      },
    ],
  },
  {
    name: '张角',
    kingdom: '群',
    hp: 3,
    skills: [
      {
        name: '雷击',
        description:
          '当你使用或打出【闪】时，你可以令一名角色进行判定，若结果为黑桃，你对其造成2点雷电伤害。',
      },
      {
        name: '鬼道',
        description: '当一名角色的判定牌生效前，你可以打出一张黑色牌代替之。',
      },
      {
        name: '黄天',
        description:
          '其他群势力角色的出牌阶段限一次，该角色可以交给你一张【闪】或【闪电】。',
        tags: ['lord'],
      },
    ],
  },
  {
    name: '于吉',
    kingdom: '群',
    hp: 3,
    skills: [
      {
        name: '蛊惑',
        description:
          '每名角色的回合限一次，你可以扣置一张手牌当任意一张基本牌或非延时类锦囊牌使用或打出。其他角色可以质疑：若为真，质疑者各失去1点体力；若为假，质疑者各摸一张牌，然后此牌作废。',
      },
    ],
  },

  // ------------------------------------------------------------------ 林
  {
    name: '徐晃',
    kingdom: '魏',
    hp: 4,
    skills: [
      {
        name: '断粮',
        description:
          '你可以将一张黑色基本牌或黑色装备牌当【兵粮寸断】使用；你使用【兵粮寸断】无距离限制。',
      },
    ],
  },
  {
    name: '曹丕',
    kingdom: '魏',
    hp: 3,
    skills: [
      {
        name: '行殇',
        description: '当其他角色死亡时，你可以获得其所有牌。',
      },
      {
        name: '放逐',
        description:
          '当你受到伤害后，你可以令一名其他角色翻面，然后该角色摸X张牌（X为你已损失的体力值）。',
      },
      {
        name: '颂威',
        description:
          '其他魏势力角色的判定牌生效后，若结果为黑色，该角色可以令你摸一张牌。',
        tags: ['lord'],
      },
    ],
  },
  {
    name: '孟获',
    kingdom: '蜀',
    hp: 4,
    skills: [
      {
        name: '祸首',
        description:
          '【南蛮入侵】对你无效；当其他角色使用【南蛮入侵】指定目标后，你代替其成为此牌造成伤害的来源。',
        tags: ['locked'],
      },
      {
        name: '再起',
        description:
          '摸牌阶段，若你已受伤，你可以改为展示牌堆顶的X张牌（X为你已损失的体力值），其中每有一张红桃牌，你回复1点体力，然后弃置这些红桃牌，获得其余牌。',
      },
    ],
  },
  {
    name: '祝融',
    kingdom: '蜀',
    hp: 4,
    skills: [
      {
        name: '巨象',
        description:
          '【南蛮入侵】对你无效；当其他角色使用的【南蛮入侵】结算结束后，你获得之。',
        tags: ['locked'],
      },
      {
        name: '烈刃',
        description:
          '当你使用【杀】对目标角色造成伤害后，你可以与其拼点，若你赢，你获得其一张牌。',
      },
    ],
  },
  {
    name: '鲁肃',
    kingdom: '吴',
    hp: 3,
    skills: [
      {
        name: '好施',
        description:
          '摸牌阶段，你可以额外摸两张牌；若如此做，摸牌阶段结束时，若你的手牌数大于5，你需将一半（向下取整）的手牌交给手牌数最少的一名其他角色。',
      },
      {
        name: '缔盟',
        description:
          '出牌阶段限一次，你可以选择两名其他角色，弃置等同于这两名角色手牌数之差的牌，然后交换他们的手牌。',
      },
    ],
  },
  {
    name: '孙坚',
    kingdom: '吴',
    hp: 4,
    skills: [
      {
        name: '英魂',
        description:
          '准备阶段，若你已受伤，你可以选择一名其他角色并选择一项：令其摸X张牌，然后弃置一张牌；或令其摸一张牌，然后弃置X张牌（X为你已损失的体力值）。',
      },
    ],
  },
  {
    name: '董卓',
    kingdom: '群',
    hp: 8,
    skills: [
      {
        name: '酒池',
        description: '你可以将一张黑桃手牌当【酒】使用。',
      },
      {
        name: '肉林',
        description:
          '你对女性角色使用的【杀】和女性角色对你使用的【杀】均需依次使用两张【闪】才能抵消。',
        tags: ['locked'],
      },
      {
        name: '崩坏',
        description:
          '结束阶段，若你不是场上体力值最少的角色，你须选择一项：减1点体力上限，或弃置一张牌。',
        tags: ['locked'],
      },
      {
        name: '暴虐',
        description:
          '其他群势力角色造成伤害后，该角色可以令你进行判定，若结果为黑桃，你回复1点体力。',
        tags: ['lord'],
      },
    ],
  },
  {
    name: '贾诩',
    kingdom: '群',
    hp: 3,
    skills: [
      {
        name: '完杀',
        description:
          '你的回合内，除你以外，只有处于濒死状态的角色才能使用【桃】。',
        tags: ['locked'],
      },
      {
        name: '乱武',
        description:
          '出牌阶段，你可以令所有其他角色依次选择一项：对其距离最近的一名角色使用一张【杀】，或失去1点体力。',
        tags: ['limited'],
      },
      {
        name: '帷幕',
        description: '你不能成为黑色锦囊牌的目标。',
        tags: ['locked'],
      },
    ],
  },

  // ------------------------------------------------------------------ 火
  {
    name: '典韦',
    kingdom: '魏',
    hp: 4,
    skills: [
      {
        name: '强袭',
        description:
          '出牌阶段限一次，你可以失去1点体力或弃置一张武器牌，然后对攻击范围内的一名其他角色造成1点伤害。',
      },
    ],
  },
  {
    name: '荀彧',
    kingdom: '魏',
    hp: 3,
    skills: [
      {
        name: '驱虎',
        description:
          '出牌阶段限一次，你可以与一名体力值大于你的角色拼点，若你赢，该角色对其攻击范围内由你选择的另一名角色造成1点伤害；若你没赢，其对你造成1点伤害。',
      },
      {
        name: '节命',
        description:
          '当你受到伤害后，你可以令一名角色将手牌摸至X张（X为其体力上限且至多为5）。',
      },
    ],
  },
  {
    name: '庞统',
    kingdom: '蜀',
    hp: 3,
    skills: [
      {
        name: '连环',
        description: '你可以将一张梅花手牌当【铁索连环】使用或重铸。',
      },
      {
        name: '涅槃',
        description:
          '当你处于濒死状态时，你可以弃置你区域内的所有牌，然后复原你的武将牌，摸三张牌，将体力回复至3点。',
        tags: ['limited'],
      },
    ],
  },
  {
    name: '太史慈',
    kingdom: '吴',
    hp: 4,
    skills: [
      {
        name: '天义',
        description:
          '出牌阶段限一次，你可以与一名角色拼点。若你赢，本回合你使用【杀】无距离限制，可以额外使用一张【杀】，且使用【杀】可以额外指定一个目标；若你没赢，本回合你不能使用【杀】。',
      },
    ],
  },
  {
    name: '卧龙诸葛亮',
    kingdom: '蜀',
    hp: 3,
    skills: [
      {
        name: '八阵',
        description:
          '若你的装备区里没有防具牌，视为你装备着【八卦阵】。',
        tags: ['locked'],
      },
      { name: '火计', description: '你可以将一张红色手牌当【火攻】使用。' },
      { name: '看破', description: '你可以将一张黑色手牌当【无懈可击】使用。' },
    ],
  },
  {
    name: '庞德',
    kingdom: '群',
    hp: 4,
    skills: [
      {
        name: '马术',
        description: '你计算与其他角色的距离-1。',
        tags: ['locked'],
      },
      {
        name: '猛进',
        description: '当你使用的【杀】被【闪】抵消时，你可以弃置目标角色的一张牌。',
      },
    ],
  },
  {
    name: '袁绍',
    kingdom: '群',
    hp: 4,
    skills: [
      {
        name: '乱击',
        description: '你可以将两张花色相同的手牌当【万箭齐发】使用。',
      },
      {
        name: '血裔',
        description: '你增加X点体力上限（X为其他群势力角色数）。',
        tags: ['lord', 'locked'],
      },
    ],
  },
  {
    name: '颜良文丑',
    kingdom: '群',
    hp: 4,
    skills: [
      {
        name: '双雄',
        description:
          '摸牌阶段，你可以改为进行判定，然后你获得此判定牌；本回合内，你可以将与此判定牌颜色不同的一张手牌当【决斗】使用。',
      },
    ],
  },

  // ------------------------------------------------------------------ 山
  {
    name: '张郃',
    kingdom: '魏',
    hp: 4,
    skills: [
      {
        name: '巧变',
        description:
          '你可以弃置一张手牌跳过阶段。若你以此法跳过判定阶段，你可以获得至多两名角色各一张牌；若跳过摸牌阶段，你可以获得至多两名角色各一张手牌；若跳过出牌阶段，你可以将一名角色装备区里的一张牌置入另一名角色的装备区；若跳过弃牌阶段，你可以将一张手牌置于一名角色的装备区。',
      },
    ],
  },
  {
    name: '邓艾',
    kingdom: '魏',
    hp: 4,
    skills: [
      {
        name: '屯田',
        description:
          '当你于回合外失去牌后，你可以进行判定，若结果不为红桃，将判定牌置于你的武将牌上，称为“田”；你计算与其他角色的距离-X（X为“田”的数量）。',
      },
      {
        name: '急袭',
        description: '你可以将一张“田”当【顺手牵羊】使用。',
      },
    ],
  },
  {
    name: '姜维',
    kingdom: '蜀',
    hp: 4,
    skills: [
      {
        name: '挑衅',
        description:
          '出牌阶段限一次，你可以选择一名攻击范围内含有你的其他角色，令该角色对你使用一张【杀】；若其未如此做，你弃置其一张牌。',
      },
      {
        name: '志继',
        description:
          '准备阶段，若你没有手牌，你减1点体力上限，然后选择一项：回复1点体力，或摸两张牌；然后你获得“观星”。',
        tags: ['awakening'],
      },
    ],
  },
  {
    name: '刘禅',
    kingdom: '蜀',
    hp: 3,
    skills: [
      {
        name: '享乐',
        description:
          '当你成为【杀】的目标时，除非使用者弃置一张基本牌，否则此【杀】对你无效。',
        tags: ['locked'],
      },
      {
        name: '放权',
        description:
          '你可以跳过出牌阶段，若如此做，此回合结束时，你可以弃置一张手牌并令一名其他角色进行一个额外的回合。',
      },
      {
        name: '若愚',
        description:
          '准备阶段，若你的体力值为全场最少（或之一），你增加1点体力上限，回复1点体力，然后获得“激将”。',
        tags: ['lord', 'awakening'],
      },
    ],
  },
  {
    name: '孙策',
    kingdom: '吴',
    hp: 4,
    skills: [
      {
        name: '激昂',
        description:
          '当你使用【决斗】或红色【杀】指定目标后，或成为【决斗】或红色【杀】的目标后，你可以摸一张牌。',
      },
      {
        name: '魂姿',
        description:
          '准备阶段，若你的体力值为1，你减1点体力上限，然后获得“英姿”和“英魂”。',
        tags: ['awakening'],
      },
      {
        name: '制霸',
        description:
          '其他吴势力角色的出牌阶段限一次，该角色可以与你拼点；若其没赢，你可以获得两人的拼点牌。',
        tags: ['lord'],
      },
    ],
  },
  {
    name: '张昭张纮',
    kingdom: '吴',
    hp: 3,
    skills: [
      {
        name: '直谏',
        description:
          '出牌阶段，你可以将一张装备牌置于一名其他角色的装备区里（不得替换原装备），然后摸一张牌。',
      },
      {
        name: '固政',
        description:
          '其他角色的弃牌阶段结束时，你可以将此阶段中该角色弃置的一张牌交给该角色，然后你获得其余弃置的牌。',
      },
    ],
  },
  {
    name: '蔡文姬',
    kingdom: '群',
    hp: 3,
    skills: [
      {
        name: '悲歌',
        description:
          '当一名角色受到【杀】造成的伤害后，你可以弃置一张牌，令其进行判定：若结果为红桃，其回复1点体力；方块，其摸两张牌；梅花，伤害来源弃置两张牌；黑桃，伤害来源翻面。',
      },
      {
        name: '断肠',
        description: '当你死亡时，杀死你的角色失去所有技能。',
        tags: ['locked'],
      },
    ],
  },
  {
    name: '左慈',
    kingdom: '群',
    hp: 3,
    skills: [
      {
        name: '化身',
        description:
          '游戏开始时，你随机获得两张武将牌作为“化身”，然后选择一张置于你的武将牌上，你获得该化身的技能且性别和势力视为该化身；回合开始时或结束时，你可以更换“化身”。',
      },
      {
        name: '新生',
        description: '当你受到1点伤害后，你可以获得一张新的“化身”。',
      },
    ],
  },
];
