/** The listener's country (two letters, from Cloudflare via the Worker), asked once a visit, for
 * artists' stats. Null when it can't be had. */
let asked: Promise<string | null> | null = null;

export function country(): Promise<string | null> {
  if (!asked) {
    asked = (async () => {
      try {
        const saved = sessionStorage.getItem('wavee.country');
        if (saved) return saved === '-' ? null : saved;
      } catch {
        // Private mode: ask.
      }
      try {
        const res = await fetch('/api/geo');
        const { country } = (await res.json()) as { country?: string | null };
        const code = country && /^[A-Z]{2}$/.test(country) ? country : null;
        try {
          sessionStorage.setItem('wavee.country', code ?? '-');
        } catch {
          // Asked again next visit.
        }
        return code;
      } catch {
        return null;
      }
    })();
  }
  return asked;
}
