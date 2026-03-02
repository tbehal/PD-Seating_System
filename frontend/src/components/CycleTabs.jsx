import React, { useState } from 'react';

export default function CycleTabs({
  cycles,
  activeCycleId,
  onSelectCycle,
  onCreateCycle,
  onDeleteCycle,
  onLockCycle,
  onUnlockCycle,
}) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCycleYear, setNewCycleYear] = useState(new Date().getFullYear());
  const [courseCodesInput, setCourseCodesInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // cycle object to confirm deletion
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const codes = courseCodesInput
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      await onCreateCycle(newCycleYear, codes);
      setShowCreateDialog(false);
      setCourseCodesInput('');
    } catch (err) {
      console.error('Failed to create cycle:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClick = (e, cycle) => {
    e.stopPropagation(); // Don't switch tabs when clicking X
    setDeleteConfirm(cycle);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm || !onDeleteCycle) return;
    setDeleting(true);
    try {
      await onDeleteCycle(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete cycle:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-gray-200">
        {cycles.map((cycle) => (
          <button
            key={cycle.id}
            onClick={() => onSelectCycle(cycle.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (cycle.locked) {
                onUnlockCycle(cycle.id);
              } else {
                onLockCycle(cycle.id);
              }
            }}
            className={`group flex items-center gap-1.5 pl-4 pr-2 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors border border-b-0 ${
              activeCycleId === cycle.id
                ? 'bg-white text-brand-700 border-gray-300 shadow-sm'
                : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 hover:text-gray-800'
            }`}
          >
            {cycle.locked && (
              <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {cycle.name}
            <span
              onClick={(e) => handleDeleteClick(e, cycle)}
              className="ml-1 p-0.5 rounded hover:bg-gray-300 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Delete cycle"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </span>
          </button>
        ))}

        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center justify-center w-8 h-8 ml-1 text-gray-500 bg-gray-100 rounded-t-lg hover:bg-gray-200 hover:text-gray-700 transition-colors border border-b-0 border-transparent"
          title="Add new cycle"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Create Cycle Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Create New Cycle</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="cycleYear" className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  id="cycleYear"
                  value={newCycleYear}
                  onChange={(e) => setNewCycleYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  min="2024"
                  max="2030"
                />
              </div>
              <div>
                <label
                  htmlFor="courseCodes"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Course Codes{' '}
                  <span className="text-gray-400 font-normal">(optional, one per line)</span>
                </label>
                <textarea
                  id="courseCodes"
                  value={courseCodesInput}
                  onChange={(e) => setCourseCodesInput(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-mono"
                  placeholder={'NDC-26-Mis1-Clinical-AM\nNDC-26-Mis1-Clinical-PM'}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-2 px-4 rounded-md text-white font-medium bg-brand-500 hover:bg-brand-600 disabled:bg-gray-400 transition-colors"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1 py-2 px-4 rounded-md bg-gray-200 text-gray-800 font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Cycle</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteConfirm.name}</span>? All bookings and week
              data for this cycle will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 py-2 px-4 rounded-md text-white font-medium bg-red-600 hover:bg-red-700 disabled:bg-gray-400 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
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
