/**
 * appState/main はスナップショット全体で置き換える。
 * merge:true だと、0個になって消した素材キーが Firestore に残り、
 * 再読込で「クラフトしたのに素材が減っていない」になる。
 */
export const APP_STATE_DOC_MERGE = false;

export function firestoreAppStateSetOptions(): { merge: true } | undefined {
  return APP_STATE_DOC_MERGE ? { merge: true } : undefined;
}
