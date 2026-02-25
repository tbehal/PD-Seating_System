import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { fetchSeatingAnalytics, fetchRegistrationAnalytics } from '../api';

// Brand palette (recharts needs hex strings, not Tailwind classes)
const BRAND = {
  500: '#0660B2',
  400: '#3d82d6',
  300: '#6da2e3',
  200: '#9ec0ed',
};

const PIE_COLORS = ['#0660B2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

const PROGRAM_COLORS = {
  Roadmap: '#0660B2',
  AFK: '#10b981',
  ACJ: '#f59e0b',
};

const ORDINAL_SUFFIX = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// ─── Skeleton primitives ──────────────────────────────────────────────────────

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function SkeletonChart() {
  return (
    <div className="h-[300px] flex items-end gap-3 px-2 pt-4">
      {[60, 85, 45, 70, 55, 90, 40].map((h, i) => (
        <div key={i} className="animate-pulse bg-gray-200 rounded flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

// ─── Error message ────────────────────────────────────────────────────────────

function ErrorMsg({ msg }) {
  return (
    <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">
      {msg}
    </div>
  );
}

// ─── ChartCard wrapper ────────────────────────────────────────────────────────

function ChartCard({ title, children, loading, error }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-base font-semibold text-gray-800 mb-4">{title}</h3>
      {loading ? (
        <SkeletonChart />
      ) : error ? (
        <ErrorMsg msg={error} />
      ) : (
        children
      )}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, loading }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      {loading ? (
        <SkeletonBlock className="h-9 mt-2 w-24" />
      ) : (
        <p className="text-3xl font-bold text-gray-900 mt-1">{value ?? '—'}</p>
      )}
    </div>
  );
}

// ─── Multi-select filter dropdown ─────────────────────────────────────────────

function MultiSelectFilter({ label, options, selected, onChange, formatOption = (v) => String(v) }) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === options.length;
  const ref = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (val) => {
    if (selected.includes(val)) {
      const next = selected.filter(v => v !== val);
      onChange(next.length === 0 ? options : next);
    } else {
      onChange([...selected, val]);
    }
  };

  const toggleAll = () => {
    onChange(allSelected ? [] : [...options]);
  };

  const displayText = allSelected
    ? `All ${label}`
    : selected.length === 0
      ? `All ${label}`
      : selected.length <= 2
        ? selected.map(formatOption).join(', ')
        : `${selected.length} selected`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {displayText}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
          <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs font-medium text-gray-800 border-b border-gray-100 mb-1">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
            />
            Select All
          </label>
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs text-gray-700">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              {formatOption(opt)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Week Occupancy chart ─────────────────────────────────────────────────────

function WeekOccupancyChart({ data }) {
  const formatted = (data || []).map(d => ({
    ...d,
    label: `Wk ${d.week}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#6b7280' }} width={42} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-gray-800 mb-1">{`Week ${d?.week}`}</p>
                <p className="text-xs text-gray-600">Booked: {d?.booked} / {d?.totalSlots}</p>
                <p className="text-xs" style={{ color: BRAND[500] }}>Occupancy: {d?.percent?.toFixed(1)}%</p>
              </div>
            );
          }}
        />
        <Bar dataKey="percent" name="Occupancy %" fill={BRAND[500]} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Lab Occupancy chart ──────────────────────────────────────────────────────

function LabOccupancyChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data || []} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="lab" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#6b7280' }} width={42} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-gray-800 mb-1">{d?.lab}</p>
                <p className="text-xs text-gray-600">Booked: {d?.booked} / {d?.totalSlots}</p>
                <p className="text-xs" style={{ color: BRAND[400] }}>Occupancy: {d?.percent?.toFixed(1)}%</p>
              </div>
            );
          }}
        />
        <Bar dataKey="percent" name="Occupancy %" fill={BRAND[400]} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Shift Comparison chart ───────────────────────────────────────────────────

function ShiftComparisonChart({ data }) {
  const colorMap = { AM: BRAND[500], PM: BRAND[300] };
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data || []} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="shift" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#6b7280' }} width={42} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-gray-800 mb-1">{d?.shift} Shift</p>
                <p className="text-xs text-gray-600">Booked: {d?.booked} / {d?.totalSlots}</p>
                <p className="text-xs" style={{ color: colorMap[d?.shift] || BRAND[500] }}>Occupancy: {d?.percent?.toFixed(1)}%</p>
              </div>
            );
          }}
        />
        <Bar dataKey="percent" name="Occupancy %" radius={[3, 3, 0, 0]}>
          {(data || []).map((entry, i) => (
            <Cell key={i} fill={colorMap[entry.shift] || BRAND[500]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Payment Status pie ───────────────────────────────────────────────────────

function PaymentPieChart({ data }) {
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, count }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.35;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
        {`${name} (${count})`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data || []}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          outerRadius={90}
          labelLine={false}
          label={renderCustomLabel}
        >
          {(data || []).map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-gray-800">{d?.status}</p>
                <p className="text-xs text-gray-600">Count: {d?.count}</p>
              </div>
            );
          }}
        />
        <Legend
          formatter={(value) => <span style={{ fontSize: 11, color: '#6b7280' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Program Participation horizontal bar ──────────────────────────────────────

function ProgramChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data || []} layout="vertical" margin={{ top: 4, right: 32, left: 16, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 12, fill: '#374151' }} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-gray-800">{d?.name}</p>
                <p className="text-xs text-gray-600">Students: {d?.count}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" name="Students" radius={[0, 3, 3, 0]}>
          {(data || []).map((entry, i) => (
            <Cell key={i} fill={PROGRAM_COLORS[entry.name] || BRAND[300]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Cycle Count Distribution chart ──────────────────────────────────────────

function CycleCountChart({ data }) {
  const formatted = (data || []).map(d => ({
    ...d,
    label: ORDINAL_SUFFIX(d.cycleNumber),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={formatted} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={36} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-gray-800">{ORDINAL_SUFFIX(d?.cycleNumber)} Cycle</p>
                <p className="text-xs text-gray-600">Students: {d?.count}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" name="Students" fill={BRAND[300]} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsDashboard({ cycles, onBack }) {
  const currentYear = new Date().getFullYear();

  const availableYears = useMemo(() => {
    const years = [...new Set((cycles || []).map(c => c.year))].sort((a, b) => b - a);
    return years.length > 0 ? years : [currentYear];
  }, [cycles, currentYear]);

  const [selectedYear, setSelectedYear] = useState(() => availableYears[0] ?? currentYear);
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const [shift, setShift] = useState('BOTH');

  const [seatingData, setSeatingData] = useState(null);
  const [registrationData, setRegistrationData] = useState(null);
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [seatingError, setSeatingError] = useState(null);
  const [registrationError, setRegistrationError] = useState(null);

  const cyclesForYear = useMemo(
    () => (cycles || []).filter(c => c.year === selectedYear),
    [cycles, selectedYear]
  );

  // Reset cycle selection when year changes
  useEffect(() => {
    setSelectedCycleId(null);
  }, [selectedYear]);

  // Fetch seating analytics
  useEffect(() => {
    if (cyclesForYear.length === 0) {
      setSeatingData(null);
      setSeatingLoading(false);
      setSeatingError(null);
      return;
    }

    let cancelled = false;
    setSeatingLoading(true);
    setSeatingError(null);

    fetchSeatingAnalytics(selectedYear, selectedCycleId || null)
      .then(data => {
        if (!cancelled) setSeatingData(data);
      })
      .catch(err => {
        if (!cancelled) {
          setSeatingError(err.response?.data?.error || err.message || 'Failed to load seating data.');
          setSeatingData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setSeatingLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedYear, selectedCycleId, cyclesForYear]);

  // Fetch registration analytics
  useEffect(() => {
    if (cyclesForYear.length === 0) {
      setRegistrationData(null);
      setRegistrationLoading(false);
      setRegistrationError(null);
      return;
    }

    let cancelled = false;
    setRegistrationLoading(true);
    setRegistrationError(null);

    fetchRegistrationAnalytics(selectedYear, shift, selectedCycleId || null)
      .then(data => {
        if (!cancelled) setRegistrationData(data);
      })
      .catch(err => {
        if (!cancelled) {
          const status = err.response?.status;
          if (status === 503) {
            setRegistrationError('HubSpot not configured. Registration analytics unavailable.');
          } else {
            setRegistrationError(err.response?.data?.error || err.message || 'Failed to load registration data.');
          }
          setRegistrationData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setRegistrationLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedYear, selectedCycleId, shift, cyclesForYear]);

  // Derive summary values
  const summary = seatingData?.summary ?? {};
  const totalStudents = registrationData?.totalStudents ?? null;
  const amShift = seatingData?.shiftOccupancy?.find(s => s.shift === 'AM');
  const pmShift = seatingData?.shiftOccupancy?.find(s => s.shift === 'PM');

  // Lab names and week numbers for filters
  const labNames = useMemo(() => {
    if (!seatingData?.labOccupancy) return [];
    return seatingData.labOccupancy.map(l => l.lab);
  }, [seatingData?.labOccupancy]);

  const weekNumbers = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  // Filter state for cross-axis filtering
  const [selectedLabs, setSelectedLabs] = useState([]);
  const [selectedWeeks, setSelectedWeeks] = useState([]);

  // Reset filters when seating data changes
  useEffect(() => {
    setSelectedLabs(labNames);
  }, [labNames]);

  useEffect(() => {
    setSelectedWeeks(weekNumbers);
  }, [weekNumbers]);

  // Filtered weekly occupancy (filtered by selected labs)
  const filteredWeekOccupancy = useMemo(() => {
    const matrix = seatingData?.bookingMatrix;
    const stationCounts = seatingData?.labStationCounts;
    const numCycles = seatingData?.summary?.numCycles || 1;
    if (!matrix || !stationCounts || selectedLabs.length === 0) return seatingData?.weekOccupancy || [];

    const allLabs = Object.keys(stationCounts);
    const isAllSelected = selectedLabs.length === allLabs.length;
    if (isAllSelected) return seatingData?.weekOccupancy || [];

    return Array.from({ length: 12 }, (_, i) => {
      const week = i + 1;
      const totalStations = selectedLabs.reduce((sum, lab) => sum + (stationCounts[lab] || 0), 0);
      const totalSlots = totalStations * 2 * numCycles;
      const booked = selectedLabs.reduce((sum, lab) => sum + ((matrix[lab] || {})[week] || 0), 0);
      return {
        week,
        totalSlots,
        booked,
        percent: totalSlots > 0 ? Math.round((booked / totalSlots) * 1000) / 10 : 0,
      };
    });
  }, [seatingData, selectedLabs]);

  // Filtered lab occupancy (filtered by selected weeks)
  const filteredLabOccupancy = useMemo(() => {
    const matrix = seatingData?.bookingMatrix;
    const stationCounts = seatingData?.labStationCounts;
    const numCycles = seatingData?.summary?.numCycles || 1;
    if (!matrix || !stationCounts || selectedWeeks.length === 0) return seatingData?.labOccupancy || [];

    if (selectedWeeks.length === 12) return seatingData?.labOccupancy || [];

    return Object.entries(stationCounts).map(([lab, count]) => {
      const totalSlots = count * selectedWeeks.length * 2 * numCycles;
      const booked = selectedWeeks.reduce((sum, w) => sum + ((matrix[lab] || {})[w] || 0), 0);
      return {
        lab,
        totalSlots,
        booked,
        percent: totalSlots > 0 ? Math.round((booked / totalSlots) * 1000) / 10 : 0,
      };
    });
  }, [seatingData, selectedWeeks]);

  const programCounts = useMemo(() => {
    if (!registrationData?.programCounts) return [];
    const pc = registrationData.programCounts;
    return [
      { name: 'Roadmap', count: pc.roadmap ?? 0 },
      { name: 'AFK', count: pc.afk ?? 0 },
      { name: 'ACJ', count: pc.acj ?? 0 },
    ];
  }, [registrationData?.programCounts]);

  const noCyclesForYear = cyclesForYear.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>

        <h2 className="text-2xl font-bold text-gray-900 flex-1">Analytics Dashboard</h2>

        <div className="flex items-center gap-2">
          {/* Year filter */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-gray-700"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Cycle filter */}
          <select
            value={selectedCycleId ?? ''}
            onChange={e => setSelectedCycleId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-gray-700"
          >
            <option value="">All Cycles</option>
            {cyclesForYear.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* No data for year — or all charts/cards */}
      {noCyclesForYear ? (
        <div className="text-gray-500 text-center py-12">
          No data available for selected filters.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Overall Occupancy"
              value={summary.overallPercent != null ? `${summary.overallPercent.toFixed(1)}%` : null}
              loading={seatingLoading}
            />
            <SummaryCard
              label="Total Students"
              value={totalStudents != null ? totalStudents : (registrationLoading ? null : '—')}
              loading={registrationLoading}
            />
            <SummaryCard
              label="AM Occupancy"
              value={amShift?.percent != null ? `${amShift.percent.toFixed(1)}%` : null}
              loading={seatingLoading}
            />
            <SummaryCard
              label="PM Occupancy"
              value={pmShift?.percent != null ? `${pmShift.percent.toFixed(1)}%` : null}
              loading={seatingLoading}
            />
          </div>

          {/* Seating charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="Weekly Occupancy" loading={seatingLoading} error={seatingError}>
              {seatingData?.weekOccupancy?.length ? (
                <>
                  <div className="flex items-center gap-2 -mt-2 mb-3">
                    <span className="text-xs text-gray-500">Filter by labs:</span>
                    <MultiSelectFilter
                      label="Labs"
                      options={labNames}
                      selected={selectedLabs}
                      onChange={setSelectedLabs}
                    />
                  </div>
                  <WeekOccupancyChart data={filteredWeekOccupancy} />
                </>
              ) : (
                <p className="text-gray-500 text-center py-12 text-sm">No weekly data available.</p>
              )}
            </ChartCard>

            <ChartCard title="Lab Occupancy" loading={seatingLoading} error={seatingError}>
              {seatingData?.labOccupancy?.length ? (
                <>
                  <div className="flex items-center gap-2 -mt-2 mb-3">
                    <span className="text-xs text-gray-500">Filter by weeks:</span>
                    <MultiSelectFilter
                      label="Weeks"
                      options={weekNumbers}
                      selected={selectedWeeks}
                      onChange={setSelectedWeeks}
                      formatOption={w => `Wk ${w}`}
                    />
                  </div>
                  <LabOccupancyChart data={filteredLabOccupancy} />
                </>
              ) : (
                <p className="text-gray-500 text-center py-12 text-sm">No lab data available.</p>
              )}
            </ChartCard>
          </div>

          {/* Shift comparison (full width) */}
          <ChartCard title="Shift Comparison" loading={seatingLoading} error={seatingError}>
            {seatingData?.shiftOccupancy?.length ? (
              <ShiftComparisonChart data={seatingData.shiftOccupancy} />
            ) : (
              <p className="text-gray-500 text-center py-12 text-sm">No shift data available.</p>
            )}
          </ChartCard>

          {/* Registration section header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Registration Analytics</h3>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {['AM', 'PM', 'BOTH'].map(s => (
                <button
                  key={s}
                  onClick={() => setShift(s)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    shift === s
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {s === 'BOTH' ? 'Both' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Registration charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="Payment Status" loading={registrationLoading} error={registrationError}>
              {registrationData?.paymentDistribution?.length ? (
                <PaymentPieChart data={registrationData.paymentDistribution} />
              ) : (
                <p className="text-gray-500 text-center py-12 text-sm">No payment data available.</p>
              )}
            </ChartCard>

            <ChartCard title="Program Participation" loading={registrationLoading} error={registrationError}>
              {programCounts.some(p => p.count > 0) ? (
                <ProgramChart data={programCounts} />
              ) : (
                <p className="text-gray-500 text-center py-12 text-sm">No program data available.</p>
              )}
            </ChartCard>
          </div>

          {/* Cycle count distribution (full width) */}
          <ChartCard title="Cycle Count Distribution" loading={registrationLoading} error={registrationError}>
            {registrationData?.cycleCountDistribution?.length ? (
              <CycleCountChart data={registrationData.cycleCountDistribution} />
            ) : (
              <p className="text-gray-500 text-center py-12 text-sm">No cycle count data available.</p>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}
