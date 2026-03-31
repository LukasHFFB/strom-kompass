import { NTP_CONFIG, buildNtpUrl } from '@/config/api';
import { getAccessToken } from './auth';

/**
 * Generic fetch for any Netztransparenz endpoint.
 * Returns raw response text (CSV for most endpoints, JSON for some).
 */
export async function fetchNtpEndpoint(
  endpoint: { data: string; product: string | null },
  from: Date,
  to: Date
): Promise<string> {
  const token = await getAccessToken();
  const url = buildNtpUrl(endpoint, from, to);

  console.log(`[NTP] Fetching: ${url}`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/csv',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Netztransparenz API error ${res.status} [${url}]: ${text}`);
  }

  const text = await res.text();
  
  // The NTP API sometimes returns the CSV wrapped completely in a JSON string
  if (text.trim().startsWith('"') && text.trim().endsWith('"')) {
    try {
      return JSON.parse(text);
    } catch (e) {
      // Ignore and return raw text
    }
  }

  return text;
}

// ─── Convenience exports for common endpoints ──────────────────────────

const ep = NTP_CONFIG.endpoints;

export const fetchMarketValues = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.MONTHLY_MARKET_VALUES, from, to);

export const fetchAnnualMarketValues = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.ANNUAL_MARKET_VALUES, from, to);

export const fetchSpotMarketPrices = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.SPOT_MARKET_PRICE, from, to);

export const fetchSolarProjection = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.SOLAR_PROJECTION, from, to);

export const fetchWindProjection = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.WIND_PROJECTION, from, to);

export const fetchOnlineSolarProjection = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.ONLINE_SOLAR, from, to);

export const fetchOnlineWindOnshoreProjection = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.ONLINE_WIND_ONSHORE, from, to);

export const fetchOnlineWindOffshoreProjection = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.ONLINE_WIND_OFFSHORE, from, to);

export const fetchSolarForecast = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.SOLAR_FORECAST, from, to);

export const fetchWindForecast = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.WIND_FORECAST, from, to);

export const fetchNegativePrices1h = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.NEGATIVE_PRICES_1H, from, to);

export const fetchNegativePrices6h = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.NEGATIVE_PRICES_6H, from, to);

export const fetchRedispatch = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.REDISPATCH, from, to);

export const fetchMarketingEpex = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.MARKETING_EPEX, from, to);

export const fetchMarketingSolar = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.MARKETING_SOLAR, from, to);

export const fetchMarketingWind = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.MARKETING_WIND, from, to);

export const fetchGccBalanceOperational = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.GCC_BALANCE_OPERATIONAL, from, to);

export const fetchGccTrafficLight = (from: Date, to: Date) =>
  fetchNtpEndpoint(ep.GCC_TRAFFIC_LIGHT, from, to);
