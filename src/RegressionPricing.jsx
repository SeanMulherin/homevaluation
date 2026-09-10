const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const positive = value => Number.isFinite(value) && value > 0;
const amount = value => Number.isFinite(value) ? money.format(value) : 'Unavailable';
const signedAmount = value => !Number.isFinite(value) ? 'Unavailable'
  : value === 0 ? amount(0) : `${value > 0 ? '+' : '−'}${amount(Math.abs(value))}`;
const signedPercent = value => !Number.isFinite(value) ? 'Unavailable'
  : value === 0 ? '0%' : `${value > 0 ? '+' : '−'}${percent.format(Math.abs(value))}%`;

export function regressionPriceComparison(modelValue, price) {
  if (!positive(modelValue) || !positive(price)) return null;
  const difference = price - modelValue;
  return { difference, percent: difference / modelValue * 100,
    direction: difference < 0 ? 'below' : difference > 0 ? 'above' : 'equal' };
}

export default function RegressionPricing({ model, prediction, comparisonPrice, comparisonLabel = 'House price', priceOverride, onPriceChange, idle = false }) {
  const modelValue = model.ok && positive(prediction.value) ? prediction.value : null;
  const entered = priceOverride.trim() !== '';
  const subjectPrice = entered ? Number(priceOverride) : comparisonPrice;
  const label = entered ? 'Entered price' : comparisonLabel;
  const comparison = regressionPriceComparison(modelValue, subjectPrice);
  const error = model.ok && Number.isFinite(model.looRmse) ? model.looRmse : null;
  const smallGap = comparison && error != null && Math.abs(comparison.difference) < error;
  const extrapolating = prediction.outside.length > 0;
  const reason = idle ? 'Enter an address and click Analyze to estimate the home’s value.'
    : !model.ok ? model.reason
    : prediction.missing.length ? `The subject is missing ${prediction.missing.join(', ').toLowerCase()}. A model value cannot be calculated.`
    : !modelValue ? 'The fitted model does not produce a positive value for this home. Revise the factors or neighborhood sample.' : null;
  return <section className="regression-pricing" aria-label="Regression pricing assessment">
    <h3>OLS price estimate and subject-home gap</h3>
    <p>The ordinary least-squares fit estimates the subject home's price from nearby listings. The gap compares that fitted value with the subject price shown on the charts.</p>
    <div className="regression-pricing-grid" aria-live="polite">
      <div><span>OLS trend estimate</span><strong>{amount(modelValue)}</strong><small>At the subject home's reported characteristics</small></div>
      <div><span>{label}</span><strong>{positive(subjectPrice) ? amount(subjectPrice) : 'Not provided'}</strong><small>{entered ? 'Your comparison price' : label === 'Subject AVM estimate' ? 'RentCast address-level estimate' : 'Reported active listing price'}</small></div>
      <div><span>Dollar gap</span><strong>{comparison ? signedAmount(comparison.difference) : 'Unavailable'}</strong><small>{comparison ? comparison.direction === 'equal' ? 'Subject price equals the OLS estimate' : `${label} is ${comparison.direction} the OLS estimate` : 'Requires an OLS estimate and subject price'}</small></div>
      <div><span>Percentage gap</span><strong>{comparison ? signedPercent(comparison.percent) : 'Unavailable'}</strong><small>(Subject price − OLS estimate) ÷ OLS estimate</small></div>
    </div>
    <label className="regression-comparison-input">Asking or purchase price to compare (USD)
      <input type="number" min="1" step="any" value={priceOverride} placeholder={positive(comparisonPrice) ? String(comparisonPrice) : 'Enter a price'} onChange={event => onPriceChange(event.target.value)} disabled={idle} />
    </label>
    {reason && <p className="regression-pricing-status" role="status">{reason}</p>}
    {modelValue && !comparison && <p className="regression-pricing-status">Enter a positive asking or purchase price to assess it against the fitted value.</p>}
    {comparison && <div className="regression-pricing-verdict" aria-live="polite">
      <strong>{comparison.direction === 'equal' ? 'Priced at the model estimate' : comparison.direction === 'below' ? 'Potentially undervalued relative to the model' : 'Potentially overvalued relative to the model'}</strong>
      <p>{label} {comparison.direction === 'equal' ? 'equals' : `is ${percent.format(Math.abs(comparison.percent))}% ${comparison.direction}`} the model estimate{comparison.direction !== 'equal' ? `, a difference of ${amount(Math.abs(comparison.difference))}` : ''}.</p>
      {smallGap && <p>The price gap is smaller than the model’s leave-one-out prediction error. This difference is inconclusive.</p>}
      {extrapolating && <p>This comparison extrapolates beyond the observed range for {prediction.outside.join(', ').toLowerCase()}.</p>}
    </div>}
    {model.ok && <p className="regression-pricing-footnote">Based on {model.n} neighborhood listings. Leave-one-out prediction error: {amount(error)}. This error summarizes held-out predictions; it is not a confidence interval.</p>}
    <p className="regression-pricing-footnote">Above or below refers to this fitted model, not an independently established market value. The model uses listing prices, including last asking prices for inactive listings.</p>
  </section>;
}
