// src/lib/tg.ts
export const tg = (window as any)?.Telegram?.WebApp ?? {};
export function setMainButton(text: string, onClick?: () => void) {
  if (!tg.MainButton) return;
  tg.MainButton.text = text;
  tg.MainButton.onClick(onClick || (() => {}));
  tg.MainButton.show();
}
