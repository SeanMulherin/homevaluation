import { describe, expect, it, vi } from 'vitest';
import {
  dashboardDataFromApi,
  fetchAddressAnalysis,
  readCachedDashboard,
  writeCachedDashboard,
  zillowListingUrl,
} from './api';

const payload = {
  subject: {
    formatted_address: '1600 Pennsylvania Avenue NW, Washington, DC 20500',
    city: 'Washington',
    state: 'DC',
    bedrooms: 6,
    bathrooms: 35,
    square_footage: 55000,
    lot_size: 784080,
    year_built: 1800,
    listing_status: 'Active',
    listing_price: 99000000,
    listed_date: '2026-07-15T00:00:00.000Z',
    days_on_market: 22,
  },
  valuation: { price: 100000000, price_range_low: 90000000, price_range_high: 110000000, source: 'RentCast AVM', as_of: '2026-07-15' },
  market: {
    location: 'Washington, DC',
    latest_value: 600000,
    sfr_latest_value: 650000,
    latest_date: '2026-06-30',
    primary_label: 'Single-family homes',
    sfr_series: [{ date: '2026-05-31', value: 640000 }, { date: '2026-06-30', value: 650000 }],
    bedroom_series: [],
  },
  comparables: [{ formatted_address: '1 First St, Washington, DC 20001', status: 'Active', price: 900000, square_footage: 2000, bedrooms: 3, bathrooms: 2, distance: 1.2, correlation: 0.94 }],
  warnings: [],
};

describe('address analysis adapter', () => {
  it('maps API data into every dashboard dataset', () => {
    const result = dashboardDataFromApi(payload, 'fallback address');
    expect(result.subject.address).toContain('Pennsylvania');
    expect(result.subject.marketBenchmark).toBe(650000);
    expect(result.subject.listingPrice).toBe(99000000);
    expect(result.subject.listingStatus).toBe('Active');
    expect(result.market.history).toHaveLength(2);
    expect(result.market.hasBedroomSeries).toBe(false);
    expect(result.market.history[0].bedroom).toBeNull();
    expect(result.comparables[0].location).toBe('Washington, DC 20001');
    expect(result.comparables[0].zillowUrl).toBe(zillowListingUrl(payload.comparables[0].formatted_address));
  });

  it('adds Zillow links only to active comparable listings', () => {
    const result = dashboardDataFromApi({
      ...payload,
      comparables: [
        payload.comparables[0],
        { ...payload.comparables[0], formatted_address: '2 Second St, Washington, DC 20001', status: 'Inactive' },
      ],
    }, 'fallback address');

    expect(result.comparables[0].zillowUrl).toContain('zillow.com/homes/');
    expect(result.comparables[1].zillowUrl).toBeNull();
  });

  it('keeps a distinct bedroom series when Zillow provides one', () => {
    const result = dashboardDataFromApi({
      ...payload,
      market: {
        ...payload.market,
        primary_label: '4 bedroom homes',
        bedroom_series: [{ date: '2026-05-31', value: 700000 }, { date: '2026-06-30', value: 710000 }],
      },
    }, 'fallback address');

    expect(result.market.hasBedroomSeries).toBe(true);
    expect(result.market.history.map((point) => point.bedroom)).toEqual([700000, 710000]);
  });

  it('posts the requested address to the backend', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    await fetchAddressAnalysis('1600 Pennsylvania Avenue NW, Washington, DC 20500', fetchImpl);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).address).toContain('Pennsylvania');
  });

  it('stores and restores dashboard data for instant repeat loads', () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    };
    const dashboard = dashboardDataFromApi(payload, 'fallback address');

    writeCachedDashboard('1600 Pennsylvania Avenue NW, Washington, DC 20500', dashboard, storage);

    expect(readCachedDashboard('  1600  Pennsylvania Avenue NW, Washington, DC 20500 ', storage)).toEqual(dashboard);
  });
});
