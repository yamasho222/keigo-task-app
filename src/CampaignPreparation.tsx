import {
  ARMOR_LABELS, ARMOR_PERCENT, ARMOR_SLOTS, ARMOR_WEIGHTS,
  CAMPAIGN_MATERIALS, CAMPAIGN_RECIPES, TIER_LABELS,
  armorRate, attackDamage, campaignGearImage, campaignRecipeError,
  campaignUpgradeCost, maxHp,
  type ArmorTier, type AttackEnchant, type CampaignEquipment,
  type CampaignPlace, type CampaignSupplies, type DefenseEnchant,
} from "./campaignEquipment";
import "./campaignPreparation.css";

export type CampaignPreparationProps = {
  equipment: CampaignEquipment;
  supplies: CampaignSupplies;
  canChangeType: boolean;
  onEquip: (next: CampaignEquipment) => void;
  onCraft: (recipeId: string) => void;
  onUpgrade: (category: "attack" | "defense") => void;
  onHarvest: (place: CampaignPlace) => void;
  onResume: () => void;
  notice?: string;
  tickets: number;
  normalAllyBonus?: number;
};

const ATTACK_TYPES: { kind: AttackEnchant; label: string; effect: string }[] = [
  { kind: "none", label: "なし", effect: "まほうを えらぼう" },
  { kind: "power", label: "こうげきアップ", effect: "いつもの こうげき +1 / +2 / +3" },
  { kind: "ultimate", label: "ひっさつアップ", effect: "ひっさつの けん +4 / +8 / +12" },
  { kind: "break", label: "ぶいはかい", effect: "ぶいへの こうげき +1 / +2 / +3、ひっさつは 2ばい" },
];
const DEFENSE_TYPES: { kind: DefenseEnchant; label: string; effect: string }[] = [
  { kind: "none", label: "なし", effect: "まほうを えらぼう" },
  { kind: "protection", label: "まもりアップ", effect: "ダメージを 5% / 10% / 20% へらす" },
  { kind: "health", label: "ハートアップ", effect: "さいだいHP +2 / +4 / +6" },
  { kind: "fire", label: "ほのおガード", effect: "ほのおを 20% / 35% / 50% へらす" },
];
const PLACES: { place: CampaignPlace; label: string; image: string; loot: string }[] = [
  { place: "farm", label: "のうじょう", image: "/mining/Sugar_Cane.webp", loot: "こむぎ 3〜6・さとうきび 3" },
  { place: "wood", label: "もり", image: "/mining/Oak_Genboku.png", loot: "げんぼく 3・いた 6・ぼう 2" },
  { place: "ranch", label: "ぼくじょう", image: "/mining/White_Wool.png", loot: "ようもう 3・かわ 2" },
  { place: "lapis", label: "ラピスどうくつ", image: "/mining/Lapis_Lazuli.webp", loot: "ラピス 6・てつ 3・ダイヤ 2・いし 3" },
  { place: "nether", label: "ネザー", image: "/mining/Netherrack.webp", loot: "クォーツ 4・こくようせき 2・きん 3・ネザライトと かた 各1" },
];

function ItemImage({ image, fallback = "📦" }: { image?: string; fallback?: string }) {
  return image ? <img className="campaign-prep__item-image" src={image} alt="" draggable={false} />
    : <span className="campaign-prep__item-image" aria-hidden="true">{fallback}</span>;
}

function Cost({ cost, supplies }: { cost: Readonly<Record<string, number>>; supplies: CampaignSupplies }) {
  return <span className="campaign-prep__cost">{Object.entries(cost).map(([id, count]) => {
    const material = CAMPAIGN_MATERIALS[id];
    const held = supplies.materials[id] ?? 0;
    return <span key={id} className={held < count ? "campaign-prep__cost-item campaign-prep__cost-item--missing" : "campaign-prep__cost-item"}>
      <ItemImage image={material?.image} fallback={id === "wheat" ? "🌾" : "📦"} />
      {material?.label ?? id} {held}/{count}
    </span>;
  })}</span>;
}

