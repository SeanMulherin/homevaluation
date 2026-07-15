'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  Filter,
  Home,
  Info,
  LandPlot,
  MapPin,
  Maximize2,
  RefreshCw,
  Ruler,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { comparables, marketHistory, subject } from './data';
import { scenarioEstimate, sliceHistory, summarizeComparables } from './analytics';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function Metric({ label, value, detail, tone = 'default', icon: Icon }) {
  return (
    <div className={`metric metric--${tone}`}>
      <div className="metric__label"><Icon size={15} aria-hidden="true" />{label}</div>
      <div className="metric__value">{value}</div>
      <div className="metric__detail">{detail}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.filter((item) => item.value != null).map((item) => (
        <span key={item.dataKey} style={{ color: item.color }}>{item.name}: {money.format(item.value)}</span>
      ))}
    </div>
  );
}

function CompTooltip({ active, payload }) {
  const item = active && payload?.[0]?.payload;
  if (!item) return null;
  return (
    <div className="chart-tooltip chart-tooltip--wide">
      <strong>{item.address}</strong>
      <span>{money.format(item.price)} | {number.format(item.sqft)} sqft</span>
      <span>{item.beds} bd / {item.baths} ba | {item.distance.toFixed(2)} mi</span>
      <span>Fit score {(item.fit * 100).toFixed(0)}%</span>
    </div>
  );
}

function InputStepper({ label, value, min, max, step, suffix, onChange }) {
  return (
    <label className="field-control">
      <span>{label}</span>
      <div className="field-control__input">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <small>{suffix}</small>
      </div>
    </label>
  );
}

