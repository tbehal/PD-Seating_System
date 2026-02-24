import React from 'react';

export default function StudentInfoDialog({ dialog, onUnbook, onClose, locked }) {
  if (!dialog) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-slate-800">Student Information</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            &#x2715;
          </button>
        </div>

        {dialog.loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            <span className="ml-3 text-gray-600">Loading HubSpot data...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Booking Details */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-gray-900 mb-2">Booking Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Student:</span>
                  <p className="text-slate-600">{dialog.studentName}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Station:</span>
                  <p className="text-slate-600">{dialog.stationLabel}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Shift:</span>
                  <p className="text-slate-600">{dialog.shift}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Week:</span>
                  <p className="text-slate-600">{dialog.week}</p>
                </div>
              </div>
            </div>

            {/* HubSpot Contact Info */}
            {dialog.hubspotContact ? (
              <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                <h4 className="font-semibold text-blue-900 mb-2">HubSpot Contact</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-blue-800">Name:</span>
                    <p className="text-blue-700">{dialog.hubspotContact.fullName}</p>
                  </div>
                  {dialog.hubspotContact.email && (
                    <div>
                      <span className="font-medium text-blue-800">Email:</span>
                      <p className="text-blue-700">{dialog.hubspotContact.email}</p>
                    </div>
                  )}
                  {dialog.hubspotContact.phone && (
                    <div>
                      <span className="font-medium text-blue-800">Phone:</span>
                      <p className="text-blue-700">{dialog.hubspotContact.phone}</p>
                    </div>
                  )}
                  {dialog.hubspotContact.studentId && (
                    <div>
                      <span className="font-medium text-blue-800">Student ID:</span>
                      <p className="text-blue-700">{dialog.hubspotContact.studentId}</p>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-blue-800">Payment Status:</span>
                    <p className={`inline-block ml-2 px-2 py-1 rounded text-xs font-semibold ${
                      dialog.hubspotContact.paymentStatus?.toLowerCase().includes('paid')
                        ? 'bg-green-100 text-green-800'
                        : dialog.hubspotContact.paymentStatus?.toLowerCase().includes('pending')
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {dialog.hubspotContact.paymentStatus || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-blue-800">Lifecycle Stage:</span>
                    <p className="text-blue-700">{dialog.hubspotContact.lifeCycleStage || 'Unknown'}</p>
                  </div>
                </div>

                {/* Deals */}
                {dialog.hubspotContact.deals && dialog.hubspotContact.deals.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <h5 className="font-semibold text-blue-900 mb-2">Associated Deals ({dialog.hubspotContact.deals.length})</h5>
                    <div className="space-y-2">
                      {dialog.hubspotContact.deals.map((deal, idx) => (
                        <div key={deal.id || idx} className="bg-white p-3 rounded border border-blue-200">
                          <div className="font-medium text-gray-900">{deal.properties?.dealname || 'Unnamed Deal'}</div>
                          <div className="text-xs text-gray-600 mt-1 space-y-1">
                            {deal.stageName && (
                              <div>
                                <span className="font-medium">Stage:</span>
                                <span className={`ml-1 px-2 py-0.5 rounded ${
                                  deal.stageName.toLowerCase().includes('paid')
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {deal.stageName}
                                </span>
                              </div>
                            )}
                            {deal.properties?.amount && (
                              <div><span className="font-medium">Amount:</span> ${deal.properties.amount}</div>
                            )}
                            {deal.properties?.closedate && (
                              <div>
                                <span className="font-medium">Close Date:</span> {new Date(deal.properties.closedate).toLocaleDateString()}
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
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No HubSpot contact found for "{dialog.studentName}"
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {!locked && (
                <button
                  onClick={() => onUnbook({
                    stationId: dialog.stationId,
                    shift: dialog.shift,
                    week: dialog.week,
                  })}
                  className="flex-1 py-2 px-4 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                >
                  Remove Student
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 rounded-md bg-gray-200 text-gray-800 font-medium hover:bg-gray-300 transition-colors"
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
