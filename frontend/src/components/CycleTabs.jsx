import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useFocusTrap } from '../hooks/useFocusTrap';

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

  const createDialogRef = useRef(null);
  const deleteDialogRef = useRef(null);
  useFocusTrap(createDialogRef, showCreateDialog);
  useFocusTrap(deleteDialogRef, !!deleteConfirm);

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
      toast.success('Cycle created');
    } catch (_) {
      // Error handled by TanStack Query
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
      toast.success('Cycle deleted');
    } catch (_) {
      // Error handled by TanStack Query
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border">
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
            aria-label={`Toggle lock for ${cycle.name}`}
            aria-selected={activeCycleId === cycle.id}
            className={`group flex items-center gap-1.5 pl-4 pr-2 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors border border-b-0 ${
              activeCycleId === cycle.id
                ? 'bg-card text-primary border-input shadow-sm'
                : 'bg-muted text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground'
            }`}
          >
            {cycle.locked && (
              <svg
                data-testid="lock-icon"
                aria-label="Locked"
                className="w-3.5 h-3.5 text-warning"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {cycle.name}
            <button
              type="button"
              onClick={(e) => handleDeleteClick(e, cycle)}
              aria-label={`Delete ${cycle.name}`}
              className="ml-1 p-0.5 rounded hover:bg-secondary text-muted-foreground/60 hover:text-secondary-foreground opacity-0 group-hover:opacity-100 transition-opacity"
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
            </button>
          </button>
        ))}

        <button
          onClick={() => setShowCreateDialog(true)}
          aria-label="Create new cycle"
          className="flex items-center justify-center w-8 h-8 ml-1 text-muted-foreground bg-muted rounded-t-lg hover:bg-secondary hover:text-secondary-foreground transition-colors border border-b-0 border-transparent"
          title="Add new cycle"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Create Cycle Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50 p-4">
          <div
            ref={createDialogRef}
            role="dialog"
            aria-modal="true"
            className="bg-card rounded-xl shadow-2xl max-w-sm w-full p-6"
          >
            <h3 className="text-lg font-bold text-foreground mb-4">Create New Cycle</h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="cycleYear"
                  className="block text-sm font-medium text-secondary-foreground mb-1"
                >
                  Year
                </label>
                <input
                  type="number"
                  id="cycleYear"
                  value={newCycleYear}
                  onChange={(e) => setNewCycleYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  min="2024"
                  max="2030"
                />
              </div>
              <div>
                <label
                  htmlFor="courseCodes"
                  className="block text-sm font-medium text-secondary-foreground mb-1"
                >
                  Course Codes{' '}
                  <span className="text-muted-foreground/60 font-normal">
                    (optional, one per line)
                  </span>
                </label>
                <textarea
                  id="courseCodes"
                  value={courseCodesInput}
                  onChange={(e) => setCourseCodesInput(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
                  placeholder={'NDC-26-Mis1-Clinical-AM\nNDC-26-Mis1-Clinical-PM'}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-2 px-4 rounded-md text-primary-foreground font-medium bg-primary hover:bg-primary/90 disabled:bg-muted transition-colors"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1 py-2 px-4 rounded-md bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
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
        <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50 p-4">
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            className="bg-card rounded-xl shadow-2xl max-w-sm w-full p-6"
          >
            <h3 className="text-lg font-bold text-foreground mb-2">Delete Cycle</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteConfirm.name}</span>? All bookings and week
              data for this cycle will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 py-2 px-4 rounded-md text-primary-foreground font-medium bg-destructive hover:bg-destructive/90 disabled:bg-muted transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
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
