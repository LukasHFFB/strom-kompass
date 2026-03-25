import { NTP_CONFIG } from '@/config/api';

let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Obtain an OAuth2 access token using the Client Credentials grant.
 * Caches the token until 60 s before expiry.
 */
export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const clientId = process.env.NTP_CLIENT_ID!;
  const clientSecret = process.env.NTP_CLIENT_SECRET!;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(NTP_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Netztransparenz OAuth error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const expiresIn = json.expires_in ?? 3600;

  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  };

  return tokenCache.token;
}
