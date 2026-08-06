import { describe, expect, it } from 'vitest';
import {
  comparableDealAssessment,
  median,
  scenarioEstimate,
  sliceHistory,
  weightedComparableValue,
} from './analytics';

describe('housing analytics', () => {
  it('calculates medians for odd and even arrays', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('raises the scenario estimate for a larger home', () => {
    const base = { estimate: 786000, squareFeet: 2474, baths: 2.5, beds: 3, acres: 0.17, yearBuilt: 1990 };
    expect(scenarioEstimate(base, { ...base, squareFeet: 2674 })).toBeGreaterThan(base.estimate);
  });

  it('weights closer comparable properties more heavily', () => {
    const value = weightedComparableValue([
      { price: 600000, fit: 0.95, distance: 0.2 },
      { price: 1000000, fit: 0.95, distance: 2.0 },
    ]);
    expect(value).toBeLessThan(800000);
  });

  it('slices monthly history by year', () => {
    expect(sliceHistory(Array.from({ length: 121 }), 5)).toHaveLength(61);
  });

  it('calculates a size-adjusted discount from nearby comparables', () => {
    const assessment = comparableDealAssessment([
      { price: 600000, sqft: 2000, fit: 0.9, distance: 0.2 },
      { price: 720000, sqft: 2400, fit: 0.85, distance: 0.3 },
      { price: 540000, sqft: 1800, fit: 0.8, distance: 0.4 },
      { price: 660000, sqft: 2200, fit: 0.75, distance: 0.5 },
    ], 600000, 2200);

    expect(assessment.expectedValue).toBeCloseTo(660000);
    expect(assessment.discountPercent).toBeCloseTo(9.09, 1);
    expect(assessment.dollarGap).toBeCloseTo(60000);
    expect(assessment.adjustedForSize).toBe(true);
    expect(assessment.confidence).toBe('Medium');
  });
});
