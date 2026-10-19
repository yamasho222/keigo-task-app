import type { AdventureLocation } from './adventureState';
import type { DragonSkillKind } from './dragonSkillRules';
import type { ForecastSignal } from './battleForecastRules';

export type BattleLesson = { id: string; title: string; caption: string; skill?: DragonSkillKind; signal?: ForecastSignal; fresh?: boolean };
const EFFECTS: Record<DragonSkillKind, Omit<BattleLesson, 'id'>> = {
  aim: { title: 'ひかりの ひっさつ', caption: 'ハートが もどる！ あまりは まもる ひかり。', skill: 'aim' },
  burst: { title: 'ほのおの ひっさつ', caption: 'つぎの ３かい、５ずつ やけど！', skill: 'burst' },
  gauge: { title: 'かみなりの ひっさつ', caption: 'つぎの こうげきを １かい とめる！', skill: 'gauge' },
  repel: { title: 'みずの ひっさつ', caption: 'つぎの ２かい、ダメージを はんぶんに！', skill: 'repel' },
};
export function battleTutorialLessons(location: AdventureLocation, unlocked: readonly DragonSkillKind[], fresh: readonly DragonSkillKind[] = []): BattleLesson[] {
  const skills = unlocked.filter(kind => fresh.includes(kind)).concat(unlocked.filter(kind => !fresh.includes(kind)));
  const effects = skills.filter(kind => location === 'fortress' || kind !== 'repel').map(kind => ({ id: `effect-${kind}`, ...EFFECTS[kind], fresh: fresh.includes(kind) }));
  const basics: BattleLesson[] = location === 'fortress' ? [
    { id: 'attack', title: 'こうげき', caption: 'たたくと ひっさつの ひかりが たまる！' },
    { id: 'guard', title: 'まもる', caption: 'ダメージを へらそう。ゼロには ならないよ。' },
    { id: 'food', title: 'かいふく', caption: 'パンで ハートを もどそう！' },
    { id: 'ticket', title: 'チケット', caption: '１まいで ４かい。まもるも おなじ。' },
  ] : location === 'warped_forest' ? [
    { id: 'warp', title: 'ワープ', caption: 'ゆらゆらしたら よける！ でも ひかりは たまる。' },
    { id: 'guard', title: 'まもって まとう', caption: 'まもって まつと、つぎは チャンス！' },
  ] : [{ id: 'dragon', title: 'エンダードラゴン', caption: 'ねらう ところを タップして えらぼう！' }];
  const signals: ForecastSignal[] = location === 'the_end' ? ['attack', 'heavy', 'extreme', 'charge', 'rest'] : location === 'fortress' ? ['attack', 'heavy', 'charge'] : ['attack', 'heavy', 'rest'];
  const captions: Record<ForecastSignal, string> = { attack: 'ふつうの こうげきが くる！', heavy: 'おおわざが くる！', extreme: 'とくだいの こうげき！', charge: 'ちからを ためてる。つぎに ちゅうい！', rest: 'ひとやすみ。いまは こうげき してこない！' };
  return [...effects.filter(page => page.fresh), ...basics, ...effects.filter(page => !page.fresh), ...signals.map(signal => ({ id: `signal-${signal}`, title: 'てきの マーク', caption: captions[signal], signal }))];
}
