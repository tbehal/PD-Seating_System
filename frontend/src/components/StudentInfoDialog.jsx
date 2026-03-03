import React, { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export default function StudentInfoDialog({ dialog, onUnbook, onClose, locked }) {
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, !!dialog, { onEscape: onClose });

  if (!dialog) return null;

  return (
    <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="bg-card rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-foreground">Student Information</h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-muted-foreground/60 hover:text-muted-foreground text-xl"
          >
            &#x2715;
          </button>
        </div>

        {dialog.loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Loading HubSpot data...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Booking Details */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-foreground mb-2">Booking Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium text-secondary-foreground">Student:</span>
                  <p className="text-muted-foreground">{dialog.studentName}</p>
                </div>
                <div>
                  <span className="font-medium text-secondary-foreground">Station:</span>
                  <p className="text-muted-foreground">{dialog.stationLabel}</p>
                </div>
                <div>
                  <span className="font-medium text-secondary-foreground">Shift:</span>
                  <p className="text-muted-foreground">{dialog.shift}</p>
                </div>
                <div>
                  <span className="font-medium text-secondary-foreground">Week:</span>
                  <p className="text-muted-foreground">{dialog.week}</p>
                </div>
              </div>
            </div>

            {/* HubSpot Contact Info */}
            {dialog.hubspotContact ? (
              <div className="bg-info-muted p-4 rounded-lg space-y-3">
                <h4 className="font-semibold text-info mb-2">HubSpot Contact</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-info">Name:</span>
                    <p className="text-info">{dialog.hubspotContact.fullName}</p>
                  </div>
                  {dialog.hubspotContact.email && (
                    <div>
                      <span className="font-medium text-info">Email:</span>
                      <p className="text-info">{dialog.hubspotContact.email}</p>
                    </div>
                  )}
                  {dialog.hubspotContact.phone && (
                    <div>
                      <span className="font-medium text-info">Phone:</span>
                      <p className="text-info">{dialog.hubspotContact.phone}</p>
                    </div>
                  )}
                  {dialog.hubspotContact.studentId && (
                    <div>
                      <span className="font-medium text-info">Student ID:</span>
                      <p className="text-info">{dialog.hubspotContact.studentId}</p>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-info">Payment Status:</span>
                    <p
                      className={`inline-block ml-2 px-2 py-1 rounded text-xs font-semibold ${
                        dialog.hubspotContact.paymentStatus?.toLowerCase().includes('paid')
                          ? 'bg-success-muted text-success'
                          : dialog.hubspotContact.paymentStatus?.toLowerCase().includes('pending')
                            ? 'bg-warning-muted text-warning'
                            : 'bg-muted text-foreground'
                      }`}
                    >
                      {dialog.hubspotContact.paymentStatus || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-info">Lifecycle Stage:</span>
                    <p className="text-info">{dialog.hubspotContact.lifeCycleStage || 'Unknown'}</p>
                  </div>
                </div>

                {/* Deals */}
                {dialog.hubspotContact.deals && dialog.hubspotContact.deals.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-info/30">
                    <h5 className="font-semibold text-info mb-2">
                      Associated Deals ({dialog.hubspotContact.deals.length})
                    </h5>
                    <div className="space-y-2">
                      {dialog.hubspotContact.deals.map((deal, idx) => (
                        <div
                          key={deal.id || idx}
                          className="bg-card p-3 rounded border border-info/30"
                        >
                          <div className="font-medium text-foreground">
                            {deal.properties?.dealname || 'Unnamed Deal'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 space-y-1">
                            {deal.stageName && (
                              <div>
                                <span className="font-medium">Stage:</span>
                                <span
                                  className={`ml-1 px-2 py-0.5 rounded ${
                                    deal.stageName.toLowerCase().includes('paid')
                                      ? 'bg-success-muted text-success'
                                      : 'bg-muted text-secondary-foreground'
                                  }`}
                                >
                                  {deal.stageName}
                                </span>
                              </div>
                            )}
                            {deal.properties?.amount && (
                              <div>
                                <span className="font-medium">Amount:</span> $
                                {deal.properties.amount}
                              </div>
                            )}
                            {deal.properties?.closedate && (
                              <div>
                                <span className="font-medium">Close Date:</span>{' '}
                                {new Date(deal.properties.closedate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-warning-muted p-4 rounded-lg">
                <p className="text-sm text-warning">
                  No HubSpot contact found for "{dialog.studentName}"
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {!locked && (
                <button
                  onClick={() =>
                    onUnbook({
                      stationId: dialog.stationId,
                      shift: dialog.shift,
                      week: dialog.week,
                    })
                  }
                  className="flex-1 py-2 px-4 rounded-md bg-destructive text-primary-foreground font-medium hover:bg-destructive/90 transition-colors"
                >
                  Remove Student
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 rounded-md bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
