import type { BlazeRun, BlazeAction, actOnBlaze } from './blazePrototypeEngine';
import type { EndermanRun, EndermanAction, actOnEnderman } from './endermanPrototypeEngine';
import type { DragonCampaign, CampaignAction, CampaignOutcome } from './dragonCampaignEngine';
type Common = { onClose: () => void; onPrepare?: () => void; onShowTutorial?: () => void; retry: () => void; next: () => void; onHelp: () => void; seenHelp: boolean; endermanDefeats: number; heldItems: string[]; breadStock: number; foodToday: number };
export type BlazePort = Common & { run: BlazeRun; act: (action: BlazeAction) => ReturnType<typeof actOnBlaze> };
export type EndermanPort = Common & { run: EndermanRun; act: (action: EndermanAction) => ReturnType<typeof actOnEnderman> };
export type DragonPort = Common & { run: DragonCampaign; act: (action: CampaignAction) => CampaignOutcome };
