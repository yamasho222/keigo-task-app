import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdventureBattlePanel } from './AdventureBattlePanel';
import BlazePrototype from './BlazePrototype';
import EndermanPrototype from './EndermanPrototype';
import DragonCampaignLab from './DragonCampaignLab';
import { projectAdventure, transitionAdventure, type AdventureCommand } from './adventureSession';
import type { AdventureLocation } from './adventureState';
import type { MiningPatch } from './miningCommit';
import { emptyMiningState, type MiningState } from './miningTypes';

const DAY = '2026-10-19';
const locations = ['fortress', 'warped_forest'] as const;
type ElementProps = { children?: ReactNode; className?: string; disabled?: boolean; onClick?: () => void };

function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join('');
  if (isValidElement<ElementProps>(node)) return text(node.props.children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
function step(state: MiningState, location: AdventureLocation, request: { kind: 'enter' | 'lesson' } | { kind: 'blaze' | 'enderman'; action: { kind: 'strike' | 'guard'; target?: { enemyId: number; part: 'body' } } }) {
  const result = transitionAdventure(state, { ...request, location, day: DAY, revision: state.adventure?.revision ?? -1 } as AdventureCommand);
  expect(result.error).toBeUndefined();
  return result.state;
}
function ready(location: AdventureLocation, tickets: number, hands: number) {
  const base = emptyMiningState();
  base.unlockedGachas.push(location);
  base.tickets = tickets;
  base.crafted.sword_diamond = true;
  base.materials = { blaze_rod: 2, ender_pearl: 3 };
  let state = step(base, location, { kind: 'enter' });
  state = step(state, location, { kind: 'lesson' });
  state.adventure!.hands = hands;
  return state;
}
function victory(location: typeof locations[number], tickets: number, hands: number) {
  const state = ready(location, tickets, hands + 1);
  if (location === 'fortress') {
    state.adventure!.blaze!.enemies[0].hp = 1;
    return step(state, location, { kind: 'blaze', action: { kind: 'strike', target: { enemyId: 0, part: 'body' } } });
  }
  state.adventure!.enderman!.enemyHp = 1;
  state.adventure!.enderman!.intent = 'approach';
  return step(state, location, { kind: 'enderman', action: { kind: 'strike' } });
}

// Capture the actual JSX handlers during server rendering, without a browser or mocked hooks.
function battleUi(initial: MiningState, location: AdventureLocation) {
  let mining = initial;
  let activeLocation: AdventureLocation | null = location;
  let tree: ReactNode;
  const onClose = vi.fn(() => { activeLocation = null; });
  const onChange = vi.fn((patch: MiningPatch) => { mining = patch(mining); });
  function Capture() {
    const panel = AdventureBattlePanel({ mining, location, dateKey: DAY, onChange, onClose });
    const battle = elements(panel).find(node => [BlazePrototype, EndermanPrototype, DragonCampaignLab].includes(node.type as typeof BlazePrototype));
    expect(battle).toBeDefined();
    if (battle!.type === BlazePrototype) tree = BlazePrototype(battle!.props as ComponentProps<typeof BlazePrototype>);
    else if (battle!.type === EndermanPrototype) tree = EndermanPrototype(battle!.props as ComponentProps<typeof EndermanPrototype>);
    else tree = DragonCampaignLab(battle!.props as ComponentProps<typeof DragonCampaignLab>);
    return tree;
  }
  const html = renderToStaticMarkup(createElement(Capture));
  return { html, nodes: elements(tree), onClose, onChange, mining: () => mining, location: () => activeLocation };
}
function button(nodes: ReactElement<ElementProps>[], label: string) {
  const found = nodes.find(node => node.type === 'button' && text(node.props.children) === label);
  expect(found, label).toBeDefined();
  expect(found!.props.disabled).not.toBe(true);
  expect(found!.props.onClick).toBeTypeOf('function');
  return found!;
}

afterEach(() => vi.unstubAllGlobals());

describe('production victory exits', () => {
  for (const location of locations) for (const tickets of [0, 5]) it.each([0, 2])(`${location}: exits with ${tickets} tickets and %i prepaid actions without changing the save`, hands => {
    const state = victory(location, tickets, hands), saved = structuredClone(state);
    const ui = battleUi(state, location);
    const result = ui.nodes.find(node => node.props.className === 'bp-result bp-result-won');
    expect(result).toBeDefined();
    expect(ui.html).toContain(location === 'fortress' ? 'ブレイズロッド' : 'エンダーパール');
    const exit = button(elements(result), 'かえる');
    expect(ui.html).toMatch(/<button type="button" class="bp-secondary-button">[\s\S]*?かえる<\/button>/);
    button(elements(result), 'もういちど');
    exit.props.onClick!();
    expect(ui.onClose).toHaveBeenCalledOnce();
    expect(ui.location()).toBeNull();
    expect(ui.onChange).not.toHaveBeenCalled();
    expect(ui.mining()).toBe(state);
    expect(state).toEqual(saved);
    expect(state.tickets).toBe(tickets);
    expect(state.adventure!.hands).toBe(hands);
    expect(state.materials[location === 'fortress' ? 'blaze_rod' : 'ender_pearl']).toBe(location === 'fortress' ? 3 : 4);
    const reopened = step(state, location, { kind: 'enter' });
    expect(projectAdventure(reopened, location).run).toMatchObject({ phase: 'won', handsLeft: hands });
    expect(reopened.materials).toEqual(saved.materials);
    expect(reopened.tickets).toBe(tickets);
  });

  it.each(locations)('%s keeps the next-battle action and its prepaid actions', location => {
    const state = victory(location, 0, 2), ui = battleUi(state, location);
    button(ui.nodes, 'もういちど').props.onClick!();
    expect(ui.onClose).not.toHaveBeenCalled();
    expect(ui.onChange).toHaveBeenCalledOnce();
    expect(projectAdventure(ui.mining(), location).run).toMatchObject({ phase: 'battle', handsLeft: 2 });
    expect(ui.mining().tickets).toBe(0);
    expect(ui.mining().materials).toEqual(state.materials);
  });

  it.each(locations)('%s preserves the paid defeat retry', location => {
    const state = ready(location, 5, 1);
    state.adventure!.hp = 1;
    if (location === 'fortress') state.adventure!.blaze!.enemies[0].intent = 'burst';
    if (location === 'warped_forest') state.adventure!.enderman!.intent = 'approach';
    const lost = step(state, location, { kind: location === 'fortress' ? 'blaze' : 'enderman', action: { kind: 'guard' } });
    expect(projectAdventure(lost, location).run).toMatchObject({ phase: 'lost' });
    const ui = battleUi(lost, location);
    button(ui.nodes, '1まいで おきあがる（ハート5・4かい）').props.onClick!();
    expect(ui.onClose).not.toHaveBeenCalled();
    expect(ui.mining().tickets).toBe(4);
    expect(projectAdventure(ui.mining(), location).run).toMatchObject({ phase: 'battle', hp: 10, handsLeft: 4 });
  });

  it('retains the existing free dragon reward exit', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), location: { search: '' } });
    const state = ready('the_end', 0, 2);
    Object.assign(state.adventure!.dragon!, { status: 'won', bodyHp: 0, checkpointHp: 0, rewardClaimed: true });
    state.crafted.elytra = true;
    const saved = structuredClone(state), ui = battleUi(state, 'the_end');
    expect(ui.html).toContain('エリトラ');
    button(ui.nodes, 'ぼうけんへ').props.onClick!();
    expect(ui.onClose).toHaveBeenCalledOnce();
    expect(ui.location()).toBeNull();
    expect(ui.onChange).not.toHaveBeenCalled();
    expect(state).toEqual(saved);
  });
});
