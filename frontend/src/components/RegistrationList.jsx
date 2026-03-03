import React, { useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { exportRegistrationList } from '../api';
import { useScheduleStore } from '../stores/scheduleStore';
import { useCycles, useUpdateCourseCodes } from '../hooks/useCycles';
import { useRegistrationList, useRefreshRegistration } from '../hooks/useRegistration';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { SkeletonTable } from './ui/SkeletonTable';

export default function RegistrationList() {
  const cycleId = useScheduleStore((s) => s.activeCycleId);
  const { data: cycles = [] } = useCycles();
  const activeCycle = cycles.find((c) => c.id === cycleId);
  const courseCodes = activeCycle?.courseCodes || [];
  const updateCourseCodesMutation = useUpdateCourseCodes();
  const refreshMutation = useRefreshRegistration();
  const editCodesRef = useRef(null);
  const [shift, setShift] = useState('AM');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  // Column filters
  const [filterPayment, setFilterPayment] = useState('ALL');
  const [filterRoadmap, setFilterRoadmap] = useState('ALL');
  const [filterAFK, setFilterAFK] = useState('ALL');
  const [filterACJ, setFilterACJ] = useState('ALL');

  // Edit course codes dialog
  const [showEditCodes, setShowEditCodes] = useState(false);
  const [editCodesValue, setEditCodesValue] = useState('');

  const { data, isLoading, error, refetch } = useRegistrationList(cycleId, shift);

  useFocusTrap(editCodesRef, showEditCodes, { onEscape: () => setShowEditCodes(false) });

  const handleRefresh = () => {
    refreshMutation.mutate({ cycleId, shift });
  };

  const handleExport = async () => {
    if (!cycleId) return;
    setExporting(true);
    try {
      await exportRegistrationList(cycleId, shift);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleEditCodesOpen = () => {
    setEditCodesValue((courseCodes || []).join('\n'));
    setShowEditCodes(true);
  };

  const handleEditCodesSave = async () => {
    const codes = editCodesValue
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await updateCourseCodesMutation.mutateAsync({ cycleId, courseCodes: codes });
      setShowEditCodes(false);
    } catch {
      toast.error('Failed to update course codes.');
    }
  };

  // Unique payment statuses for dropdown
  const paymentStatuses = useMemo(() => {
    if (!data?.rows) return [];
    return [...new Set(data.rows.map((r) => r.paymentStatus))].sort();
  }, [data?.rows]);

  // Filter rows by search query + column filters
  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter((row) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          row.firstName.toLowerCase().includes(q) ||
          row.lastName.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q) ||
          (row.studentId || '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (filterPayment !== 'ALL' && row.paymentStatus !== filterPayment) return false;
      if (filterRoadmap !== 'ALL') {
        if (filterRoadmap === 'YES' && !row.hasRoadmap) return false;
        if (filterRoadmap === 'NO' && row.hasRoadmap) return false;
      }
      if (filterAFK !== 'ALL') {
        if (filterAFK === 'YES' && !row.hasAFK) return false;
        if (filterAFK === 'NO' && row.hasAFK) return false;
      }
      if (filterACJ !== 'ALL') {
        if (filterACJ === 'YES' && !row.hasACJ) return false;
        if (filterACJ === 'NO' && row.hasACJ) return false;
      }
      return true;
    });
  }, [data?.rows, searchQuery, filterPayment, filterRoadmap, filterAFK, filterACJ]);

  const hasActiveFilters =
    filterPayment !== 'ALL' ||
    filterRoadmap !== 'ALL' ||
    filterAFK !== 'ALL' ||
    filterACJ !== 'ALL';

  const clearAllFilters = () => {
    setFilterPayment('ALL');
    setFilterRoadmap('ALL');
    setFilterAFK('ALL');
    setFilterACJ('ALL');
    setSearchQuery('');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-CA');
  };

  const getPaymentBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('paid') || s.includes('closed won') || s.includes('complete')) {
      return 'bg-success-muted text-success';
    }
    if (s.includes('pending') || s.includes('open') || s.includes('progress')) {
      return 'bg-warning-muted text-warning';
    }
    if (s.includes('overdue') || s.includes('lost') || s.includes('fail')) {
      return 'bg-destructive-muted text-destructive';
    }
    return 'bg-muted text-secondary-foreground';
  };

  if (!cycleId) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center text-muted-foreground">
        Select a cycle to view the registration list.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Shift toggle */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {['AM', 'PM'].map((s) => (
              <button
                key={s}
                onClick={() => setShift(s)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  shift === s
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-secondary-foreground'
                }`}
              >
                {s === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or student ID..."
              className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading || refreshMutation.isPending}
              className="px-3 py-2 text-sm font-medium text-secondary-foreground bg-card border border-input rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
              title="Refresh from HubSpot"
            >
              <svg
                className={`w-4 h-4 inline-block mr-1 ${isLoading || refreshMutation.isPending ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || !data?.rows?.length}
              className="px-3 py-2 text-sm font-medium text-secondary-foreground bg-card border border-input rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              onClick={handleEditCodesOpen}
              className="px-3 py-2 text-sm font-medium text-primary bg-primary/10 border border-primary rounded-md hover:bg-primary/20 transition-colors"
            >
              Edit Course Codes
            </button>
          </div>
        </div>

        {/* Column filters */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Filters:
          </span>

          {/* Payment Status */}
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            className={`px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
              filterPayment !== 'ALL'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input text-secondary-foreground'
            }`}
          >
            <option value="ALL">Payment Status: All</option>
            {paymentStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Roadmap */}
          <select
            value={filterRoadmap}
            onChange={(e) => setFilterRoadmap(e.target.value)}
            className={`px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
              filterRoadmap !== 'ALL'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input text-secondary-foreground'
            }`}
          >
            <option value="ALL">Roadmap: All</option>
            <option value="YES">Roadmap: Yes</option>
            <option value="NO">Roadmap: No</option>
          </select>

          {/* AFK */}
          <select
            value={filterAFK}
            onChange={(e) => setFilterAFK(e.target.value)}
            className={`px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
              filterAFK !== 'ALL'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input text-secondary-foreground'
            }`}
          >
            <option value="ALL">AFK: All</option>
            <option value="YES">AFK: Yes</option>
            <option value="NO">AFK: No</option>
          </select>

          {/* ACJ */}
          <select
            value={filterACJ}
            onChange={(e) => setFilterACJ(e.target.value)}
            className={`px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
              filterACJ !== 'ALL'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input text-secondary-foreground'
            }`}
          >
            <option value="ALL">ACJ: All</option>
            <option value="YES">ACJ: Yes</option>
            <option value="NO">ACJ: No</option>
          </select>

          {/* Clear all filters */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-2 py-1.5 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive-muted rounded-md transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Course codes display */}
        {courseCodes && courseCodes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {courseCodes.map((code, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-muted text-secondary-foreground border border-border"
              >
                {code}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && <SkeletonTable rows={10} columns={8} />}

      {/* Error state */}
      {error && !isLoading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive-muted p-4 text-center">
          <p className="text-destructive font-medium">Failed to load registration data</p>
          <p className="text-muted-foreground text-sm mt-1">
            {error.response?.data?.error || error.message}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state: no course codes */}
      {!isLoading && data?.meta?.noCodes && (
        <div className="bg-card rounded-xl shadow-sm border border-border p-12 text-center">
          <p className="text-muted-foreground mb-3">No course codes configured for this cycle.</p>
          <button
            onClick={handleEditCodesOpen}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
          >
            Add Course Codes
          </button>
        </div>
      )}

      {/* Empty state: no students */}
      {!isLoading && data && !data.meta?.noCodes && data.rows.length === 0 && (
        <div className="bg-card rounded-xl shadow-sm border border-border p-12 text-center">
          <p className="text-muted-foreground">
            No students found for the selected course codes and shift.
          </p>
        </div>
      )}

      {/* Registration table */}
      {!isLoading && data && data.rows.length > 0 && (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {/* Meta info */}
          <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {filteredRows.length} of {data.rows.length} students
              {(searchQuery || hasActiveFilters) && ` (filtered)`}
            </span>
            <span>
              Last fetched:{' '}
              {data.meta?.fetchedAt ? new Date(data.meta.fetchedAt).toLocaleTimeString() : '-'}
            </span>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Seat #
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    First Name
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Last Name
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Email
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Phone
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Student ID
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Course Start
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Course End
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Reg. Date
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Payment Status
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Outstanding
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Cycle #
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Roadmap
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    AFK
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    ACJ
                  </th>
                  <th className="px-3 py-2 font-medium text-secondary-foreground whitespace-nowrap">
                    Exam Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredRows.map((row) => (
                  <tr key={row.contactId} className="hover:bg-muted">
                    <td className="px-3 py-2 text-foreground font-medium">{row.seatNumber}</td>
                    <td className="px-3 py-2 text-foreground">{row.firstName}</td>
                    <td className="px-3 py-2 text-foreground">{row.lastName}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{row.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.phone || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                      {row.studentId || '-'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(row.courseStartDate)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(row.courseEndDate)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(row.registrationDate)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPaymentBadgeClass(row.paymentStatus)}`}
                      >
                        {row.paymentStatus}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 font-medium ${row.outstanding > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
                    >
                      {row.outstanding > 0 ? `$${row.outstanding.toFixed(2)}` : '$0.00'}
                    </td>
                    <td className="px-3 py-2 text-foreground text-center">{row.cycleCount}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={
                          row.hasRoadmap ? 'text-success font-medium' : 'text-muted-foreground/60'
                        }
                      >
                        {row.hasRoadmap ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={
                          row.hasAFK ? 'text-success font-medium' : 'text-muted-foreground/60'
                        }
                      >
                        {row.hasAFK ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={
                          row.hasACJ ? 'text-success font-medium' : 'text-muted-foreground/60'
                        }
                      >
                        {row.hasACJ ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(row.examDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Course Codes Dialog */}
      {showEditCodes && (
        <div className="fixed inset-0 bg-background/70 backdrop-blur-md border-white/10 flex items-center justify-center z-50 p-4">
          <div
            ref={editCodesRef}
            role="dialog"
            aria-modal="true"
            className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-bold text-foreground mb-2">Edit Course Codes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter one course code per line. Codes containing "AM" or "PM" will be auto-filtered by
              shift.
            </p>
            <textarea
              value={editCodesValue}
              onChange={(e) => setEditCodesValue(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
              placeholder={'NDC-26-Mis1-Clinical-AM\nNDC-26-Mis1-Clinical-PM'}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleEditCodesSave}
                className="flex-1 py-2 px-4 rounded-md text-primary-foreground font-medium bg-primary hover:bg-primary/90 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowEditCodes(false)}
                className="flex-1 py-2 px-4 rounded-md bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
