export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function scenarioEstimate(baseSubject, scenario) {
  const sqftEffect = (scenario.squareFeet - baseSubject.squareFeet) * 182;
  const bathEffect = (scenario.baths - baseSubject.baths) * 28500;
  const bedEffect = (scenario.beds - baseSubject.beds) * 18000;
  const acreEffect = (scenario.acres - baseSubject.acres) * 142000;
  const yearEffect = (scenario.yearBuilt - baseSubject.yearBuilt) * 1700;
  return Math.round(clamp(baseSubject.estimate + sqftEffect + bathEffect + bedEffect + acreEffect + yearEffect, 150000, 4000000) / 1000) * 1000;
}

export function weightedComparableValue(comparables) {
  if (!comparables.length) return null;
  const weighted = comparables.reduce((total, comp) => {
    const weight = Math.max(0.05, comp.fit) / Math.max(0.2, comp.distance + 0.25);
    return { value: total.value + comp.price * weight, weight: total.weight + weight };
  }, { value: 0, weight: 0 });
  return weighted.weight ? weighted.value / weighted.weight : null;
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizeComparables(comparables, subjectValue, subjectSqft) {
  const prices = comparables.map((comp) => comp.price);
  const pricePerSqft = comparables.map((comp) => comp.price / comp.sqft);
  const medianPrice = median(prices);
  const medianPpsf = median(pricePerSqft);
  const weightedValue = weightedComparableValue(comparables);
  return {
    count: comparables.length,
    medianPrice,
    medianPpsf,
    weightedValue,
    subjectPpsf: subjectValue / subjectSqft,
    differenceFromMedian: medianPrice ? ((subjectValue / medianPrice) - 1) * 100 : null,
  };
}

export function comparableDealAssessment(comparables, askingPrice, subjectSqft) {
  const validComparables = comparables.filter((comp) => (
    Number.isFinite(comp.price) && comp.price > 0
  ));
  if (!validComparables.length) {
    return { count: 0, expectedValue: null, discountPercent: null, dollarGap: null, confidence: 'Low', adjustedForSize: false };
  }

  const sizeAdjusted = Number.isFinite(subjectSqft) && subjectSqft > 0
    ? validComparables.filter((comp) => Number.isFinite(comp.sqft) && comp.sqft > 0)
    : [];
  const adjustedForSize = sizeAdjusted.length >= 3;
  const evidence = adjustedForSize ? sizeAdjusted : validComparables;
  const weightedValues = evidence.map((comp) => {
    const weight = Math.max(0.05, comp.fit || 0) / Math.max(0.2, (comp.distance || 0) + 0.25);
    const value = adjustedForSize ? (comp.price / comp.sqft) * subjectSqft : comp.price;
    return { value, weight, fit: comp.fit || 0 };
  });
  const totalWeight = weightedValues.reduce((total, item) => total + item.weight, 0);
  const expectedValue = totalWeight
    ? weightedValues.reduce((total, item) => total + item.value * item.weight, 0) / totalWeight
    : null;
  const meanValue = weightedValues.reduce((total, item) => total + item.value, 0) / weightedValues.length;
  const variance = weightedValues.reduce((total, item) => total + ((item.value - meanValue) ** 2), 0) / weightedValues.length;
  const dispersion = meanValue ? Math.sqrt(variance) / meanValue : 1;
  const averageFit = weightedValues.reduce((total, item) => total + item.fit, 0) / weightedValues.length;
  const confidence = evidence.length >= 8 && averageFit >= 0.75 && dispersion <= 0.2
    ? 'High'
    : evidence.length >= 4 && averageFit >= 0.5 && dispersion <= 0.35
      ? 'Medium'
      : 'Low';
  const validAskingPrice = Number.isFinite(askingPrice) && askingPrice > 0 ? askingPrice : null;

  return {
    count: evidence.length,
    expectedValue,
    discountPercent: validAskingPrice && expectedValue ? ((expectedValue - validAskingPrice) / expectedValue) * 100 : null,
    dollarGap: validAskingPrice && expectedValue ? expectedValue - validAskingPrice : null,
    confidence,
    adjustedForSize,
  };
}

export function sliceHistory(history, years) {
  if (years === 'all') return history;
  return history.slice(-Number(years) * 12 - 1);
}
