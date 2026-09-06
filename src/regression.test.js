import { describe, expect, it } from 'vitest';
import { FACTORS, factorAvailability, factorPlot, factorValue, fitNeighborhoodModel, neighborhoodHomes, predictHome } from './regression';
import { dashboardDataFromApi } from './api';
import snapshot from './default-analysis.json';

function fixture(n = 40) {
  return Array.from({ length: n }, (_, i) => {
    const home = { id: `home-${i}`, fullAddress: `${i} Test St`, sqft: 1200 + (i * 137) % 1700, beds: 1 + (i % 5), baths: 1 + ((i * 7) % 5) / 2, acres: 0.1 + ((i * 3) % 11) / 10, yearBuilt: 1950 + ((i * 13) % 70), status: i % 2 ? 'Active' : 'Inactive', distance: 0.1 + (i % 7) / 10 };
    home.price = 50000 + 170 * home.sqft + 14000 * home.beds + 22000 * home.baths + 90000 * home.acres + 1500 * (home.yearBuilt - 1900) + (i % 2) * 19000;
    return home;
  });
}
const keys = FACTORS.slice(0, 6).map(({ key }) => key);

describe('neighborhood OLS', () => {
  it('recovers a known multiple regression in original dollar units', () => {
    const homes = fixture();
    const model = fitNeighborhoodModel(homes, keys);
    expect(model.ok).toBe(true);
    const expected = { sqft: 170, beds: 14000, baths: 22000, acres: 90000, yearBuilt: 1500, active: 19000 };
    for (const coefficient of model.coefficients) expect(coefficient.value).toBeCloseTo(expected[coefficient.key], 5);
    expect(model.intercept).toBeCloseTo(50000 - 1500 * 1900, 4);
    expect(model.rmse).toBeLessThan(1e-6);
    expect(model.looRmse).toBeLessThan(1e-6);
    expect(model.rSquared).toBeCloseTo(1);
    expect(predictHome(model, homes[5]).value).toBeCloseTo(homes[5].price, 5);
  });

  it('computes leave-one-out error equal to explicitly refitting each held-out home', () => {
    const homes = fixture(20).map((home, i) => ({ ...home, price: home.price + Math.sin(i) * 23000 }));
    const model = fitNeighborhoodModel(homes, ['sqft', 'yearBuilt', 'active']);
    const errors = homes.map((home, i) => {
      const fit = fitNeighborhoodModel(homes.filter((_, j) => i !== j), ['sqft', 'yearBuilt', 'active']);
      return (home.price - predictHome(fit, home).value) ** 2;
    });
    expect(model.looRmse).toBeCloseTo(Math.sqrt(errors.reduce((a, b) => a + b, 0) / errors.length), 5);
  });

  it('uses real snapshot availability and refuses a subject prediction with missing facts', () => {
    const dashboard = dashboardDataFromApi(snapshot, 'fallback');
    const homes = neighborhoodHomes(dashboard.comparables, dashboard.subject).rows;
    const availability = factorAvailability(homes);
    expect(availability.find(({ key }) => key === 'acres').reason).toBe('Not reported');
    expect(availability.find(({ key }) => key === 'baths').reason).toBe('No variation');
    const selected = availability.filter(({ defaultSelected }) => defaultSelected).map(({ key }) => key);
    expect(selected).toEqual(['sqft', 'beds', 'yearBuilt', 'active']);
    const model = fitNeighborhoodModel(homes, selected);
    expect(model.ok).toBe(true);
    expect(model.n).toBe(15);
    const prediction = predictHome(model, dashboard.subject.regressionFacts);
    expect(prediction.value).toBeNull();
    expect(prediction.missing).toContain('Square footage');
    expect(prediction.outside).toContain('Year built');
  });

  it('keeps null missing, studio zero valid, and unknown status separate', () => {
    expect(factorValue({ beds: 0 }, 'beds')).toBe(0);
    expect(factorValue({ beds: null }, 'beds')).toBeNull();
    expect(factorValue({ sqft: 0 }, 'sqft')).toBeNull();
    expect(factorValue({ status: ' ACTIVE ' }, 'active')).toBe(1);
    expect(factorValue({ status: 'Inactive' }, 'active')).toBe(0);
    expect(factorValue({ status: 'Sold' }, 'active')).toBeNull();
    const homes = fixture(16).map((home, i) => i < 3 ? { ...home, status: 'Unknown' } : home);
    expect(fitNeighborhoodModel(homes, ['sqft', 'active']).missingCount).toBe(3);
  });

  it('omits unavailable and constant factors, and handles collinearity explicitly', () => {
    const homes = fixture(20).map((home) => ({ ...home, beds: home.sqft / 1000, baths: 2, acres: null }));
    const model = fitNeighborhoodModel(homes, ['sqft', 'beds', 'baths', 'acres']);
    expect(model.ok).toBe(true);
    expect(model.factors.map(({ key }) => key)).toEqual(['sqft']);
    expect(model.omitted.map(({ key }) => key)).toEqual(['baths', 'acres', 'beds']);
    expect(model.omitted.at(-1).reason).toContain('Redundant');
  });

  it('requires enough complete homes and residual degrees of freedom', () => {
    expect(fitNeighborhoodModel(fixture(7), ['sqft']).ok).toBe(false);
    expect(fitNeighborhoodModel(fixture(8), keys).ok).toBe(false);
    const model = fitNeighborhoodModel(fixture(20).map((home, i) => i > 5 ? { ...home, acres: null } : home), ['sqft', 'acres']);
    expect(model.ok).toBe(false);
    expect(model.missingCount).toBe(14);
    expect(fitNeighborhoodModel(fixture(), []).ok).toBe(false);
  });

  it('returns no R squared for a constant outcome', () => {
    const model = fitNeighborhoodModel(fixture().map((home) => ({ ...home, price: 500000 })), ['sqft']);
    expect(model.ok).toBe(true);
    expect(model.rSquared).toBeNull();
    expect(model.adjustedRSquared).toBeNull();
  });

  it('excludes the subject and duplicate homes while preserving apartment identities', () => {
    const homes = [
      { id: 'subject', fullAddress: '10 Main St, Apt 1', price: 600000 },
      { id: 'unit2', fullAddress: '10 Main St, Apt 2', price: 650000, lastSeenDate: '2026-01-01' },
      { id: 'unit2', fullAddress: '10 Main St, Apt 2', price: 620000, lastSeenDate: '2026-02-01' },
      { id: 'unit3', fullAddress: '10 Main St, Apt 3', price: 710000 },
      { fullAddress: ' 10 MAIN ST, Apt 3 ', price: 710000 },
      { fullAddress: '11 Main St', price: null },
    ];
    const cleaned = neighborhoodHomes(homes, { address: '10 Main St, Apt 1' });
    expect(cleaned.rows.map(({ price }) => price)).toEqual([620000, 710000]);
    expect(cleaned.excluded).toEqual({ subject: 1, duplicates: 2, price: 1 });
  });

  it('plots raw prices and the subject separately, with a conditional multiple-regression line', () => {
    const homes = fixture();
    const model = fitNeighborhoodModel(homes, keys);
    const subject = { ...homes[0], sqft: 9000, acres: null };
    const plot = factorPlot(homes, subject, 750000, FACTORS[0], model);
    expect(plot.points.map(({ y }) => y)).toEqual(homes.map(({ price }) => price));
    expect(plot.subjectPoint).toMatchObject({ x: 9000, y: 750000, isSubject: true });
    for (const point of plot.line) {
      const baseline = Object.fromEntries(model.factors.map((factor) => [factor.key, factor.center]));
      const expected = model.intercept + model.coefficients.reduce((sum, c) => sum + c.value * (c.key === 'sqft' ? point.x : baseline[c.key]), 0);
      expect(point.y).toBeCloseTo(expected);
    }
    expect(factorPlot(homes, subject, 750000, FACTORS[3], model).subjectPoint).toBeNull();
    expect(factorPlot(homes, subject, -1, FACTORS[0], model).subjectPoint).toBeNull();
  });
});
