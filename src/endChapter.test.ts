import { describe, expect, it } from "vitest";
import {
  applyDragonSpecialFinish,
  applyEndQuestOnVisit,
  noteEndQuestVisit,
  prepareEndSearch,
  BED_EXPLOSION_DAMAGE,
  CRYSTAL_COUNT,
  CRYSTAL_HEAL_PER,
  CRYSTAL_MAX_HP,
  DRAGON_MAX_HP,
  dragonHitDamage,
  dragonSwings,
  enderEyeHoldHintText,
  emptyDragonFight,
  emptyEndQuest,
  END_PORTAL_EYE_SLOTS,
  ensureDragonFight,
  insertPortalEye,
  listsMiningDestination,
  nextLivingCrystal,
  partyDragonBonus,
  PORTAL_HUNT_STOPS,
  resolveDragonAttack,
  showsEndHuntHint,
  showsEnderEyeHoldHint,
  unlockTheEnd,
} from "./endChapter";
import { MINING_RECIPES } from "./miningRecipes";
import { refreshUnlocks, tryCraft } from "./miningProgress";
import { emptyMiningState, type GachaId, type MiningState } from "./miningTypes";
import { beginSpecialAttack } from "./playerCombat";

const PLACES: GachaId[] = [
  "wood",
  "farm",
  "ranch",
  "stone",
  "iron",
  "coal",
  "gold",
  "diamond",
  "nether",
  "bastion",
  "warped_forest",
  "fortress",
];

function baseState(patch: Partial<MiningState> = {}): MiningState {
  return {
    ...emptyMiningState(),
    tickets: 20,
    unlockedGachas: [...PLACES],
    materials: { ender_eye: 20, spare_bed: 4 },
    crafted: { workbench: true, sword_netherite: true },
    partyIds: ["a", "b", "c"],
    endQuest: emptyEndQuest(),
    ...patch,
  };
}

function randSeq(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i += 1;
    return v;
  };
}

describe("ender eye craft", () => {
  it("棒1から粉2、パール1+粉1からアイ1", () => {
    const powder = MINING_RECIPES.find((r) => r.id === "blaze_powder_batch");
    const eye = MINING_RECIPES.find((r) => r.id === "ender_eye_craft");
    expect(powder?.outputs).toEqual([{ material: "blaze_powder", amount: 2 }]);
    expect(powder?.costs).toEqual([{ material: "blaze_rod", amount: 1 }]);
    expect(eye?.outputs).toEqual([{ material: "ender_eye", amount: 1 }]);
    expect(eye?.costs).toEqual([
      { material: "ender_pearl", amount: 1 },
      { material: "blaze_powder", amount: 1 },
    ]);

    const start = {
      ...emptyMiningState(),
      crafted: { workbench: true },
      materials: { blaze_rod: 1, ender_pearl: 1 },
      unlockedGachas: ["wood", "warped_forest", "fortress"],
    };
    const powdered = tryCraft(start, powder!);
    expect(powdered.error).toBeUndefined();
    expect(powdered.state.materials.blaze_powder).toBe(2);
    expect(powdered.state.materials.blaze_rod).toBe(0);

    const eyed = tryCraft(
      { ...powdered.state, materials: { ...powdered.state.materials, ender_pearl: 1, blaze_powder: 1 } },
      eye!,
    );
    expect(eyed.error).toBeUndefined();
    expect(eyed.state.materials.ender_eye).toBe(1);
    expect(eyed.state.materials.ender_pearl).toBe(0);
    expect(eyed.state.materials.blaze_powder).toBe(0);
  });
});

