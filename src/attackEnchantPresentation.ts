import { attackDamage, SWORD_POWER, type CampaignEquipment, type AttackEnchant, type EnchantRank } from './campaignEquipment';
import { skillBonus } from './dragonSkillRules';
import { smallSkillBonus } from './battleSkillRules';

export type AttackMagic = Exclude<AttackEnchant, 'none'>;

export const ATTACK_MAGIC = [
  { kind: 'power', name: 'つよく', caption: 'いつもの こうげき', message: 'ひとふり、ひとふりが つよくなる。', hint: 'まよったら これ！' },
  { kind: 'ultimate', name: 'ひっさつ', caption: 'ひっさつの いちげき', message: 'ためた ちからを、もっと おおきく。', hint: 'ひっさつが すきなら' },
  { kind: 'break', name: 'こわす', caption: 'クリスタル・つばさ', message: 'かたい クリスタルや つばさを うちくだく。', hint: 'エンドラの しかけに' },
] as const;

/** Combat's sword/skill rules, excluding allies, items, criticals and openings. */
export function enchantPracticeDamage(eq: CampaignEquipment, kind: AttackEnchant, rank: EnchantRank, special: boolean, dragon: boolean, part = false) {
  const weapon = attackDamage({ ...eq, buddies: [], attack: { kind, rank } }, special, part, false).weapon;
  return weapon + (special ? dragon ? skillBonus(eq.sword, 50) : smallSkillBonus(SWORD_POWER[eq.sword] * 2, 50) : 0);
}
