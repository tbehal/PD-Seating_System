const ExcelJS = require('exceljs');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const config = require('./config');
// Assuming uploadFile will be implemented in msgraph.js
const { downloadFile, uploadFile } = require('./msgraph');

async function loadWorkbookBuffer() {
    if (config.useGraph) {
        console.log('📁 Loading Excel file from OneDrive...');
        try {
            if (config.graph.driveId && config.graph.itemId) {
                return await downloadFile(config.graph.driveId, config.graph.itemId);
            } else if (config.graph.downloadUrl) {
                return await downloadFile(null, null, config.graph.downloadUrl);
            } else {
                throw new Error('OneDrive is enabled but no file location specified (DRIVE_ID/ITEM_ID or DOWNLOAD_URL)');
            }
        } catch (error) {
            console.error('❌ Failed to load from OneDrive:', error.message);
            console.log('🔄 Falling back to local file...');
            // Fall back to local file if OneDrive fails
        }
    }

    const p = path.resolve(config.localExcelPath);
    if (!fs.existsSync(p)) throw new Error(`Excel file not found at ${p}`);
    console.log('📁 Loading Excel file from local path:', p);
    return fs.readFileSync(p);
}

async function saveWorkbookBuffer(workbook) {
    const buffer = await workbook.xlsx.writeBuffer();
    if (config.useGraph) {
        console.log('💾 Saving Excel file to OneDrive...');
        try {
            if (!uploadFile) {
                throw new Error("uploadFile function is not available in msgraph module.");
            }
            // Using the same identifiers used for downloading
            await uploadFile(config.graph.driveId, config.graph.itemId, buffer);
            console.log('✅ File saved to OneDrive successfully!');
        } catch (error) {
            console.error('❌ Failed to save to OneDrive:', error.message);
            console.log('🔄 Falling back to local save...');
            // Fall back to local save if OneDrive fails
            const p = path.resolve(config.localExcelPath);
            fs.writeFileSync(p, buffer);
        }
    } else {
        const p = path.resolve(config.localExcelPath);
        fs.writeFileSync(p, buffer);
        console.log('💾 File saved locally at:', p);
    }
}


async function loadAvailabilityRows() {
    const workbookBuffer = await loadWorkbookBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(workbookBuffer);

    const amSheet = workbook.getWorksheet('AM');
    const pmSheet = workbook.getWorksheet('PM');

    if (!amSheet && !pmSheet) {
        throw new Error('Expected at least one sheet named "AM" or "PM" in the workbook.');
    }

    const allRows = [];

    function parseSheetForAvailability(sheet, shift, rows) {
        if (!sheet) return;
        const weekHeaderRow = sheet.getRow(1);
        const dateHeaderRow = sheet.getRow(2);
        let lastDataColumn = 0;
        // Find the last column with data in the header
        dateHeaderRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            if (colNumber > 2) { // Columns 1 and 2 are Lab/Station
                lastDataColumn = colNumber;
            }
        });

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber <= 2) return; // Skip header rows
            const lab = (row.getCell(1).value || '').toString().trim();
            const station = (row.getCell(2).value || '').toString().trim();
            if (!lab || !station) return; // Skip rows without lab/station

            for (let colIdx = 3; colIdx <= lastDataColumn; colIdx++) {
                const week = Number(weekHeaderRow.getCell(colIdx).value);
                const date = (dateHeaderRow.getCell(colIdx).value || '').toString().trim();
                if (!week || isNaN(week)) continue; // Skip columns that aren't valid weeks
                const practitioner = (row.getCell(colIdx).value || '').toString().trim();
                const isAvailable = practitioner === '';
                rows.push({ week, date, lab, station, shift, practitioner, available: isAvailable });
            }
        });
    }

    parseSheetForAvailability(amSheet, 'AM', allRows);
    parseSheetForAvailability(pmSheet, 'PM', allRows);

    return allRows;
}

