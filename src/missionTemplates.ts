export interface MissionTemplate {
  id: string;
  emoji: string;
  title: string;
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  { id: "read", emoji: "📚", title: "本を読む" },
  { id: "clean", emoji: "🧹", title: "おへや片付け" },
  { id: "kind", emoji: "🤝", title: "仲良くする" },
  { id: "thanks", emoji: "🙏", title: "ありがとう" },
  { id: "piano", emoji: "🎹", title: "ピアノ練習" },
  { id: "play", emoji: "🏃", title: "外で遊ぶ" },
  { id: "help", emoji: "🍽️", title: "お手伝い" },
  { id: "study", emoji: "✏️", title: "べんきょう" },
];

export const MISSION_EMOJIS = ["📚", "🧹", "🤝", "🙏", "🎹", "🏃", "🍽️", "✏️", "⭐", "🎯", "🎨", "🧸", "💪", "🌱", "🎵"];