describe("portal hunt", () => {
  it("エンダーアイの持ち物ヒントを段階表示する", () => {
    const state = baseState({ materials: { ender_eye: 1 } });
    expect(enderEyeHoldHintText(state)).toBe("");

    const once = noteEndQuestVisit(state, "visit-1", 100_000);
    expect(once.endQuest?.enderEyeHintVisits).toBe(1);
    expect(once.endQuest?.mark).toBeNull();

    const twice = noteEndQuestVisit(once, "visit-2", 140_000);
    expect(twice.endQuest?.enderEyeHintVisits).toBe(2);
    const third = noteEndQuestVisit(twice, "visit-3", 180_000);
    expect(third.endQuest?.enderEyeHintVisits).toBe(3);
    expect(enderEyeHoldHintText(third)).toContain("このエンダーアイ");
    expect(enderEyeHoldHintText(third)).not.toContain("そうび");
    expect(noteEndQuestVisit(third, "visit-3", 220_000).endQuest?.enderEyeHintVisits).toBe(3);
    expect(noteEndQuestVisit(third, "spam", 180_001).endQuest?.enderEyeHintVisits).toBe(3);
    expect(applyEndQuestOnVisit(third, "farm").state.endQuest?.enderEyeHintVisits).toBe(3);
  });

  it("装備直後に無料で印が出て、別の場所を掘っても変わらない", () => {
    const rand = randSeq([0]);
    const before = {
      ...baseState(),
      equipped: { ...emptyMiningState().equipped, held: "ender_eye" as const },
    };
    const state = prepareEndSearch(before);
    expect(state.materials.ender_eye).toBe(20);
    expect(state.endQuest?.mark).toBe("wood");
    expect(state.tickets).toBe(before.tickets);
    const again = applyEndQuestOnVisit(state, "farm", rand);
    expect(again.event).toBeNull();
    expect(again.state.endQuest?.mark).toBe("wood");
  });

  it("異なる5か所で発見。最後は地下、追加の採掘は不要", () => {
    let state = {
      ...baseState(),
      equipped: { ...emptyMiningState().equipped, held: "ender_eye" as const },
    };
    state = prepareEndSearch(state);

    const stops: GachaId[] = [];
    for (let i = 0; i < PORTAL_HUNT_STOPS; i++) {
      const mark = state.endQuest?.mark;
      expect(mark).toBeTruthy();
      stops.push(mark!);
      const next = applyEndQuestOnVisit(state, mark!, randSeq([0]));
      state = next.state;
      if (i < PORTAL_HUNT_STOPS - 1) expect(next.event?.kind).toBe("visited");
      else expect(next.event?.kind).toBe("found");
    }
    expect(new Set(stops).size).toBe(PORTAL_HUNT_STOPS);
    expect(state.endQuest?.fifth).toBeNull();
    expect(["stone", "iron", "coal", "gold", "diamond", "lapis_cave"]).toContain(stops[PORTAL_HUNT_STOPS - 1]);
    expect(stops).not.toContain("fortress");
    expect(stops).not.toContain("warped_forest");
    expect(state.endQuest?.foundPortal).toBe(true);
    expect(state.materials.ender_eye).toBe(20);
  });

  it("発見前はエンドポータルもジ・エンドもほりばに出さない", () => {
    const hidden = refreshUnlocks(baseState());
    expect(listsMiningDestination(hidden, "end_portal")).toBe(false);
    expect(listsMiningDestination(hidden, "the_end")).toBe(false);
    const found = refreshUnlocks(baseState({
      endQuest: { ...emptyEndQuest(), foundPortal: true },
    }));
    expect(found.unlockedGachas).toContain("end_portal");
    expect(listsMiningDestination(found, "end_portal")).toBe(true);
    expect(listsMiningDestination(found, "the_end")).toBe(false);
    const opened = refreshUnlocks(baseState({
      endQuest: { ...emptyEndQuest(), foundPortal: true, linked: true, theEndUnlocked: true, eyes: 12 },
    }));
    expect(listsMiningDestination(opened, "the_end")).toBe(true);
  });

  it("ほりばのヒントは持ち物スロットにアイを入れたときだけ", () => {
    const marked = {
      ...baseState(),
      endQuest: { ...emptyEndQuest(), mark: "farm" as const, enderEyeHintVisits: 3 },
      equipped: { ...emptyMiningState().equipped, held: null },
    };
    expect(showsEndHuntHint(marked)).toBe(false);
    expect(showsEnderEyeHoldHint(marked)).toBe(true);
    const held = {
      ...marked,
      equipped: { ...marked.equipped, held: "ender_eye" as const },
    };
    expect(showsEndHuntHint(held)).toBe(true);
    expect(showsEnderEyeHoldHint(held)).toBe(false);
    const found = {
      ...held,
      endQuest: { ...emptyEndQuest(), foundPortal: true },
    };
    expect(showsEndHuntHint(found)).toBe(false);
    expect(showsEnderEyeHoldHint(found)).toBe(false);
  });

  it("アイが無いと投げない", () => {
    const { event } = applyEndQuestOnVisit(baseState({ materials: {} }), "wood");
    expect(event).toBeNull();
  });
});

describe("12はめとジ・エンド", () => {
  it("所持から1個ずつ消費し、0なら何もしない。12で接続、タップで解放", () => {
    let state = baseState({
      endQuest: { ...emptyEndQuest(), foundPortal: true },
      materials: { ender_eye: 12 },
    });
    for (let i = 0; i < END_PORTAL_EYE_SLOTS; i++) {
      const r = insertPortalEye(state);
      expect(r.inserted).toBe(true);
      state = r.state;
    }
    expect(state.endQuest?.eyes).toBe(12);
    expect(state.endQuest?.linked).toBe(true);
    expect(state.materials.ender_eye).toBe(0);

    const empty = insertPortalEye(state);
    expect(empty.inserted).toBe(false);
    expect(empty.state.materials.ender_eye).toBe(0);

    const unlocked = unlockTheEnd(state);
    expect(unlocked.error).toBeUndefined();
    expect(unlocked.state.endQuest?.theEndUnlocked).toBe(true);
  });
});

