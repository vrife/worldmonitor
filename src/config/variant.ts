function detectVariantFromHostname(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (host.startsWith('tech.')) return 'tech';
  if (host.startsWith('finance.')) return 'finance';
  return null;
}

export const SITE_VARIANT: string = (() => {
  // Hostname takes priority — visiting tech.worldmonitor.io must show the tech variant
  const hostVariant = detectVariantFromHostname();
  if (hostVariant) return hostVariant;

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('worldmonitor-variant');
    if (stored === 'tech' || stored === 'full' || stored === 'finance') return stored;
  }
  return import.meta.env.VITE_VARIANT || 'full';
})();
