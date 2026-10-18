const TIMEOUT_MS = 15_000;
/** An honest User-Agent: shops can see who reads their pages. */
const USER_AGENT = 'Mozilla/5.0 (compatible; PriceRadar/0.1; personal price tracker)';

/**
 * Downloads a product page as text.
 * Stops on the per-page timeout or when the caller aborts (service shutdown), whichever comes first.
 */
export async function fetchPage(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
  });
  if (!response.ok) throw new Error(`${url} responded with ${response.status}`);
  return response.text();
}
