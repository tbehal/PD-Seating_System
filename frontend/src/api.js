import axios from 'axios';
import { API_BASE } from './config';

/**
 * Finds available lab combinations based on search criteria.
 * @param {object} criteria - The search parameters.
 * @returns {Promise<Array>} A promise that resolves to an array of available combinations.
 */
export async function findCombinations(criteria) {
    try {
        const res = await axios.post(`${API_BASE}/api/availability/find`, criteria);
        return res.data;
    } catch (error) {
        console.error('Error finding combinations:', error.response?.data?.error || error.message);
        // In a real app, you might want to throw the error to be handled by the component
        // or return a specific error object.
        return []; // Return empty array on failure
    }
}

/**
 * Fetches the availability grid for a specific lab and shift.
 * @param {string} lab - The lab to fetch the grid for.
 * @param {string} shift - The shift (e.g., 'AM' or 'PM').
 * @returns {Promise<object|null>} A promise that resolves to the grid data or null on error.
 */
export async function fetchGrid(lab, shift) {
    try {
        const res = await axios.post(`${API_BASE}/api/availability/grid`, { lab, shift });
        return res.data;
    } catch (error) {
        console.error('Error fetching grid:', error.response?.data?.error || error.message);
        return null;
    }
}

/**
 * Books a lab slot for a trainee.
 * @param {object} bookingDetails - The details of the booking.
 * @returns {Promise<object>} A promise that resolves to the server's response.
 */
export async function bookSlot(bookingDetails) {
    // The component will handle the full error response
    return await axios.post(`${API_BASE}/api/availability/book`, bookingDetails);
}

/**
 * Unbooks a lab slot (clears trainee name) for given lab/station/shift/weeks.
 * @param {object} details - { lab, station, shift, weeks }
 * @returns {Promise<object>} A promise that resolves to the server's response.
 */
export async function unbookSlot(details) {
    return await axios.post(`${API_BASE}/api/availability/unbook`, details);
}

/**
 * Invalidates the server-side cache.
 * @returns {Promise<object>} A promise that resolves to the server's response.
 */
export async function invalidateCache() {
    try {
        const res = await axios.post(`${API_BASE}/api/availability/invalidate`);
        return res.data;
    } catch (error) {
        console.error('Error invalidating cache:', error.response?.data?.error || error.message);
        throw error; // Re-throw to be handled by the caller
    }
}