describe("ender dragon", () => {
  it("結晶HP16・本体2000。振りは1/3/5。本体後だけ結晶×5回復", () => {
    expect(emptyDragonFight().crystals).toHaveLength(CRYSTAL_COUNT);
    expect(emptyDragonFight().crystals.every((hp) => hp === CRYSTAL_MAX_HP)).toBe(true);
    expect(emptyDragonFight().hp).toBe(DRAGON_MAX_HP);
    expect(dragonSwings("normal")).toBe(1);
    expect(dragonSwings("hit")).toBe(2);
    expect(dragonSwings("jackpot")).toBe(8);

    const state = baseState({
      dragonFight: emptyDragonFight(),
      tickets: 5,
    });
    const crystal = resolveDragonAttack({ state, target: 0, tier: "normal" });
    if ("error" in crystal) throw new Error(crystal.error);
    expect(crystal.heal).toBe(0);
    expect(crystal.state.dragonFight?.crystals[0]).toBe(CRYSTAL_MAX_HP - Math.floor(dragonHitDamage(state) / 2));
    expect(crystal.state.dragonFight?.hp).toBe(DRAGON_MAX_HP);

    const wounded = {
      ...state,
      dragonFight: { ...emptyDragonFight(), hp: 200 },
    };
    const body = resolveDragonAttack({ state: wounded, target: "dragon", tier: "normal" });
    if ("error" in body) throw new Error(body.error);
    expect(body.heal).toBe(CRYSTAL_COUNT * CRYSTAL_HEAL_PER);
    expect(body.state.dragonFight?.hp).toBe(200 - Math.floor(dragonHitDamage(state) / 2) + CRYSTAL_COUNT * CRYSTAL_HEAL_PER);
  });

  it("なかまボーナスは floor(Lv×3/10)。結晶0・ネザライト・大当たりで85", () => {
    const state = baseState({
      partyIds: ["a", "b", "c"],
    });
    const buddies = {
      a: { level: 10, xp: 0 },
      b: { level: 10, xp: 0 },
      c: { level: 10, xp: 0 },
    };
    expect(partyDragonBonus(state, buddies)).toBe(9);
    expect(dragonHitDamage(state, buddies)).toBe(17);
    const noCrystal = {
      ...state,
      dragonFight: { crystals: Array.from({ length: 8 }, () => 0), hp: DRAGON_MAX_HP, defeated: false },
    };
    const hit = resolveDragonAttack({
      state: noCrystal,
      target: "dragon",
      tier: "jackpot",
      buddyProgress: buddies,
    });
    if ("error" in hit) throw new Error(hit.error);
    expect(hit.damage).toBe(64);
    expect(hit.heal).toBe(0);
    expect(hit.state.dragonFight?.hp).toBe(DRAGON_MAX_HP - 64);
  });

  it("結晶を壊したら時計回りで次の生きている結晶、全滅なら本体", () => {
    expect(nextLivingCrystal([0, 16, 16, 16, 16, 16, 16, 16], 0)).toBe(1);
    expect(nextLivingCrystal([16, 16, 16, 16, 16, 16, 16, 0], 7)).toBe(0);
    expect(nextLivingCrystal([16, 0, 0, 8, 16, 16, 16, 16], 0)).toBe(3);
    expect(nextLivingCrystal([0, 0, 0, 0, 0, 0, 0, 0], 4)).toBe("dragon");
  });

  it("ベッドは本体だけ100。結晶は壊さないし復活もしない", () => {
    const crystals = [0, 16, 16, 8, 0, 16, 16, 16];
    const state = baseState({
      bedCount: 3,
      dragonFight: { crystals, hp: DRAGON_MAX_HP, defeated: false },
      materials: { spare_bed: 2, ender_eye: 1 },
    });
    const r = resolveDragonAttack({ state, target: 1, useBed: true });
    if ("error" in r) throw new Error(r.error);
    expect(r.damage).toBe(BED_EXPLOSION_DAMAGE);
    expect(r.target).toBe("dragon");
    expect(r.crystalDestroyed).toBe(false);
    expect(r.state.dragonFight?.hp).toBe(DRAGON_MAX_HP - 100);
    expect(r.state.dragonFight?.crystals).toEqual(crystals);
    expect(r.state.materials.spare_bed).toBe(1);
    expect(r.state.bedCount).toBe(3);
  });

  it("撃破してもエリトラはまだ渡さない。HPは倒すまで残る", () => {
    const state = baseState({
      dragonFight: { crystals: Array.from({ length: 8 }, () => 0), hp: 4, defeated: false },
    });
    const r = resolveDragonAttack({ state, target: "dragon", tier: "normal" });
    if ("error" in r) throw new Error(r.error);
    expect(r.defeated).toBe(true);
    expect(r.state.crafted.elytra).toBe(true);
    expect(r.state.dragonFight?.defeated).toBe(true);
    expect(r.countered).toBe(false);
    expect(r.state.playerHp).toBe(20);
  });

  it("4回目の反撃が強。裸なら10ハートで倒れる", () => {
    const state = baseState({
      dragonFight: { crystals: Array.from({ length: 8 }, () => 0), hp: DRAGON_MAX_HP, defeated: false },
      dragonRageSeq: 3,
      playerHp: 20,
    });
    const heavy = resolveDragonAttack({ state, target: "dragon", tier: "normal" });
    if ("error" in heavy) throw new Error(heavy.error);
    expect(heavy.heavy).toBe(true);
    expect(heavy.takenHearts).toBe(10);
    expect(heavy.playerDied).toBe(true);
    expect(heavy.state.playerHp).toBe(0);
    expect(heavy.state.specialGauge).toBe(0);
  });

  it("ネザライトフルなら強攻撃も0ダメ", () => {
    const crafted = {
      sword_netherite: true,
      helmet_netherite: true,
      chest_netherite: true,
      leggings_netherite: true,
      boots_netherite: true,
    };
    const state = baseState({
      crafted,
      equipped: {
        ...emptyMiningState().equipped,
        tool: "sword_netherite",
        helmet: "helmet_netherite",
        chest: "chest_netherite",
        leggings: "leggings_netherite",
        boots: "boots_netherite",
      },
      dragonFight: { crystals: Array.from({ length: 8 }, () => 0), hp: DRAGON_MAX_HP, defeated: false },
      dragonRageSeq: 3,
    });
    const r = resolveDragonAttack({ state, target: "dragon", tier: "normal" });
    if ("error" in r) throw new Error(r.error);
    expect(r.heavy).toBe(true);
    expect(r.takenHearts).toBe(1);
    expect(r.playerDied).toBe(false);
    expect(r.state.playerHp).toBe(18);
  });
});

