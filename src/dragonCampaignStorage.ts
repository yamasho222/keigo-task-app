import { isDragonCampaign, type DragonCampaign } from './dragonCampaignEngine';

/** These are the ONLY storage keys used by this lab. Never use application/cloud keys. */
export const DRAGON_LAB_KEY = 'dev:dragon-campaign:v1';
export const DRAGON_LAB_BACKUP_KEY = 'dev:dragon-campaign:v1:backup';
export const DRAGON_LAB_SNAPSHOT_KEY = 'dev:dragon-campaign:v1:stage-snapshot';
export const DRAGON_LAB_LOCK = 'dev-dragon-campaign-v1-write';
export type CampaignStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type CampaignLoad = { state: DragonCampaign | null; error?: string; backup?: DragonCampaign };

function parse(text: string | null): DragonCampaign | null {
  if (!text) return null;
  try { const value: unknown = JSON.parse(text); return isDragonCampaign(value) ? value : null; } catch { return null; }
}
export function loadDragonSnapshot(storage: CampaignStorage): DragonCampaign | null {
  try { return parse(storage.getItem(DRAGON_LAB_SNAPSHOT_KEY)); } catch { return null; }
}
export function loadDragonCampaign(storage: CampaignStorage): CampaignLoad {
  try {
    const raw = storage.getItem(DRAGON_LAB_KEY);
    if (!raw) return { state: null };
    const state = parse(raw);
    if (state) return { state };
    const backup = parse(storage.getItem(DRAGON_LAB_BACKUP_KEY));
    return { state: null, error: '試験記録を読めませんでした。元の記録は上書きしていません。', ...(backup ? { backup } : {}) };
  } catch { return { state: null, error: '保存先にアクセスできません。記録を守るため、まだ行動を確定していません。' }; }
}

/** Call inside the Web Locks critical section. Reject stale tabs rather than overwriting. */
export function saveDragonCampaign(storage: CampaignStorage, state: DragonCampaign, expectedRevision: number | null, replace = false): { error?: string } {
  if (!isDragonCampaign(state)) return { error: '記録の整合性を確認できませんでした。行動は確定していません。' };
  try {
    const raw = storage.getItem(DRAGON_LAB_KEY), current = parse(raw);
    if (!replace && ((raw && !current) || (expectedRevision === null ? raw !== null : !current || current.revision !== expectedRevision || current.id !== state.id))) {
      return { error: '別のタブで記録が変わりました。読み込み直してから続けてください。' };
    }
    if (raw && current) {
      if (replace) storage.setItem(DRAGON_LAB_SNAPSHOT_KEY, raw);
      storage.setItem(DRAGON_LAB_BACKUP_KEY, raw);
    }
    storage.setItem(DRAGON_LAB_KEY, JSON.stringify(state));
    return {};
  } catch { return { error: '保存できませんでした。チケット・アイテムの使用は確定していません。保存領域を確認してください。' }; }
}
