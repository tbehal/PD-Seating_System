const express = require('express');
const router = express.Router();
const cache = require('../cache');
const { loadAvailabilityRows, AvailabilityCalculator, updateAvailability, unbookAvailability } = require('../excel-loader');

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
        const { lab, station, shift, weeks, traineeName } = req.body;
        if (!lab || !station || !shift || !weeks || !Array.isArray(weeks) || !traineeName) {
            return res.status(400).json({ error: 'Invalid booking data provided.' });
        }

        // This function needs to be created in excel-loader.js
        await updateAvailability({ lab, station, shift, weeks, traineeName });

        // Invalidate the cache after a successful booking
        await cache.del(CACHE_KEY);

        res.json({ success: true, message: 'Slot booked successfully.' });

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

module.exports = router;