async function updateAvailability({ lab, station, shift, weeks, traineeName }) {
    const workbookBuffer = await loadWorkbookBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(workbookBuffer);

    const sheet = workbook.getWorksheet(shift);
    if (!sheet) {
        const err = new Error(`Shift "${shift}" not found in the workbook.`);
        err.isBusinessLogic = true;
        throw err;
    }

    // Find the column number for each week
    const weekHeaderRow = sheet.getRow(1);
    const weekToColMap = new Map();
    weekHeaderRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const weekValue = Number(cell.value);
        if (weekValue) {
            weekToColMap.set(weekValue, colNumber);
        }
    });

    let targetRow = null;
    // Find the target row by matching lab and station
    sheet.eachRow((row) => {
        const rowLab = (row.getCell(1).value || '').toString().trim();
        const rowStation = (row.getCell(2).value || '').toString().trim();
        if (rowLab === lab && rowStation === station) {
            targetRow = row;
        }
    });

    if (!targetRow) {
        const err = new Error(`Lab "${lab}" - Station "${station}" not found.`);
        err.isBusinessLogic = true;
        throw err;
    }

    const colsToUpdate = weeks.map(week => weekToColMap.get(week)).filter(Boolean);

    // Verify that all requested weeks are available before booking any of them
    for (const col of colsToUpdate) {
        const cell = targetRow.getCell(col);
        const cellValue = (cell.value || '').toString().trim();
        if (cellValue !== '') {
            const weekNumber = weekHeaderRow.getCell(col).value;
            const err = new Error(`Slot for week ${weekNumber} is already booked by ${cellValue}.`);
            err.isBusinessLogic = true;
            throw err;
        }
    }

    // If all checks pass, update the cells
    colsToUpdate.forEach(col => {
        targetRow.getCell(col).value = traineeName;
    });

    // Save the updated workbook
    await saveWorkbookBuffer(workbook);
}


/**
 * A class to calculate and cache availability combinations and provide visualization data.
 */
class AvailabilityCalculator {
    constructor(availabilityData) {
        this.availabilityMap = new Map();
        this.labStationMap = new Map(); // Stores a Set of stations for each lab
        this.maxWeek = 0;
        this.weekDates = new Map(); // key: week number, value: date string
        this._processData(availabilityData);
    }

    _processData(availabilityData) {
        for (const slot of availabilityData) {
            const key = `${slot.lab}-${slot.station}-${slot.shift}`;
            if (!this.availabilityMap.has(key)) {
                this.availabilityMap.set(key, new Map());
            }
            
            // Store practitioner name if booked, or true if available
            if (slot.available) {
                this.availabilityMap.get(key).set(slot.week, true);
            } else {
                this.availabilityMap.get(key).set(slot.week, slot.practitioner || "✗");
            }

            // Store week dates
            if (slot.date) {
                this.weekDates.set(slot.week, slot.date);
            }

            if (!this.labStationMap.has(slot.lab)) {
                this.labStationMap.set(slot.lab, new Set());
            }
            this.labStationMap.get(slot.lab).add(slot.station);

            if (slot.week > this.maxWeek) {
                this.maxWeek = slot.week;
            }
        }
    }

    _findSlotsForLocation({ lab, station, shift, startWeek, endWeek, weeksNeeded }) {
        const key = `${lab}-${station}-${shift}`;
        const weeklyAvailability = this.availabilityMap.get(key);
        if (!weeklyAvailability) return [];

        const combinations = [];
        for (let w = startWeek; w <= endWeek - weeksNeeded + 1; w++) {
            let isBlockAvailable = true;
            for (let i = 0; i < weeksNeeded; i++) {
                const value = weeklyAvailability.get(w + i);
                // Only consider a slot available if it's exactly true (not a string)
                if (value !== true) {
                    isBlockAvailable = false;
                    break;
                }
            }
            if (isBlockAvailable) {
                const combo = Array.from({ length: weeksNeeded }, (_, i) => w + i);
                combinations.push(combo);
            }
        }
        return combinations;
    }

