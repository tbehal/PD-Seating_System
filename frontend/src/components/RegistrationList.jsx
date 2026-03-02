import React, { useState, useEffect, useMemo } from 'react';
import { fetchRegistrationList, exportRegistrationList } from '../api';

export default function RegistrationList({ cycleId, cycleName, courseCodes, onUpdateCourseCodes }) {
  const [shift, setShift] = useState('AM');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  // Fetch registration data when cycleId or shift changes
  useEffect(() => {
    if (!cycleId) return;
    loadData(false);
  }, [cycleId, shift]);

  const loadData = async (refresh = false) => {
    if (!cycleId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRegistrationList(cycleId, shift, refresh);
      setData(result);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!cycleId) return;
    setExporting(true);
    try {
      await exportRegistrationList(cycleId, shift);
    } catch (err) {
      setError('Failed to export registration list.');
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
      await onUpdateCourseCodes(cycleId, codes);
      setShowEditCodes(false);
      // Reload data with new codes
      setTimeout(() => loadData(true), 300);
    } catch (err) {
      setError('Failed to update course codes.');
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
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          row.firstName.toLowerCase().includes(q) ||
          row.lastName.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q) ||
          (row.studentId || '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      // Payment status filter
      if (filterPayment !== 'ALL' && row.paymentStatus !== filterPayment) return false;
      // Roadmap filter
      if (filterRoadmap !== 'ALL') {
        if (filterRoadmap === 'YES' && !row.hasRoadmap) return false;
        if (filterRoadmap === 'NO' && row.hasRoadmap) return false;
      }
      // AFK filter
      if (filterAFK !== 'ALL') {
        if (filterAFK === 'YES' && !row.hasAFK) return false;
        if (filterAFK === 'NO' && row.hasAFK) return false;
      }
      // ACJ filter
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
      return 'bg-green-100 text-green-800';
    }
    if (s.includes('pending') || s.includes('open') || s.includes('progress')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (s.includes('overdue') || s.includes('lost') || s.includes('fail')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  if (!cycleId) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        Select a cycle to view the registration list.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Shift toggle */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {['AM', 'PM'].map((s) => (
              <button
                key={s}
                onClick={() => setShift(s)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  shift === s
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Refresh from HubSpot"
            >
              <svg
                className={`w-4 h-4 inline-block mr-1 ${loading ? 'animate-spin' : ''}`}
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
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              onClick={handleEditCodesOpen}
              className="px-3 py-2 text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100 transition-colors"
            >
              Edit Course Codes
            </button>
          </div>
        </div>

        {/* Column filters */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Filters:
          </span>

          {/* Payment Status */}
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            className={`px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              filterPayment !== 'ALL'
                ? 'border-brand-400 bg-brand-50 text-brand-700'
                : 'border-gray-300 text-gray-700'
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
            className={`px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              filterRoadmap !== 'ALL'
                ? 'border-brand-400 bg-brand-50 text-brand-700'
                : 'border-gray-300 text-gray-700'
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
            className={`px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              filterAFK !== 'ALL'
                ? 'border-brand-400 bg-brand-50 text-brand-700'
                : 'border-gray-300 text-gray-700'
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
            className={`px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              filterACJ !== 'ALL'
                ? 'border-brand-400 bg-brand-50 text-brand-700'
                : 'border-gray-300 text-gray-700'
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
              className="px-2 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
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
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-700 border border-gray-200"
              >
                {code}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-600">Fetching live data from HubSpot...</p>
        </div>
      )}

      {/* Empty state: no course codes */}
      {!loading && data?.meta?.noCodes && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600 mb-3">No course codes configured for this cycle.</p>
          <button
            onClick={handleEditCodesOpen}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-md hover:bg-brand-600 transition-colors"
          >
            Add Course Codes
          </button>
        </div>
      )}

      {/* Empty state: no students */}
      {!loading && data && !data.meta?.noCodes && data.rows.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600">
            No students found for the selected course codes and shift.
          </p>
        </div>
      )}

      {/* Registration table */}
      {!loading && data && data.rows.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Meta info */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-sm text-gray-600">
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
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Seat #</th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    First Name
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    Last Name
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Email</th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Phone</th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    Student ID
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    Course Start
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    Course End
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    Reg. Date
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    Payment Status
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    Outstanding
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Cycle #</th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Roadmap</th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">AFK</th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">ACJ</th>
                  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    Exam Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row) => (
                  <tr key={row.contactId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900 font-medium">{row.seatNumber}</td>
                    <td className="px-3 py-2 text-gray-900">{row.firstName}</td>
                    <td className="px-3 py-2 text-gray-900">{row.lastName}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{row.email}</td>
                    <td className="px-3 py-2 text-gray-600">{row.phone || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                      {row.studentId || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {formatDate(row.courseStartDate)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {formatDate(row.courseEndDate)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
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
                      className={`px-3 py-2 font-medium ${row.outstanding > 0 ? 'text-red-600' : 'text-gray-600'}`}
                    >
                      {row.outstanding > 0 ? `$${row.outstanding.toFixed(2)}` : '$0.00'}
                    </td>
                    <td className="px-3 py-2 text-gray-900 text-center">{row.cycleCount}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={row.hasRoadmap ? 'text-green-600 font-medium' : 'text-gray-400'}
                      >
                        {row.hasRoadmap ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={row.hasAFK ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {row.hasAFK ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={row.hasACJ ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {row.hasACJ ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Edit Course Codes</h3>
            <p className="text-sm text-gray-500 mb-4">
              Enter one course code per line. Codes containing "AM" or "PM" will be auto-filtered by
              shift.
            </p>
            <textarea
              value={editCodesValue}
              onChange={(e) => setEditCodesValue(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-mono"
              placeholder={'NDC-26-Mis1-Clinical-AM\nNDC-26-Mis1-Clinical-PM'}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleEditCodesSave}
                className="flex-1 py-2 px-4 rounded-md text-white font-medium bg-brand-500 hover:bg-brand-600 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowEditCodes(false)}
                className="flex-1 py-2 px-4 rounded-md bg-gray-200 text-gray-800 font-medium hover:bg-gray-300 transition-colors"
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