/** Controlled preparation UI: all changes and ticket consumption belong to the parent. */
export function CampaignPreparation({ equipment, supplies, canChangeType, onEquip, onCraft, onUpgrade, onHarvest, onResume, notice, tickets, normalAllyBonus = 0 }: CampaignPreparationProps) {
  const normal = attackDamage(equipment, false, false, false);
  normal.total += normalAllyBonus;
  const special = attackDamage(equipment, true, false, false);
  const tiers: ArmorTier[] = ["none", "gold", "iron", "diamond", "netherite"];
  const usableTickets = Number.isSafeInteger(tickets) && tickets > 0;

  const recipeCards = (ids: readonly string[]) => <div className="campaign-prep__recipes">
    {CAMPAIGN_RECIPES.filter(recipe => ids.includes(recipe.id)).map(recipe => {
      const error = campaignRecipeError(supplies, recipe.id);
      return <article className="campaign-prep__recipe" key={recipe.id}>
        <div className="campaign-prep__recipe-title"><ItemImage image={recipe.image} fallback={recipe.id === "bread" ? "🍞" : "📦"} /><h4>{recipe.label}</h4></div>
        <Cost cost={recipe.cost} supplies={supplies} />
        {recipe.id === "party_bed" && <small>なかまの わくを +1（3にんまで）</small>}
        {recipe.id === "battle_bed" && <small>バトルで つかう ベッドを +1</small>}
        {recipe.id === "bread" && <small>たべる パンを +1</small>}
        <button type="button" disabled={!!error} onClick={() => onCraft(recipe.id)} aria-label={`${recipe.label}を つくる`}>{error ?? "つくる"}</button>
      </article>;
    })}
  </div>;

  return <section className="campaign-prep" aria-label="ぼうけんの じゅんび">
    <header className="campaign-prep__header">
      <div><span className="campaign-prep__eyebrow">おためしキャンペーン</span><h2>ぼうけんの じゅんび</h2><p>そうびを えらんで、つくって、あつめよう。</p></div>
      <span className="campaign-prep__ticket">🎟️ チケット {Number.isSafeInteger(tickets) && tickets >= 0 ? tickets : 0}</span>
    </header>
    <button type="button" className="campaign-prep__start" onClick={onResume}>⚔️ たたかう</button>
    {notice && <p className="campaign-prep__notice" role="status">{notice}</p>}
    <div className="campaign-prep__stats" aria-label="いまの つよさ">
      <span>⚔️ こうげき <strong>{normal.total}</strong></span>
      <span>✨ ひっさつ <strong>{special.total}</strong><small>けん {special.weapon} ＋ なかま {special.companions}</small></span>
      <span>🛡️ ぼうぐ <strong>{Math.round(armorRate(equipment) * 1000) / 10}%</strong><small>ダメージを へらす</small></span>
      <span>❤️ さいだいHP <strong>{maxHp(equipment)}</strong></span>
    </div>

    <details className="campaign-prep__panel" aria-labelledby="campaign-prep-gear">
      <summary id="campaign-prep-gear"><ItemImage image={campaignGearImage(`sword_${equipment.sword}`)} />そうび</summary>
      <div className="campaign-prep__gear">
        <label className="campaign-prep__gear-card"><ItemImage image={campaignGearImage(`sword_${equipment.sword}`)} />
          <span>けん</span><select value={equipment.sword} onChange={event => {
            const sword = event.target.value;
            if ((sword === "diamond" || sword === "netherite") && supplies.owned[`sword_${sword}`]) onEquip({ ...equipment, sword });
          }}>
            {(["diamond", "netherite"] as const).filter(tier => supplies.owned[`sword_${tier}`]).map(tier => <option key={tier} value={tier}>{TIER_LABELS[tier]}（こうげき {tier === "diamond" ? 4 : 6}）</option>)}
          </select>
        </label>
        {ARMOR_SLOTS.map(slot => <label className="campaign-prep__gear-card" key={slot}>
          <ItemImage image={campaignGearImage(`armor_${slot}_${equipment.armor[slot]}`)} fallback="🛡️" />
          <span>{ARMOR_LABELS[slot]}</span><select value={equipment.armor[slot]} onChange={event => {
            const tier = event.target.value as ArmorTier;
            if (tiers.includes(tier) && (tier === "none" || supplies.owned[`armor_${slot}_${tier}`])) onEquip({ ...equipment, armor: { ...equipment.armor, [slot]: tier } });
          }}>
            {tiers.filter(tier => tier === "none" || supplies.owned[`armor_${slot}_${tier}`]).map(tier => <option key={tier} value={tier}>{TIER_LABELS[tier]}（まもり {Math.round(ARMOR_PERCENT[tier] * ARMOR_WEIGHTS[slot] / 24 * 10) / 10}%）</option>)}
          </select>
        </label>)}
        <label className="campaign-prep__gear-card campaign-prep__shield"><ItemImage image="/mining/Shield.webp" /><span>たて</span>
          <span><input type="checkbox" checked={equipment.shield} disabled={!supplies.owned.shield} onChange={event => onEquip({ ...equipment, shield: event.target.checked })} /> もつ</span>
          <small>ガードで {equipment.shield ? "80" : "50"}% へらす</small>
        </label>
      </div>
      <div className="campaign-prep__buddies" aria-label="ひっさつを てつだう なかま">
        {equipment.buddies.slice(0, 3).map((buddy, index) => <span key={`${buddy.id}-${index}`}><img src={buddy.image} alt={`なかま ${index + 1}`} width="44" height="44" />Lv.{buddy.level}</span>)}
        <p>なかまの おうえんは ひっさつの とき！<br />なかまの わく {supplies.partySlots}/3</p>
      </div>
    </details>

    <details className="campaign-prep__panel" aria-labelledby="campaign-prep-enchant">
      <summary id="campaign-prep-enchant"><ItemImage image="/mining/Enchanted_Book.gif" />まほう</summary>
      <p className="campaign-prep__hint">{canChangeType ? "しゅるいを かえても ほしは そのまま。" : "しゅるいは いま かえられないよ。ほしは ふやせるよ。"}</p>
      <div className="campaign-prep__enchants">{(["attack", "defense"] as const).map(category => {
        const enchant = equipment[category];
        const choices = category === "attack" ? ATTACK_TYPES : DEFENSE_TYPES;
        const cost = campaignUpgradeCost(enchant.rank);
        const reason = !supplies.hasTable ? "テーブルを つくろう" : enchant.kind === "none" ? "しゅるいを えらぼう" : !cost ? "ほし 3つ！" : Object.entries(cost).some(([id, count]) => !Number.isSafeInteger(supplies.materials[id] ?? 0) || (supplies.materials[id] ?? 0) < count) ? "ざいりょうを あつめよう" : undefined;
        return <article className="campaign-prep__enchant" key={category}>
          <label>{category === "attack" ? "⚔️ こうげきの まほう" : "🛡️ まもりの まほう"}
            <select value={enchant.kind} disabled={!canChangeType} onChange={event => {
              if (!canChangeType) return;
              if (category === "attack" && ATTACK_TYPES.some(choice => choice.kind === event.target.value)) onEquip({ ...equipment, attack: { ...equipment.attack, kind: event.target.value as AttackEnchant } });
              if (category === "defense" && DEFENSE_TYPES.some(choice => choice.kind === event.target.value)) onEquip({ ...equipment, defense: { ...equipment.defense, kind: event.target.value as DefenseEnchant } });
            }}>{choices.map(choice => <option value={choice.kind} key={choice.kind}>{choice.label}</option>)}</select>
          </label>
          <span className="campaign-prep__stars" aria-label={`ほし ${enchant.rank}/3`}>{"★".repeat(enchant.rank)}{"☆".repeat(3 - enchant.rank)}</span>
          <p>{choices.find(choice => choice.kind === enchant.kind)?.effect}</p>
          {cost && <><small>つぎは ほし {enchant.rank + 1}（かならず せいこう）</small><Cost cost={cost} supplies={supplies} /></>}
          <button type="button" disabled={!!reason} onClick={() => onUpgrade(category)} aria-label={`${category === "attack" ? "こうげき" : "まもり"}の ほしを ふやす`}>{reason ?? "★ ほしを ふやす"}</button>
        </article>;
      })}</div>
    </details>

    <details className="campaign-prep__panel" aria-labelledby="campaign-prep-craft">
      <summary id="campaign-prep-craft"><ItemImage image="/mining/White_Bed.png" />つくる</summary>
      {recipeCards(["bread", "battle_bed", "party_bed", "paper", "book", "enchanting_table", "shield"])}
      <details><summary>そうび・どうぐも つくる</summary>
        {recipeCards(["plank", "stick", ...CAMPAIGN_RECIPES.filter(recipe => recipe.owned && recipe.id !== "shield" && recipe.id !== "enchanting_table").map(recipe => recipe.id)])}
      </details>
    </details>

    <details className="campaign-prep__panel" aria-labelledby="campaign-prep-harvest">
      <summary id="campaign-prep-harvest"><ItemImage image="/mining/Lapis_Lazuli.webp" />あつめる</summary>
      <p className="campaign-prep__hint">1かい チケット 1まい</p>
      <small className="campaign-prep__hint">試験用の素材採取です。通常の採掘の場所・抽選とは別です。</small>
      <div className="campaign-prep__places">{PLACES.map(({ place, label, image, loot }) => <button key={place} type="button" disabled={!usableTickets} onClick={() => onHarvest(place)}>
        <ItemImage image={image} /><strong>{label}</strong><small>{loot}</small><span>🎟️ 1まいで あつめる</span>
      </button>)}</div>
      {!usableTickets && <p>チケットが たまったら あつめよう。</p>}
      <details><summary>もっている ざいりょう</summary><div className="campaign-prep__inventory">
        {Object.entries(CAMPAIGN_MATERIALS).map(([id, item]) => <span key={id}><ItemImage image={item.image} fallback={id === "bread" ? "🍞" : id === "wheat" ? "🌾" : "📦"} />{item.label}<strong>{supplies.materials[id] ?? 0}</strong></span>)}
      </div></details>
    </details>
    <footer className="campaign-prep__footer"><button type="button" className="campaign-prep__resume" onClick={onResume}>⚔️ ぼうけんに もどる</button></footer>
  </section>;
}

export default CampaignPreparation;