    findAllRankedCombinations({ shift, startWeek, endWeek, weeksNeeded, level, stationType }) {
        const level1Priority = ['Lab A', 'Lab B', 'Lab C', 'Lab E'];
        const level1Secondary = ['Lab B9', 'Lab D'];
        const level2Priority = ['Lab B9', 'Lab D'];
        const level2Secondary = ['Lab A', 'Lab B', 'Lab C', 'Lab E'];

        // Define LH stations for each lab
        const lhStations = {
            'Lab A': ['1', '38'],
            'Lab B': ['26'],
            'Lab C': ['7'],
            'Lab E': ['14'],
            'Lab B9': ['10', '11'],
            'Lab D': ['1']
        };

        // Helper function to check if a station is LH
        const isLHStation = (lab, station) => {
            return lhStations[lab] && lhStations[lab].includes(station);
        };

        let labOrder;
        if (level === 1) {
            labOrder = [...level1Priority, ...level1Secondary];
        } else if (level === 2) {
            labOrder = [...level2Priority, ...level2Secondary];
        } else {
            labOrder = Array.from(this.labStationMap.keys()).sort();
        }

        const rankedResults = [];
        let idCounter = 0;

        for (const lab of labOrder) {
            let stations = Array.from(this.labStationMap.get(lab) || []).sort((a, b) => {
                const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
                const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
                return numA - numB;
            });

            // Filter stations based on stationType (LH/RH)
            if (stationType === 'LH') {
                stations = stations.filter(station => isLHStation(lab, station));
            } else if (stationType === 'RH') {
                stations = stations.filter(station => !isLHStation(lab, station));
            }

            for (const station of stations) {
                const slots = this._findSlotsForLocation({
                    lab, station, shift, startWeek, endWeek, weeksNeeded
                });

                for (const weekCombination of slots) {
                    const weekDates = weekCombination.map(week => this.weekDates.get(week) || '');
                    rankedResults.push({
                        id: `${lab}-${station}-${shift}-${weekCombination.join(',')}-${idCounter++}`,
                        lab,
                        station,
                        shift,
                        weeks: weekCombination,
                        weekDates: weekDates,
                        stationType: isLHStation(lab, station) ? 'LH' : 'RH'
                    });
                }
            }
        }
        return rankedResults;
    }

    getAvailabilityGrid(lab, shift) {
        const stations = Array.from(this.labStationMap.get(lab) || []).sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
            const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
            return numA - numB;
        });

        if (stations.length === 0) {
            return { lab, shift, weeks: [], grid: [] };
        }

        const grid = [];
        const weekHeaders = Array.from({ length: this.maxWeek }, (_, i) => i + 1);
        const weekDates = Array.from({ length: this.maxWeek }, (_, i) => this.weekDates.get(i + 1) || '');

        // Define LH stations for each lab
        const lhStations = {
            'Lab A': ['1', '38'],
            'Lab B': ['26'],
            'Lab C': ['7'],
            'Lab E': ['14']
    
        };

        // Helper function to check if a station is LH
        const isLHStation = (lab, station) => {
            return lhStations[lab] && lhStations[lab].includes(station);
        };

        for (const station of stations) {
            const key = `${lab}-${station}-${shift}`;
            const availability = this.availabilityMap.get(key) || new Map();
            
            // Format station display with LH/RH suffix
            const displayStation = isLHStation(lab, station) ? `${station}-LH` : station;
            const row = { 
                station: displayStation,
                stationId: station, // Store original station number for API calls
                availability: [] 
            };

            for (let w = 1; w <= this.maxWeek; w++) {
                // Instead of only ✓/✗, return the trainee name if booked
                const isAvailable = availability.get(w);
                if (isAvailable === true) {
                    row.availability.push("✓");
                } else if (typeof isAvailable === "string" && isAvailable.trim() !== "") {
                    row.availability.push(isAvailable); // Show the student's name
                } else {
                    row.availability.push("✗"); // fallback
                }
            }
            grid.push(row);
        }

        return { lab, shift, weeks: weekHeaders, weekDates, grid };
    }

    updateData(newAvailabilityData) {
        console.log("Invalidating cache and updating data...");
        this.availabilityMap.clear();
        this.labStationMap.clear();
        this.maxWeek = 0;
        this._processData(newAvailabilityData);
        console.log("Data update complete.");
    }
}

