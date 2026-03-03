import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useCycles } from '../hooks/useCycles';
import { useSeatingAnalytics, useRegistrationAnalytics } from '../hooks/useAnalytics';
import { useThemeStore } from '../stores/themeStore';
import { getChartColors, getAxisStyle, getProgramColors } from '../lib/chartTheme';
import { Skeleton } from './ui/Skeleton';

// ─── PDF export config ───────────────────────────────────────────────────────
const PDF_SCALE = 1.5;
const PDF_MARGIN_MM = 10;
const PDF_HEADER_HEIGHT_MM = 25;
const PDF_SECTION_GAP_MM = 3;

const ORDINAL_SUFFIX = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// ─── Skeleton primitives ──────────────────────────────────────────────────────

function SkeletonChart() {
  return (
    <div className="h-[300px] flex items-end gap-3 px-2 pt-4">
      {[60, 85, 45, 70, 55, 90, 40].map((h, i) => (
        <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

// ─── Error message ────────────────────────────────────────────────────────────

function ErrorMsg({ msg }) {
  return <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{msg}</div>;
}

// ─── ChartCard wrapper ────────────────────────────────────────────────────────

function ChartCard({ title, children, loading, error }) {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">{title}</h3>
      {loading ? <SkeletonChart /> : error ? <ErrorMsg msg={error} /> : children}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, loading }) {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="h-9 mt-2 w-24" />
      ) : (
        <p className="text-3xl font-bold text-foreground mt-1">{value ?? '—'}</p>
      )}
    </div>
  );
}

// ─── Multi-select filter dropdown ─────────────────────────────────────────────

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  formatOption = (v) => String(v),
}) {
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
      const next = selected.filter((v) => v !== val);
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-input rounded-lg bg-card text-secondary-foreground hover:bg-muted transition-colors"
      >
        {displayText}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
          <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer text-xs font-medium text-foreground border-b border-border/50 mb-1">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-input text-primary focus:ring-ring"
            />
            Select All
          </label>
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer text-xs text-secondary-foreground"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-input text-primary focus:ring-ring"
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
  const chartColors = getChartColors();
  const axisStyle = getAxisStyle();

  const formatted = (data || []).map((d) => ({
    ...d,
    label: `Wk ${d.week}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={axisStyle.gridStroke} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisStyle.tick.fill }} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: axisStyle.tick.fill }}
          width={42}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-card border border-border rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-foreground mb-1">{`Week ${d?.week}`}</p>
                <p className="text-xs text-muted-foreground">
                  Booked: {d?.booked} / {d?.totalSlots}
                </p>
                <p className="text-xs" style={{ color: chartColors.primary }}>
                  Occupancy: {d?.percent?.toFixed(1)}%
                </p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="percent"
          name="Occupancy %"
          fill={chartColors.primary}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Lab Occupancy chart ──────────────────────────────────────────────────────

function LabOccupancyChart({ data }) {
  const chartColors = getChartColors();
  const axisStyle = getAxisStyle();

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data || []} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={axisStyle.gridStroke} />
        <XAxis dataKey="lab" tick={{ fontSize: 11, fill: axisStyle.tick.fill }} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: axisStyle.tick.fill }}
          width={42}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-card border border-border rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-foreground mb-1">{d?.lab}</p>
                <p className="text-xs text-muted-foreground">
                  Booked: {d?.booked} / {d?.totalSlots}
                </p>
                <p className="text-xs" style={{ color: chartColors.secondary }}>
                  Occupancy: {d?.percent?.toFixed(1)}%
                </p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="percent"
          name="Occupancy %"
          fill={chartColors.secondary}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Shift Comparison chart ───────────────────────────────────────────────────

function ShiftComparisonChart({ data }) {
  const chartColors = getChartColors();
  const axisStyle = getAxisStyle();
  const colorMap = { AM: chartColors.primary, PM: chartColors.tertiary };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data || []} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={axisStyle.gridStroke} />
        <XAxis dataKey="shift" tick={{ fontSize: 12, fill: axisStyle.tick.fill }} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: axisStyle.tick.fill }}
          width={42}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-card border border-border rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-foreground mb-1">{d?.shift} Shift</p>
                <p className="text-xs text-muted-foreground">
                  Booked: {d?.booked} / {d?.totalSlots}
                </p>
                <p className="text-xs" style={{ color: colorMap[d?.shift] || chartColors.primary }}>
                  Occupancy: {d?.percent?.toFixed(1)}%
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="percent" name="Occupancy %" radius={[3, 3, 0, 0]}>
          {(data || []).map((entry, i) => (
            <Cell key={i} fill={colorMap[entry.shift] || chartColors.primary} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Payment Status pie ───────────────────────────────────────────────────────

function PaymentPieChart({ data }) {
  const chartColors = getChartColors();
  const pieColors = [
    chartColors.primary,
    chartColors.success,
    chartColors.warning,
    chartColors.danger,
    chartColors.purple,
    chartColors.muted,
  ];
  const axisStyle = getAxisStyle();

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, count }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.35;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill={axisStyle.tick.fill}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={11}
      >
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
            <Cell key={i} fill={pieColors[i % pieColors.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-card border border-border rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-foreground">{d?.status}</p>
                <p className="text-xs text-muted-foreground">Count: {d?.count}</p>
              </div>
            );
          }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 11, color: axisStyle.tick.fill }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Program Participation horizontal bar ──────────────────────────────────────

function ProgramChart({ data }) {
  const chartColors = getChartColors();
  const axisStyle = getAxisStyle();
  const programColors = getProgramColors();
  const nameToColor = {
    Roadmap: programColors.roadmap,
    AFK: programColors.afk,
    ACJ: programColors.acj,
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data || []}
        layout="vertical"
        margin={{ top: 4, right: 32, left: 16, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={axisStyle.gridStroke} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: axisStyle.tick.fill }} />
        <YAxis
          dataKey="name"
          type="category"
          width={70}
          tick={{ fontSize: 12, fill: axisStyle.tick.fill }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-card border border-border rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-foreground">{d?.name}</p>
                <p className="text-xs text-muted-foreground">Students: {d?.count}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" name="Students" radius={[0, 3, 3, 0]}>
          {(data || []).map((entry, i) => (
            <Cell key={i} fill={nameToColor[entry.name] || chartColors.tertiary} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Cycle Count Distribution chart ──────────────────────────────────────────

function CycleCountChart({ data }) {
  const chartColors = getChartColors();
  const axisStyle = getAxisStyle();

  const formatted = (data || []).map((d) => ({
    ...d,
    label: ORDINAL_SUFFIX(d.cycleNumber),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={formatted} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={axisStyle.gridStroke} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisStyle.tick.fill }} />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: axisStyle.tick.fill }}
          width={36}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-card border border-border rounded-lg shadow-md p-3 text-sm">
                <p className="font-semibold text-foreground">
                  {ORDINAL_SUFFIX(d?.cycleNumber)} Cycle
                </p>
                <p className="text-xs text-muted-foreground">Students: {d?.count}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" name="Students" fill={chartColors.tertiary} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const { data: cycles = [] } = useCycles();
  const navigate = useNavigate();
  const _theme = useThemeStore((s) => s.theme);
  const currentYear = new Date().getFullYear();

  const availableYears = useMemo(() => {
    const years = [...new Set((cycles || []).map((c) => c.year))].sort((a, b) => b - a);
    return years.length > 0 ? years : [currentYear];
  }, [cycles, currentYear]);

  const [selectedYear, setSelectedYear] = useState(() => availableYears[0] ?? currentYear);
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const [shift, setShift] = useState('BOTH');

  const printRef = useRef(null);
  const exportCancelledRef = useRef(false);
  const [exporting, setExporting] = useState(false);

  const cyclesForYear = useMemo(
    () => (cycles || []).filter((c) => c.year === selectedYear),
    [cycles, selectedYear],
  );

  const noCyclesForYear = cyclesForYear.length === 0;

  // Reset cycle selection when year changes
  useEffect(() => {
    setSelectedCycleId(null);
  }, [selectedYear]);

  const {
    data: seatingData,
    isLoading: seatingLoading,
    error: seatingQueryError,
  } = useSeatingAnalytics(noCyclesForYear ? null : selectedYear, selectedCycleId || null);

  const {
    data: registrationData,
    isLoading: registrationLoading,
    error: registrationQueryError,
  } = useRegistrationAnalytics(
    noCyclesForYear ? null : selectedYear,
    shift,
    selectedCycleId || null,
  );

  const seatingError = seatingQueryError
    ? seatingQueryError.response?.data?.error ||
      seatingQueryError.message ||
      'Failed to load seating data.'
    : null;

  const registrationError = registrationQueryError
    ? registrationQueryError.response?.status === 503
      ? 'HubSpot not configured. Registration analytics unavailable.'
      : registrationQueryError.response?.data?.error ||
        registrationQueryError.message ||
        'Failed to load registration data.'
    : null;

  useEffect(() => {
    if (!exporting) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        exportCancelledRef.current = true;
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [exporting]);

  // Derive summary values
  const summary = seatingData?.summary ?? {};
  const totalStudents = registrationData?.totalStudents ?? null;
  const amShift = seatingData?.shiftOccupancy?.find((s) => s.shift === 'AM');
  const pmShift = seatingData?.shiftOccupancy?.find((s) => s.shift === 'PM');

  // Lab names and week numbers for filters
  const labNames = useMemo(() => {
    if (!seatingData?.labOccupancy) return [];
    return seatingData.labOccupancy.map((l) => l.lab);
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
    if (!matrix || !stationCounts || selectedLabs.length === 0)
      return seatingData?.weekOccupancy || [];

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
    if (!matrix || !stationCounts || selectedWeeks.length === 0)
      return seatingData?.labOccupancy || [];

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

  const handleExportPDF = async () => {
    if (!printRef.current) return;

    setExporting(true);
    exportCancelledRef.current = false;
    let hiddenElements = [];

    try {
      const [{ toCanvas }, { default: jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);

      if (exportCancelledRef.current || !printRef.current) return;

      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pdfWidth - PDF_MARGIN_MM * 2;
      const contentStartY = PDF_MARGIN_MM + PDF_HEADER_HEIGHT_MM;

      // ── PDF Header ──
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('Analytics Report', PDF_MARGIN_MM, PDF_MARGIN_MM + 8);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      pdf.text(
        `Generated: ${dateStr} ${now.toLocaleTimeString()}`,
        PDF_MARGIN_MM,
        PDF_MARGIN_MM + 15,
      );

      const filterParts = [];
      if (selectedYear) filterParts.push(`Year: ${selectedYear}`);
      if (selectedCycleId) {
        const name = cyclesForYear.find((c) => c.id === selectedCycleId)?.name || selectedCycleId;
        filterParts.push(`Cycle: ${name}`);
      }
      if (shift) filterParts.push(`Shift: ${shift === 'BOTH' ? 'AM + PM' : shift}`);
      if (filterParts.length > 0) {
        pdf.text(filterParts.join('  |  '), PDF_MARGIN_MM, PDF_MARGIN_MM + 21);
      }

      pdf.setDrawColor(200, 200, 200);
      pdf.line(PDF_MARGIN_MM, contentStartY - 2, pdfWidth - PDF_MARGIN_MM, contentStartY - 2);

      // ── Hide interactive elements before capture ──
      hiddenElements = Array.from(printRef.current.querySelectorAll('[data-pdf-hide]'));
      hiddenElements.forEach((el) => {
        el.style.display = 'none';
      });

      // ── Temporarily switch to light mode so CSS vars resolve to light values ──
      const root = document.documentElement;
      const wasDark = root.classList.contains('dark');
      if (wasDark) root.classList.remove('dark');

      // ── Capture each section individually (smart page breaks) ──
      const sections = Array.from(printRef.current.children);
      let currentY = contentStartY;
      let isFirstPage = true;

      try {
        for (const section of sections) {
          if (exportCancelledRef.current) break;

          const canvas = await toCanvas(section, {
            pixelRatio: PDF_SCALE,
            backgroundColor: '#ffffff',
          });

          if (exportCancelledRef.current) {
            canvas.width = 0;
            canvas.height = 0;
            break;
          }

          const imgData = canvas.toDataURL('image/png');
          const ratio = contentWidth / canvas.width;
          const scaledHeight = canvas.height * ratio;

          const pageBottom = pdfHeight - PDF_MARGIN_MM;
          const availableOnPage = pageBottom - currentY;

          // Start new page if section doesn't fit and we're not at the top
          const pageTop = isFirstPage ? contentStartY : PDF_MARGIN_MM;
          if (scaledHeight > availableOnPage && currentY > pageTop + 1) {
            pdf.addPage();
            currentY = PDF_MARGIN_MM;
            isFirstPage = false;
          }

          pdf.addImage(imgData, 'PNG', PDF_MARGIN_MM, currentY, contentWidth, scaledHeight);
          currentY += scaledHeight + PDF_SECTION_GAP_MM;

          // Release GPU-backed canvas memory
          canvas.width = 0;
          canvas.height = 0;
        }
      } finally {
        // ── Restore dark mode after capture ──
        if (wasDark) root.classList.add('dark');
      }

      if (!exportCancelledRef.current) {
        const timestamp = `${dateStr}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const cycleSuffix = selectedCycleId
          ? `-${(cyclesForYear.find((c) => c.id === selectedCycleId)?.name || 'cycle').replace(/\s+/g, '-')}`
          : '';
        pdf.save(`analytics-report-${selectedYear || 'all'}${cycleSuffix}-${timestamp}.pdf`);
        toast.success('PDF exported successfully');
      }
    } catch {
      toast.error('PDF export failed. Please try again.');
    } finally {
      hiddenElements.forEach((el) => {
        el.style.display = '';
      });
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {exporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="animate-spin h-8 w-8 text-primary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-sm font-medium text-secondary-foreground">Generating PDF...</p>
            <p className="text-xs text-muted-foreground/60">Press Esc to cancel</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate('/schedule')}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-secondary-foreground bg-card border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back
        </button>

        <h2 className="text-2xl font-bold text-foreground flex-1">Analytics Dashboard</h2>

        <div className="flex items-center gap-2">
          {/* Year filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            disabled={exporting}
            className="px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Cycle filter */}
          <select
            value={selectedCycleId ?? ''}
            onChange={(e) => setSelectedCycleId(e.target.value ? Number(e.target.value) : null)}
            disabled={exporting}
            className="px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">All Cycles</option>
            {cyclesForYear.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Export PDF button */}
          <button
            onClick={handleExportPDF}
            disabled={exporting || seatingLoading || registrationLoading || noCyclesForYear}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {exporting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* No data for year — or all charts/cards */}
      {noCyclesForYear ? (
        <div className="text-muted-foreground text-center py-12">
          No data available for selected filters.
        </div>
      ) : (
        <div ref={printRef} className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Overall Occupancy"
              value={
                summary.overallPercent !== null ? `${summary.overallPercent.toFixed(1)}%` : null
              }
              loading={seatingLoading}
            />
            <SummaryCard
              label="Total Students"
              value={totalStudents !== null ? totalStudents : registrationLoading ? null : '—'}
              loading={registrationLoading}
            />
            <SummaryCard
              label="AM Occupancy"
              value={amShift?.percent !== null ? `${amShift.percent.toFixed(1)}%` : null}
              loading={seatingLoading}
            />
            <SummaryCard
              label="PM Occupancy"
              value={pmShift?.percent !== null ? `${pmShift.percent.toFixed(1)}%` : null}
              loading={seatingLoading}
            />
          </div>

          {/* Seating charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="Weekly Occupancy" loading={seatingLoading} error={seatingError}>
              {seatingData?.weekOccupancy?.length ? (
                <>
                  <div className="flex items-center gap-2 -mt-2 mb-3" data-pdf-hide>
                    <span className="text-xs text-muted-foreground">Filter by labs:</span>
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
                <p className="text-muted-foreground text-center py-12 text-sm">
                  No weekly data available.
                </p>
              )}
            </ChartCard>

            <ChartCard title="Lab Occupancy" loading={seatingLoading} error={seatingError}>
              {seatingData?.labOccupancy?.length ? (
                <>
                  <div className="flex items-center gap-2 -mt-2 mb-3" data-pdf-hide>
                    <span className="text-xs text-muted-foreground">Filter by weeks:</span>
                    <MultiSelectFilter
                      label="Weeks"
                      options={weekNumbers}
                      selected={selectedWeeks}
                      onChange={setSelectedWeeks}
                      formatOption={(w) => `Wk ${w}`}
                    />
                  </div>
                  <LabOccupancyChart data={filteredLabOccupancy} />
                </>
              ) : (
                <p className="text-muted-foreground text-center py-12 text-sm">
                  No lab data available.
                </p>
              )}
            </ChartCard>
          </div>

          {/* Shift comparison (full width) */}
          <ChartCard title="Shift Comparison" loading={seatingLoading} error={seatingError}>
            {seatingData?.shiftOccupancy?.length ? (
              <ShiftComparisonChart data={seatingData.shiftOccupancy} />
            ) : (
              <p className="text-muted-foreground text-center py-12 text-sm">
                No shift data available.
              </p>
            )}
          </ChartCard>

          {/* Registration section (header + charts wrapped for PDF capture) */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Registration Analytics</h3>
              <div className="flex gap-1 bg-muted p-1 rounded-lg" data-pdf-hide>
                {['AM', 'PM', 'BOTH'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setShift(s)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      shift === s
                        ? 'bg-card text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s === 'BOTH' ? 'Both' : s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartCard
                title="Payment Status"
                loading={registrationLoading}
                error={registrationError}
              >
                {registrationData?.paymentDistribution?.length ? (
                  <PaymentPieChart data={registrationData.paymentDistribution} />
                ) : (
                  <p className="text-muted-foreground text-center py-12 text-sm">
                    No payment data available.
                  </p>
                )}
              </ChartCard>

              <ChartCard
                title="Program Participation"
                loading={registrationLoading}
                error={registrationError}
              >
                {programCounts.some((p) => p.count > 0) ? (
                  <ProgramChart data={programCounts} />
                ) : (
                  <p className="text-muted-foreground text-center py-12 text-sm">
                    No program data available.
                  </p>
                )}
              </ChartCard>
            </div>
          </div>

          {/* Cycle count distribution (full width) */}
          <ChartCard
            title="Cycle Count Distribution"
            loading={registrationLoading}
            error={registrationError}
          >
            {registrationData?.cycleCountDistribution?.length ? (
              <CycleCountChart data={registrationData.cycleCountDistribution} />
            ) : (
              <p className="text-muted-foreground text-center py-12 text-sm">
                No cycle count data available.
              </p>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