function App() {
  const [query, setQuery] = useState(subject.address);
  const [displayAddress, setDisplayAddress] = useState(subject.address);
  const [scenario, setScenario] = useState({
    beds: subject.beds,
    baths: subject.baths,
    squareFeet: subject.squareFeet,
    acres: subject.acres,
    yearBuilt: subject.yearBuilt,
  });
  const [historyRange, setHistoryRange] = useState(10);
  const [showSubjectIndex, setShowSubjectIndex] = useState(true);
  const [compStatus, setCompStatus] = useState('All');
  const [compView, setCompView] = useState('scatter');
  const [activeSection, setActiveSection] = useState('overview');
  const [notice, setNotice] = useState('');

  const estimate = useMemo(() => scenarioEstimate(subject, scenario), [scenario]);
  const rangeOffset = (subject.high - subject.low) / 2;
  const estimateLow = estimate - rangeOffset;
  const estimateHigh = estimate + rangeOffset;
  const filteredComps = useMemo(
    () => comparables.filter((comp) => compStatus === 'All' || comp.status === compStatus),
    [compStatus],
  );
  const compSummary = useMemo(
    () => summarizeComparables(filteredComps, estimate, scenario.squareFeet),
    [filteredComps, estimate, scenario.squareFeet],
  );
  const history = useMemo(() => {
    const sliced = sliceHistory(marketHistory, historyRange);
    const latestBedroom = marketHistory.at(-1).bedroom;
    return sliced.map((point) => ({
      ...point,
      subjectIndex: Math.round(point.bedroom * (estimate / latestBedroom)),
    }));
  }, [historyRange, estimate]);
  const premium = ((estimate / subject.marketBenchmark) - 1) * 100;
  const fiveYearHistory = sliceHistory(marketHistory, 5);
  const fiveYearChange = ((fiveYearHistory.at(-1).city / fiveYearHistory[0].city) - 1) * 100;

  const resetScenario = () => {
    setScenario({ beds: subject.beds, baths: subject.baths, squareFeet: subject.squareFeet, acres: subject.acres, yearBuilt: subject.yearBuilt });
    setQuery(subject.address);
    setDisplayAddress(subject.address);
    setNotice('Sample property restored.');
  };

  const runAnalysis = (event) => {
    event.preventDefault();
    const normalized = query.trim() || subject.address;
    setDisplayAddress(normalized);
    setNotice(normalized === subject.address ? 'Sample analysis refreshed.' : 'Scenario updated using the Wilmington sample market model.');
    setTimeout(() => setNotice(''), 3600);
  };

  const compChartData = filteredComps.map((comp) => ({
    ...comp,
    shortAddress: comp.address.length > 22 ? `${comp.address.slice(0, 21)}...` : comp.address,
    ppsf: Math.round(comp.price / comp.sqft),
  }));
  const compMinimum = Math.min(...filteredComps.map((comp) => comp.price));
  const compMaximum = Math.max(...filteredComps.map((comp) => comp.price));
  const compRangePosition = Math.max(
    2,
    Math.min(98, ((estimate - compMinimum) / (compMaximum - compMinimum)) * 100),
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="Housing Market Lab home">
          <span className="brand__mark"><Home size={19} strokeWidth={2.2} /></span>
          <span>Housing Market Lab</span>
        </a>
        <nav className="topnav" aria-label="Dashboard sections">
          {['overview', 'market', 'comparables'].map((section) => (
            <button key={section} className={activeSection === section ? 'is-active' : ''} onClick={() => { setActiveSection(section); document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' }); }}>
              {section}
            </button>
          ))}
        </nav>
        <a className="portfolio-link" href="https://seanmulherin.github.io/" target="_blank" rel="noreferrer">
          Portfolio <ExternalLink size={14} />
        </a>
      </header>

      <section className="workspace-header" id="overview">
        <div className="workspace-header__copy">
          <div className="eyebrow"><span className="status-dot" /> Interactive sample analysis</div>
          <h1>Single-family home valuation</h1>
          <p>{displayAddress}</p>
        </div>
        <form className="address-search" onSubmit={runAnalysis}>
          <MapPin size={18} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Property address" placeholder="Enter a U.S. property address" />
          <button type="submit"><Search size={17} />Analyze</button>
        </form>
        {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}
      </section>

      <div className="dashboard-grid">
        <aside className="scenario-panel" aria-label="Property scenario controls">
          <div className="panel-heading">
            <div><span className="eyebrow">Subject profile</span><h2>Adjust the home</h2></div>
            <button className="icon-button" onClick={resetScenario} title="Reset property scenario" aria-label="Reset property scenario"><RefreshCw size={17} /></button>
          </div>
          <div className="property-type"><Building2 size={17} /><span><small>Property type</small>Single Family</span><ChevronDown size={15} /></div>
          <div className="control-grid">
            <InputStepper label="Bedrooms" value={scenario.beds} min={1} max={8} step={1} suffix="beds" onChange={(value) => setScenario({ ...scenario, beds: value })} />
            <InputStepper label="Bathrooms" value={scenario.baths} min={1} max={8} step={0.5} suffix="baths" onChange={(value) => setScenario({ ...scenario, baths: value })} />
            <InputStepper label="Living area" value={scenario.squareFeet} min={500} max={8000} step={50} suffix="sqft" onChange={(value) => setScenario({ ...scenario, squareFeet: value })} />
            <InputStepper label="Lot size" value={scenario.acres} min={0.03} max={10} step={0.01} suffix="acres" onChange={(value) => setScenario({ ...scenario, acres: value })} />
            <InputStepper label="Year built" value={scenario.yearBuilt} min={1800} max={2026} step={1} suffix="year" onChange={(value) => setScenario({ ...scenario, yearBuilt: value })} />
          </div>
          <div className="scenario-impact">
            <div><SlidersHorizontal size={16} /><span>Scenario impact</span></div>
            <strong className={estimate >= subject.estimate ? 'positive' : 'negative'}>{estimate >= subject.estimate ? '+' : ''}{money.format(estimate - subject.estimate)}</strong>
            <small>Heuristic adjustment from sample AVM</small>
          </div>
          <div className="source-note"><Info size={15} /><p><strong>Sample snapshot</strong> uses the existing app's RentCast comparable set and Zillow market benchmark. Values are illustrative, not an appraisal.</p></div>
        </aside>

        <div className="analysis-canvas">
          <section className="metrics-row" aria-label="Valuation summary">
            <Metric icon={CircleDollarSign} label="Estimated value" value={money.format(estimate)} detail={`${compactMoney.format(estimateLow)} - ${compactMoney.format(estimateHigh)} range`} tone="primary" />
            <Metric icon={Building2} label="City benchmark" value={money.format(subject.marketBenchmark)} detail={`Zillow ZHVI | ${subject.marketAsOf}`} />
            <Metric icon={TrendingUp} label="Market premium" value={`+${premium.toFixed(1)}%`} detail="vs. Wilmington SFR benchmark" tone="positive" />
            <Metric icon={BarChart3} label="Weighted comp value" value={compactMoney.format(compSummary.weightedValue)} detail={`${compSummary.count} comparable properties`} />
            <Metric icon={Activity} label="5-year market change" value={`+${fiveYearChange.toFixed(1)}%`} detail="Wilmington single-family index" tone="positive" />
          </section>

          <section className="analysis-section" id="market">
            <div className="section-heading">
              <div><span className="eyebrow">Market trajectory</span><h2>Value history and home-type context</h2><p>Compare the city index, three-bedroom segment, and an indexed version of this property.</p></div>
              <div className="chart-actions">
                <div className="segmented" aria-label="History range">
                  {[1, 5, 10, 'all'].map((range) => <button key={range} className={historyRange === range ? 'is-active' : ''} onClick={() => setHistoryRange(range)}>{range === 'all' ? 'All' : `${range}Y`}</button>)}
                </div>
                <label className="toggle"><input type="checkbox" checked={showSubjectIndex} onChange={(event) => setShowSubjectIndex(event.target.checked)} /><span />Subject index</label>
              </div>
            </div>
            <div className="chart-frame chart-frame--history">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={history} margin={{ top: 16, right: 24, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="#dfe4df" strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="date" minTickGap={40} tick={{ fill: '#66706a', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis width={72} tickFormatter={(value) => compactMoney.format(value)} tick={{ fill: '#66706a', fontSize: 12 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend verticalAlign="top" align="left" iconType="line" wrapperStyle={{ paddingBottom: 18, fontSize: 12 }} />
                  <Line type="monotone" dataKey="city" name="City SFR ZHVI" stroke="#365b50" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="bedroom" name="3-bedroom segment" stroke="#d18b35" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                  {showSubjectIndex && <Line type="monotone" dataKey="subjectIndex" name="Subject indexed value" stroke="#b7433f" strokeWidth={2.5} strokeDasharray="7 5" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
                  <Brush dataKey="date" height={25} stroke="#9aa79f" fill="#f6f8f5" travellerWidth={8} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="insight-strip">
              <div><Sparkles size={16} /><span><strong>Indexed value</strong> preserves the subject home's current premium while applying historical bedroom-segment movement.</span></div>
              <div><CalendarDays size={16} /><span>Last source refresh: <strong>{subject.valuationAsOf}</strong></span></div>
            </div>
          </section>

          <section className="analysis-section" id="comparables">
            <div className="section-heading">
              <div><span className="eyebrow">Comparable evidence</span><h2>Where the subject sits among nearby homes</h2><p>Inspect price, size, distance, listing status, and model fit together.</p></div>
              <div className="chart-actions">
                <div className="segmented segmented--icons" aria-label="Comparable chart type">
                  <button className={compView === 'scatter' ? 'is-active' : ''} onClick={() => setCompView('scatter')} title="Price versus square feet"><Maximize2 size={15} />Scatter</button>
                  <button className={compView === 'rank' ? 'is-active' : ''} onClick={() => setCompView('rank')} title="Ranked comparable prices"><BarChart3 size={15} />Rank</button>
                </div>
                <div className="filter-select"><Filter size={15} /><select value={compStatus} onChange={(event) => setCompStatus(event.target.value)} aria-label="Filter comparable properties by status"><option>All</option><option>Active</option><option>Inactive</option></select></div>
              </div>
            </div>

            <div className="comp-layout">
              <div className="chart-frame chart-frame--comps">
                {compView === 'scatter' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 18, right: 26, bottom: 22, left: 8 }}>
                      <CartesianGrid stroke="#dfe4df" strokeDasharray="3 4" />
                      <XAxis type="number" dataKey="sqft" name="Square feet" unit=" sqft" tick={{ fill: '#66706a', fontSize: 12 }} tickFormatter={number.format} domain={['dataMin - 150', 'dataMax + 150']} label={{ value: 'Living area (sqft)', position: 'insideBottom', offset: -12, fill: '#66706a', fontSize: 12 }} />
                      <YAxis type="number" dataKey="price" name="Price" width={70} tickFormatter={compactMoney.format} tick={{ fill: '#66706a', fontSize: 12 }} domain={['dataMin - 80000', 'dataMax + 80000']} />
                      <Tooltip content={<CompTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                      <ReferenceArea y1={estimateLow} y2={estimateHigh} fill="#d9b45b" fillOpacity={0.13} />
                      <ReferenceLine y={estimate} stroke="#b7433f" strokeDasharray="6 5" label={{ value: `Subject ${compactMoney.format(estimate)}`, fill: '#8d302d', fontSize: 11, position: 'insideTopRight' }} />
                      <Scatter name="Comparables" data={compChartData} fill="#365b50" isAnimationActive={false}>
                        {compChartData.map((comp) => <Cell key={comp.address} fill={comp.status === 'Active' ? '#d18b35' : '#5f746d'} />)}
                      </Scatter>
                      <Scatter name="Subject" data={[{ address: 'Subject property', price: estimate, sqft: scenario.squareFeet, beds: scenario.beds, baths: scenario.baths, distance: 0, fit: 1 }]} fill="#b7433f" shape="diamond" isAnimationActive={false} />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...compChartData].sort((a, b) => a.price - b.price)} layout="vertical" margin={{ top: 12, right: 34, bottom: 12, left: 6 }}>
                      <CartesianGrid stroke="#dfe4df" strokeDasharray="3 4" horizontal={false} />
                      <XAxis type="number" tickFormatter={compactMoney.format} tick={{ fill: '#66706a', fontSize: 11 }} domain={['dataMin - 60000', 'dataMax + 80000']} />
                      <YAxis type="category" dataKey="shortAddress" width={132} tick={{ fill: '#59635e', fontSize: 10 }} interval={0} />
                      <Tooltip content={<CompTooltip />} />
                      <ReferenceArea x1={estimateLow} x2={estimateHigh} fill="#d9b45b" fillOpacity={0.13} />
                      <ReferenceLine x={estimate} stroke="#b7433f" strokeWidth={2} />
                      <Bar dataKey="price" radius={[0, 3, 3, 0]} barSize={13} isAnimationActive={false}>
                        {[...compChartData].sort((a, b) => a.price - b.price).map((comp) => <Cell key={comp.address} fill={comp.status === 'Active' ? '#d18b35' : '#5f746d'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <aside className="comp-summary">
                <span className="eyebrow">Comparable signals</span>
                <div className="signal"><span>Median comp</span><strong>{money.format(compSummary.medianPrice)}</strong><small>{compSummary.differenceFromMedian >= 0 ? '+' : ''}{compSummary.differenceFromMedian.toFixed(1)}% subject vs median</small></div>
                <div className="signal"><span>Median price / sqft</span><strong>{money.format(compSummary.medianPpsf)}</strong><small>Subject: {money.format(compSummary.subjectPpsf)} / sqft</small></div>
                <div className="signal"><span>Nearest comp</span><strong>{Math.min(...filteredComps.map((comp) => comp.distance)).toFixed(2)} mi</strong><small>Fit scores range 93% to 97%</small></div>
                <div className="range-meter" aria-label="Subject estimate within comparable price range">
                  <div className="range-meter__labels"><span>{compactMoney.format(compMinimum)}</span><span>{compactMoney.format(compMaximum)}</span></div>
                  <div className="range-meter__track"><span style={{ left: `${compRangePosition}%` }} /></div>
                  <small>Subject position in comp range</small>
                </div>
              </aside>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th>Comparable property</th><th>Status</th><th>Price</th><th>Price / sqft</th><th>Beds / baths</th><th>Living area</th><th>Distance</th><th>Fit</th></tr></thead>
                <tbody>{compChartData.map((comp) => (
                  <tr key={comp.address}>
                    <td><strong>{comp.address}</strong><span>Wilmington, NC 28405</span></td>
                    <td><span className={`status-pill status-pill--${comp.status.toLowerCase()}`}>{comp.status}</span></td>
                    <td>{money.format(comp.price)}</td><td>{money.format(comp.ppsf)}</td><td>{comp.beds} / {comp.baths.toFixed(1)}</td><td>{number.format(comp.sqft)} sqft</td><td>{comp.distance.toFixed(2)} mi</td><td><span className="fit-score">{(comp.fit * 100).toFixed(0)}%</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <section className="property-facts">
            <div className="section-heading"><div><span className="eyebrow">Subject property</span><h2>Property facts</h2></div></div>
            <div className="facts-grid">
              <div><BedDouble size={18} /><span>Beds / baths<strong>{scenario.beds} / {scenario.baths.toFixed(1)}</strong></span></div>
              <div><Ruler size={18} /><span>Living area<strong>{number.format(scenario.squareFeet)} sqft</strong></span></div>
              <div><LandPlot size={18} /><span>Lot size<strong>{scenario.acres.toFixed(2)} acres</strong></span></div>
              <div><CalendarDays size={18} /><span>Year built<strong>{scenario.yearBuilt}</strong></span></div>
              <div><CircleDollarSign size={18} /><span>Last sale<strong>{money.format(subject.lastSalePrice)}</strong></span></div>
              <div><Bath size={18} /><span>Last sale date<strong>{subject.lastSaleDate}</strong></span></div>
            </div>
          </section>
        </div>
      </div>

      <footer className="footer"><span>Housing Market Lab</span><p>Estimates are informational and should not replace an appraisal or professional advice.</p><span>RentCast + Zillow data model</span></footer>
    </main>
  );
}

export default App;