describe("unlocks", () => {
  it("foundPortal で end_portal、theEndUnlocked で the_end", () => {
    const found = refreshUnlocks(baseState({
      endQuest: { ...emptyEndQuest(), foundPortal: true },
    }));
    expect(found.unlockedGachas).toContain("end_portal");
    expect(found.unlockedGachas).not.toContain("the_end");
    const opened = refreshUnlocks({
      ...found,
      endQuest: { ...found.endQuest!, linked: true, eyes: 12, theEndUnlocked: true },
    });
    expect(opened.unlockedGachas).toContain("the_end");
  });
});

describe("dragon special", () => {
  it("taps times 2, no crystal heal", () => {
    const state = beginSpecialAttack(baseState({
      specialGauge: 5,
      dragonFight: { crystals: Array.from({ length: 8 }, () => 0), hp: 200, defeated: false },
    })).state;
    expect(state.specialGauge).toBe(0);
    const fin = applyDragonSpecialFinish({
      state,
      target: "dragon",
      taps: 4,
    });
    if ("error" in fin) throw new Error(fin.error);
    expect(fin.damage).toBe(16);
    expect(fin.heal).toBe(0);
    expect(fin.state.dragonFight?.hp).toBe(184);
  });

  it("keeps an existing 1400 HP fight instead of restoring it", () => {
    const old = baseState({
      dragonFight: { crystals: Array.from({ length: 8 }, () => 16), hp: 1400, defeated: false },
    });
    expect(ensureDragonFight(old).dragonFight?.hp).toBe(1400);
  });
});

describe("spare bed craft", () => {
  it("パーティ3ベッドのあとは spare_bed になる", () => {
    const bed = MINING_RECIPES.find((r) => r.id === "bed");
    const start = {
      ...emptyMiningState(),
      crafted: { workbench: true },
      bedCount: 3,
      materials: { wool: 6, plank: 6 },
    };
    const r = tryCraft(start, bed!, { times: 2 });
    expect(r.error).toBeUndefined();
    expect(r.state.bedCount).toBe(3);
    expect(r.state.materials.spare_bed).toBe(2);
    expect(r.state.materials.wool).toBe(0);
  });
});
