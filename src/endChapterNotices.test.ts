import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyMiningState, normalizeMiningState } from './miningTypes';
import { rebaseMiningWrite } from './miningCommit';
import { acknowledgeEndChapterNotice, pendingEndChapterNotice, readEndChapterNotices, recoveryAvailability } from './endChapterNotices';
import { BreadRecoveryHelp, EndChapterNoticePanel } from './EndChapterNoticePanel';

describe('per-child End chapter catch-up announcements', () => {
  it('catches legacy debris owners even without a previous chapter transition', () => {
    const legacy = { ...emptyMiningState(), miningVersionNoticeSeen: true, materials: { ancient_debris: 1 } };
    expect(pendingEndChapterNotice(legacy, 'mine', false)).toBe('fortress');
    const seen = acknowledgeEndChapterNotice(legacy, 'fortress');
    expect(pendingEndChapterNotice(seen, 'mine', false)).toBeNull();
    expect(pendingEndChapterNotice(normalizeMiningState(JSON.parse(JSON.stringify(seen))), 'mine', false)).toBeNull();
    expect(pendingEndChapterNotice(legacy, 'mine', false)).toBe('fortress');
  });
  it('also catches already spent debris, without spoiling the fortress for beginners', () => {
    const base = emptyMiningState();
    expect(pendingEndChapterNotice(base, 'mine', false)).toBeNull();
    expect(pendingEndChapterNotice({ ...base, endJourney: { debrisFound: true, rodsAcquired: 0, rodBalance: 0 } }, 'mine', false)).toBe('fortress');
    expect(pendingEndChapterNotice({ ...base, unlockedGachas: [...base.unlockedGachas, 'fortress'] }, 'mine', false)).toBe('fortress');
  });
  it('shows recipe news on the first craft visit, independently from fortress acknowledgement', () => {
    const base = emptyMiningState();
    expect(pendingEndChapterNotice(base, 'bag', false)).toBeNull();
    expect(pendingEndChapterNotice(base, 'craft', false)).toBe('crafting');
    const read = acknowledgeEndChapterNotice(base, 'crafting');
    expect(pendingEndChapterNotice(normalizeMiningState(read), 'craft', false)).toBeNull();
    expect(pendingEndChapterNotice({ ...read, materials: { ancient_debris: 1 } }, 'mine', false)).toBe('fortress');
  });
  it.each(['mine', 'craft'])('waits for other overlays and battle/loot sequences on %s', tab => {
    const base = { ...emptyMiningState(), materials: { ancient_debris: 1 } };
    expect(pendingEndChapterNotice(base, tab, true)).toBeNull();
    expect(pendingEndChapterNotice(base, tab, false)).not.toBeNull();
  });
  it('does not let stale resource writes erase acknowledgements in either order', () => {
    const base = emptyMiningState();
    const seen = acknowledgeEndChapterNotice(base, 'fortress');
    const inventory = { ...base, tickets: base.tickets + 1 };
    expect(rebaseMiningWrite(seen, base, inventory).endChapterNotices?.fortress).toBe(true);
    expect(rebaseMiningWrite(inventory, base, seen).tickets).toBe(inventory.tickets);
    const other = acknowledgeEndChapterNotice(base, 'crafting');
    expect(rebaseMiningWrite(other, base, seen).endChapterNotices).toEqual({ fortress: true, crafting: true });
  });
  it('accepts only actual booleans from stored data', () => {
    expect(readEndChapterNotices({ fortress: 'false', crafting: 1 })).toEqual({ fortress: false, crafting: false });
    expect(readEndChapterNotices(null)).toEqual({ fortress: false, crafting: false });
  });
  it('acknowledgement changes no materials, combat state or tickets', () => {
    const base = emptyMiningState();
    const result = acknowledgeEndChapterNotice(base, 'crafting');
    expect(result).toEqual({ ...base, endChapterNotices: { crafting: true } });
    expect(result.materials).toBe(base.materials);
    expect(base.endChapterNotices).toEqual({});
  });
});

describe('recovery help is not a battle action', () => {
  it.each([
    [0, 0, 20, 'needs-bread'], [0, 0, 5, 'needs-bread'],
    [0, 2, 5, 'daily-limit'], [8, 2, 5, 'daily-limit'],
    [8, 1, 20, 'full'], [8, 1, 5, 'ready'],
  ] as const)('bread %i / used %i / HP %i → %s', (bread, used, hp, status) => {
    expect(recoveryAvailability(bread, used, hp, 20)).toBe(status);
  });
  it('presents only the relevant new items, without hidden water / Eye of Ender solutions', () => {
    const crafting = renderToStaticMarkup(createElement(EndChapterNoticePanel, { kind: 'crafting', onClose() {} }));
    const help = renderToStaticMarkup(createElement(BreadRecoveryHelp, { onClose() {} }));
    expect(crafting).toContain('/mining/Shield.webp');
    expect(crafting).toContain('パン');
    expect(help).toContain('こむぎ3こで、パン1こ');
    expect(help).toContain('ハート5こ回復');
    for (const html of [crafting, help]) for (const spoiler of ['エンダーアイ', 'Water.png', '水を']) expect(html).not.toContain(spoiler);
  });
});