// Function to reset all bookings while preserving structure
async function resetAllBookings() {
    try {
        console.log('🔄 Resetting all bookings...');
        
        // Load current workbook
        const workbookBuffer = await loadWorkbookBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(workbookBuffer);
        
        // Process each sheet (AM and PM)
        const sheets = ['AM', 'PM'];
        for (const sheetName of sheets) {
            const sheet = workbook.getWorksheet(sheetName);
            if (!sheet) continue;
            
            console.log(`📝 Processing ${sheetName} sheet...`);
            
            // Keep rows 1 and 2 (headers) unchanged
            // Clear data from row 3 onwards, columns 3 onwards
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber <= 2) return; // Skip header rows
                
                // Clear all data cells (columns 3 onwards) but keep lab/station info
                for (let colIdx = 3; colIdx <= row.cellCount; colIdx++) {
                    const cell = row.getCell(colIdx);
                    cell.value = ''; // Clear the cell value
                }
            });
        }
        
        // Save the reset workbook
        await saveWorkbookBuffer(workbook);
        
        console.log('✅ All bookings reset successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Error resetting bookings:', error);
        throw error;
    }
}

// Function to export current data to Excel
async function exportCurrentData() {
    try {
        console.log('📤 Exporting current data...');
        
        // Load current workbook
        const workbookBuffer = await loadWorkbookBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(workbookBuffer);
        
        // Create a new workbook for export
        const exportWorkbook = new ExcelJS.Workbook();
        
        // Copy each sheet
        workbook.eachSheet((sheet) => {
            const exportSheet = exportWorkbook.addWorksheet(sheet.name);
            
            // Copy all rows and cells
            sheet.eachRow((row, rowNumber) => {
                const exportRow = exportSheet.getRow(rowNumber);
                row.eachCell((cell, colNumber) => {
                    const exportCell = exportRow.getCell(colNumber);
                    exportCell.value = cell.value;
                    
                    // Copy cell formatting if available
                    if (cell.style) {
                        exportCell.style = cell.style;
                    }
                });
            });
        });
        
        // Convert to buffer
        const buffer = await exportWorkbook.xlsx.writeBuffer();
        console.log('✅ Data exported successfully');
        
        return buffer;
        
    } catch (error) {
        console.error('❌ Error exporting data:', error);
        throw error;
    }
}

// Clear booking(s) for given lab/station/shift/weeks
async function unbookAvailability({ lab, station, shift, weeks }) {
    const workbookBuffer = await loadWorkbookBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(workbookBuffer);

    const sheet = workbook.getWorksheet(shift);
    if (!sheet) {
        const err = new Error(`Shift "${shift}" not found in the workbook.`);
        err.isBusinessLogic = true;
        throw err;
    }

    const weekHeaderRow = sheet.getRow(1);
    const weekToColMap = new Map();
    weekHeaderRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const weekValue = Number(cell.value);
        if (weekValue) {
            weekToColMap.set(weekValue, colNumber);
        }
    });

    let targetRow = null;
    sheet.eachRow((row) => {
        const rowLab = (row.getCell(1).value || '').toString().trim();
        const rowStation = (row.getCell(2).value || '').toString().trim();
        if (rowLab === lab && rowStation === station) {
            targetRow = row;
        }
    });

    if (!targetRow) {
        const err = new Error(`Lab "${lab}" - Station "${station}" not found.`);
        err.isBusinessLogic = true;
        throw err;
    }

    const colsToClear = weeks.map(week => weekToColMap.get(week)).filter(Boolean);
    colsToClear.forEach(col => {
        targetRow.getCell(col).value = '';
    });

    await saveWorkbookBuffer(workbook);
}

module.exports = { loadAvailabilityRows, AvailabilityCalculator, updateAvailability, unbookAvailability, resetAllBookings, exportCurrentData };