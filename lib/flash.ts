/** Passe un message de succès entre pages via sessionStorage. */
export function setFlash(msg: string) {
  if (typeof window !== 'undefined') sessionStorage.setItem('siga_flash', msg);
}

export function popFlash(): string | null {
  if (typeof window === 'undefined') return null;
  const msg = sessionStorage.getItem('siga_flash');
  if (msg) sessionStorage.removeItem('siga_flash');
  return msg;
}
