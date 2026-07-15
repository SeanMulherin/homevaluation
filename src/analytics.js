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

export function sliceHistory(history, years) {
  if (years === 'all') return history;
  return history.slice(-Number(years) * 12 - 1);
}
