const express = require('express');
const router = express.Router();
const cache = require('../cache');
const { loadAvailabilityRows, AvailabilityCalculator, updateAvailability, unbookAvailability } = require('../excel-loader');
const hubspot = require('../hubspot');

const CACHE_KEY = 'availability_data'; // Using a more generic key

// Helper to get a calculator instance, potentially from cache
async function getCalculator() {
    let allAvailability = await cache.get(CACHE_KEY);
    if (!allAvailability) {
        allAvailability = await loadAvailabilityRows();
        // Cache the raw data. The calculator is cheap to instantiate.
        await cache.set(CACHE_KEY, allAvailability);
    }
    return new AvailabilityCalculator(allAvailability);
}

// Route to find available combinations
router.post('/find', async (req, res) => {
    try {
        const { shift, startWeek, endWeek, weeksNeeded, level, stationType } = req.body;

        if (!shift || startWeek === undefined || endWeek === undefined || !weeksNeeded || !level) {
            return res.status(400).json({ error: 'Missing required search criteria.' });
        }

        const calculator = await getCalculator();

        const combinations = calculator.findAllRankedCombinations({
            shift,
            startWeek: parseInt(startWeek, 10),
            endWeek: parseInt(endWeek, 10),
            weeksNeeded: parseInt(weeksNeeded, 10),
            level: parseInt(level, 10),
            stationType: stationType || 'all'
        });

        res.json(combinations);
    } catch (err) {
        console.error('Error finding combinations:', err);
        res.status(500).json({ error: 'Failed to find availability.' });
    }
});

// Route to get the availability grid for a lab
router.post('/grid', async (req, res) => {
    try {
        const { lab, shift } = req.body;
        if (!lab || !shift) {
            return res.status(400).json({ error: 'Lab and shift are required.' });
        }

        const calculator = await getCalculator();
        const gridData = calculator.getAvailabilityGrid(lab, shift);

        res.json(gridData);
    } catch (err) {
        console.error('Error getting grid data:', err);
        res.status(500).json({ error: 'Failed to get availability grid.' });
    }
});

// Route to book a slot
router.post('/book', async (req, res) => {
    try {
        const { lab, station, shift, weeks, traineeName, contactId, paymentStatus } = req.body;
        if (!lab || !station || !shift || !weeks || !Array.isArray(weeks) || !traineeName) {
            return res.status(400).json({ error: 'Invalid booking data provided.' });
        }

        // Persist booking to Excel, including HubSpot contactId if provided
        await updateAvailability({ lab, station, shift, weeks, traineeName, contactId });

        // If contactId is provided, update payment status in HubSpot
        if (contactId && paymentStatus) {
            try {
                await hubspot.updateContactPaymentStatus(contactId, paymentStatus);
            } catch (hubspotError) {
                console.warn('Failed to update HubSpot payment status:', hubspotError.message);
                // Don't fail the booking if HubSpot update fails
            }
        }

        // Invalidate the cache after a successful booking
        await cache.del(CACHE_KEY);

        res.json({ 
            success: true, 
            message: 'Slot booked successfully.',
            contactId: contactId,
            paymentStatus: paymentStatus
        });

    } catch (err) {
        console.error('Error booking slot:', err);
        // Check if it's a custom error from updateAvailability (e.g. slot not available)
        if (err.isBusinessLogic) {
             return res.status(409).json({ error: err.message }); // 409 Conflict
        }
        res.status(500).json({ error: 'Failed to book slot.' });
    }
});

// Route to unbook a slot
router.post('/unbook', async (req, res) => {
    try {
        const { lab, station, shift, weeks } = req.body;
        if (!lab || !station || !shift || !weeks || !Array.isArray(weeks)) {
            return res.status(400).json({ error: 'Invalid unbooking data provided.' });
        }

        await unbookAvailability({ lab, station, shift, weeks });

        // Invalidate the cache after a successful unbooking
        await cache.del(CACHE_KEY);

        res.json({ success: true, message: 'Slot(s) unbooked successfully.' });

    } catch (err) {
        console.error('Error unbooking slot:', err);
        if (err.isBusinessLogic) {
            return res.status(409).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to unbook slot.' });
    }
});

// Invalidate cache manually
router.post('/invalidate', async (req, res) => {
    try {
        await cache.del(CACHE_KEY);
        res.json({ ok: true, message: 'Cache invalidated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to reset all bookings (clear data but keep structure)
router.post('/reset', async (req, res) => {
    try {
        console.log('🔄 Resetting all bookings...');
        
        // Import the reset function from excel-loader
        const { resetAllBookings } = require('../excel-loader');
        
        // Reset all bookings while preserving structure
        await resetAllBookings();
        
        // Invalidate cache to force fresh data load
        await cache.del(CACHE_KEY);
        
        console.log('✅ All bookings reset successfully');
        res.json({ 
            success: true, 
            message: 'All bookings have been reset. The Excel file structure is preserved but all data has been cleared.' 
        });
        
    } catch (err) {
        console.error('❌ Error resetting bookings:', err);
        res.status(500).json({ error: 'Failed to reset bookings.' });
    }
});

// Route to export current data to Excel
router.get('/export', async (req, res) => {
    try {
        console.log('📤 Exporting current data...');
        
        // Import the export function from excel-loader
        const { exportCurrentData } = require('../excel-loader');
        
        // Export current data to Excel buffer
        const excelBuffer = await exportCurrentData();
        
        // Set response headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="lab-availability-${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.setHeader('Content-Length', excelBuffer.length);
        
        // Send the Excel file
        res.send(excelBuffer);
        
        console.log('✅ Data exported successfully');
        
    } catch (err) {
        console.error('❌ Error exporting data:', err);
        res.status(500).json({ error: 'Failed to export data.' });
    }
});

// HubSpot integration routes

// Search contacts by name
router.get('/contacts/search', async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ error: 'Query parameter "q" is required and must be at least 2 characters long.' });
        }

        const contacts = await hubspot.searchContacts(q.trim(), parseInt(limit, 10));
        res.json(contacts);
    } catch (err) {
        console.error('Error searching contacts:', err);
        res.status(500).json({ error: 'Failed to search contacts.' });
    }
});

// Get contact by ID
router.get('/contacts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ error: 'Contact ID is required.' });
        }

        const contact = await hubspot.getContactById(id);
        res.json(contact);
    } catch (err) {
        console.error('Error getting contact:', err);
        res.status(500).json({ error: 'Failed to get contact.' });
    }
});

// Update contact payment status
router.patch('/contacts/:id/payment-status', async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus } = req.body;
        
        if (!id) {
            return res.status(400).json({ error: 'Contact ID is required.' });
        }
        
        if (!paymentStatus) {
            return res.status(400).json({ error: 'Payment status is required.' });
        }

        const updatedContact = await hubspot.updateContactPaymentStatus(id, paymentStatus);
        res.json(updatedContact);
    } catch (err) {
        console.error('Error updating contact payment status:', err);
        res.status(500).json({ error: 'Failed to update contact payment status.' });
    }
});

module.exports = router;