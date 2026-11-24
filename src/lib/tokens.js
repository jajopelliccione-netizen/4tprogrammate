export function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Token d'invito: 32 byte casuali = 64 caratteri esadecimali.
export const newToken = () => randomHex(32);

// Email interna (lo studente non la vede mai). Casuale, quindi impossibile da
// indovinare e da "occupare" in anticipo da chi non ha il token.
export const newInternalEmail = () => `s${randomHex(12)}@studenti.4tssa.app`;
