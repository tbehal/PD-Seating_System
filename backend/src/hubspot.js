// Moved from api/backend/hubspot.js — HubSpot CRM integration
const axios = require('axios');

class HubSpotService {
  constructor() {
    this.apiKey = require('./config').hubspotApiKey;
    this.baseUrl = 'https://api.hubapi.com';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.registrationCache = new Map();
    this.registrationCacheTTL = 60 * 1000; // 60 seconds

    // Rate limiter state: 90 requests per 10-second window
    this._requestTimestamps = [];
    this._rateLimit = 90;
    this._rateWindow = 10000;

    if (!this.apiKey) {
      console.warn(
        '  HUBSPOT_API_KEY not found. HubSpot integration will be disabled until a valid token is provided.'
      );
    }
  }

  async getAccessToken() {
    if (!this.apiKey) {
      throw new Error(
        'Missing HUBSPOT_API_KEY. Please set it in your .env or deployment environment (Private App access token).'
      );
    }
    return this.apiKey;
  }

  async searchContacts(query, limit = 10) {
    try {
      const token = await this.getAccessToken();

      const trimmed = String(query).trim();
      const tokens = trimmed.split(/\s+/).filter(Boolean);

      const filterGroups = [];

      filterGroups.push({ filters: [{ propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: trimmed }] });
      filterGroups.push({ filters: [{ propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: trimmed }] });
      filterGroups.push({ filters: [{ propertyName: 'email', operator: 'CONTAINS_TOKEN', value: trimmed }] });
      if (/^\d+$/.test(trimmed)) {
        filterGroups.push({ filters: [{ propertyName: 'student_id', operator: 'EQ', value: trimmed }] });
      }

      if (tokens.length >= 2) {
        const first = tokens[0];
        const last = tokens[tokens.length - 1];
        filterGroups.push({
          filters: [
            { propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: first },
            { propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: last },
          ],
        });
        filterGroups.push({
          filters: [
            { propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: last },
            { propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: first },
          ],
        });
      }

      const response = await axios.post(
        `${this.baseUrl}/crm/v3/objects/contacts/search`,
        {
          properties: ['firstname', 'lastname', 'email', 'qr_code_id', 'student_id', 'phone', 'lifecyclestage'],
          filterGroups,
          limit,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const contacts = response.data.results || [];

      const contactsWithDeals = await Promise.all(
        contacts.map(async (contact) => {
          try {
            const deals = await this.getContactDeals(contact.id);
            const paymentStatus = this.getPaymentStatusFromDeals(deals);

            return {
              id: contact.id,
              firstName: contact.properties.firstname || '',
              lastName: contact.properties.lastname || '',
              email: contact.properties.email || '',
              phone: contact.properties.phone || '',
              studentId: contact.properties.student_id || '',
              qrCodeId: contact.properties.qr_code_id || '',
              fullName: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
              lifeCycleStage: contact.properties.lifecyclestage || 'Unknown',
              paymentStatus: paymentStatus,
              deals: deals,
            };
          } catch (error) {
            console.warn(`Failed to fetch deals for contact ${contact.id}:`, error.message);
            return {
              id: contact.id,
              firstName: contact.properties.firstname || '',
              lastName: contact.properties.lastname || '',
              email: contact.properties.email || '',
              phone: contact.properties.phone || '',
              studentId: contact.properties.student_id || '',
              qrCodeId: contact.properties.qr_code_id || '',
              fullName: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
              lifeCycleStage: contact.properties.lifecyclestage || 'Unknown',
              paymentStatus: 'Unknown',
              deals: [],
            };
          }
        })
      );

      return contactsWithDeals;
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 401) {
        console.error('HubSpot auth error - invalid or expired token.');
      } else if (status === 429) {
        console.warn('HubSpot rate limit reached - retry after delay.');
      } else {
        console.error('HubSpot search error:', message);
      }

      throw new Error(`Failed to search contacts in HubSpot: ${message}`);
    }
  }

  async getContactDeals(contactId) {
    try {
      const token = await this.getAccessToken();

      let allDealIds = [];
      let after = undefined;
      let hasMore = true;

      while (hasMore) {
        const response = await axios.get(
          `${this.baseUrl}/crm/v3/objects/contacts/${contactId}/associations/deals`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            params: {
              limit: 100,
              ...(after && { after })
            }
          }
        );

        const results = response.data.results || [];
        allDealIds = [...allDealIds, ...results];

        after = response.data.paging?.next?.after;
        hasMore = !!after;
      }

      const deals = await Promise.all(
        allDealIds.map(async (dealAssoc) => {
          try {
            const dealResponse = await axios.get(
              `${this.baseUrl}/crm/v3/objects/deals/${dealAssoc.id}?properties=dealname,amount,dealstage,closedate,pipeline`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            const deal = dealResponse.data;
            const stageId = deal.properties.dealstage;
            const pipelineId = deal.properties.pipeline;

            if (stageId && pipelineId) {
              try {
                const stageName = await this.getDealStageName(pipelineId, stageId);
                deal.stageName = stageName;
              } catch (error) {
                console.warn(`Failed to fetch stage name for ${stageId}:`, error.message);
                deal.stageName = stageId;
              }
            }

            return deal;
          } catch (error) {
            console.warn(`Failed to fetch deal ${dealAssoc.id}:`, error.message);
            return null;
          }
        })
      );

      return deals.filter(deal => deal !== null);
    } catch (error) {
      console.warn(`Failed to fetch deals for contact ${contactId}:`, error.message);
      return [];
    }
  }

  async getDealStageName(pipelineId, stageId) {
    try {
      const token = await this.getAccessToken();

      const cacheKey = `stage_${pipelineId}_${stageId}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const response = await axios.get(
        `${this.baseUrl}/crm/v3/pipelines/deals/${pipelineId}/stages/${stageId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const stageName = response.data.label || stageId;

      this.cache.set(cacheKey, {
        data: stageName,
        timestamp: Date.now()
      });

      return stageName;
    } catch (error) {
      console.warn(`Failed to fetch stage name:`, error.message);
      return stageId;
    }
  }

  getPaymentStatusFromDeals(deals) {
    if (!deals || deals.length === 0) {
      return 'No Deals';
    }

    const dealWithStage = deals.find(deal => deal.stageName) || deals[0];

    if (!dealWithStage) {
      return 'Unknown';
    }

    return dealWithStage.stageName || dealWithStage.properties.dealstage || 'Unknown';
  }

  async getContactById(contactId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,qr_code_id,student_id,phone,lifecyclestage`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const contact = response.data;
      const deals = await this.getContactDeals(contactId);
      const paymentStatus = this.getPaymentStatusFromDeals(deals);

      return {
        id: contact.id,
        firstName: contact.properties.firstname || '',
        lastName: contact.properties.lastname || '',
        email: contact.properties.email || '',
        phone: contact.properties.phone || '',
        studentId: contact.properties.student_id || '',
        qrCodeId: contact.properties.qr_code_id || '',
        fullName: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
        lifeCycleStage: contact.properties.lifecyclestage || 'Unknown',
        paymentStatus: paymentStatus,
        deals: deals,
      };
    } catch (error) {
      console.error('Failed to get contact:', error.message);
      throw new Error(`Failed to get contact from HubSpot: ${error.message}`);
    }
  }

  async updateContactPaymentStatus(contactId, paymentStatus) {
    console.log(`Payment status update for contact ${contactId}: ${paymentStatus}`);
    return { success: true, message: 'Payment status tracked via deals' };
  }

  // --- Rate limiter & batch utilities ---

  async throttledRequest(fn) {
    const now = Date.now();
    this._requestTimestamps = this._requestTimestamps.filter(t => now - t < this._rateWindow);
    if (this._requestTimestamps.length >= this._rateLimit) {
      const oldest = this._requestTimestamps[0];
      const waitMs = this._rateWindow - (now - oldest) + 50;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    this._requestTimestamps.push(Date.now());
    return fn();
  }

  async batchProcess(items, fn, concurrency = 5) {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(item => fn(item)));
      results.push(...batchResults);
    }
    return results;
  }

  // --- Batch Association Helpers (v4 API — far fewer API calls) ---

  async batchGetAssociations(fromType, toType, ids) {
    const token = await this.getAccessToken();
    const resultMap = new Map(); // fromId → [toId, ...]
    // v4 batch supports up to 100 inputs
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      try {
        const response = await this.throttledRequest(() =>
          axios.post(
            `${this.baseUrl}/crm/v4/associations/${fromType}/${toType}/batch/read`,
            { inputs: batch.map(id => ({ id })) },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
          )
        );
        for (const result of (response.data.results || [])) {
          const fromId = String(result.from?.id);
          const toIds = (result.to || []).map(t => String(t.toObjectId));
          if (fromId && toIds.length > 0) {
            resultMap.set(fromId, toIds);
          }
        }
      } catch (error) {
        console.warn(`Batch association ${fromType}->${toType} error:`, error.message);
      }
    }
    return resultMap;
  }

  async batchReadObjects(objectType, ids, properties) {
    const token = await this.getAccessToken();
    const resultMap = new Map();
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      try {
        const response = await this.throttledRequest(() =>
          axios.post(
            `${this.baseUrl}/crm/v3/objects/${objectType}/batch/read`,
            { inputs: batch.map(id => ({ id })), properties },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
          )
        );
        for (const obj of (response.data.results || [])) {
          resultMap.set(obj.id, obj);
        }
      } catch (error) {
        console.warn(`Batch read ${objectType} error:`, error.message);
      }
    }
    return resultMap;
  }

  // --- Registration List Methods ---

  async searchLineItemsByName(courseCode) {
    const token = await this.getAccessToken();
    const allResults = [];
    let after = undefined;

    do {
      const response = await this.throttledRequest(() =>
        axios.post(
          `${this.baseUrl}/crm/v3/objects/line_items/search`,
          {
            filterGroups: [{
              filters: [{
                propertyName: 'name',
                operator: 'CONTAINS_TOKEN',
                value: courseCode,
              }],
            }],
            properties: ['name', 'quantity', 'price', 'hs_product_id', 'course_start_date', 'course_end_date'],
            limit: 100,
            ...(after && { after }),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        )
      );

      const results = response.data.results || [];
      allResults.push(...results);
      after = response.data.paging?.next?.after;
    } while (after);

    return allResults;
  }

  async getDealLineItems(dealId) {
    const token = await this.getAccessToken();
    try {
      const assocResponse = await this.throttledRequest(() =>
        axios.get(
          `${this.baseUrl}/crm/v3/objects/deals/${dealId}/associations/line_items`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        )
      );

      const assocResults = assocResponse.data.results || [];
      if (assocResults.length === 0) return [];

      const lineItemIds = assocResults.map(a => a.id);
      const response = await this.throttledRequest(() =>
        axios.post(
          `${this.baseUrl}/crm/v3/objects/line_items/batch/read`,
          {
            inputs: lineItemIds.map(id => ({ id })),
            properties: ['name', 'quantity', 'price', 'course_start_date', 'course_end_date'],
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        )
      );

      return response.data.results || [];
    } catch (error) {
      console.warn(`Failed to get line items for deal ${dealId}:`, error.message);
      return [];
    }
  }

  async buildRegistrationList(shiftCodes, shift, cacheKey = null) {
    // Check cache
    if (cacheKey) {
      const cached = this.registrationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.registrationCacheTTL) {
        return cached.data;
      }
    }

    console.log(`[Registration] Building list for ${shift}, codes:`, shiftCodes);

    // STEP 1: Search line items for each course code
    let allLineItems = [];
    for (const courseCode of shiftCodes) {
      const items = await this.searchLineItemsByName(courseCode);
      allLineItems.push(...items);
      console.log(`[Registration] Found ${items.length} line items for "${courseCode}"`);
    }

    if (allLineItems.length === 0) {
      const result = { rows: [], meta: { totalStudents: 0, shift, fetchedAt: new Date().toISOString() } };
      if (cacheKey) this.registrationCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    // STEP 2: Batch get deal associations for ALL line items (1 call per 100 items)
    const lineItemIds = allLineItems.map(li => li.id);
    const liToDealMap = await this.batchGetAssociations('line_items', 'deals', lineItemIds);
    console.log(`[Registration] Got deal associations for ${liToDealMap.size} line items`);

    // Build dealId → lineItems mapping
    const dealIdSet = new Set();
    const lineItemsByDeal = new Map();
    for (const li of allLineItems) {
      const dealIds = liToDealMap.get(li.id) || [];
      for (const dealId of dealIds) {
        dealIdSet.add(dealId);
        if (!lineItemsByDeal.has(dealId)) lineItemsByDeal.set(dealId, []);
        lineItemsByDeal.get(dealId).push(li);
      }
    }

    const dealIds = Array.from(dealIdSet);
    if (dealIds.length === 0) {
      const result = { rows: [], meta: { totalStudents: 0, shift, fetchedAt: new Date().toISOString() } };
      if (cacheKey) this.registrationCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }
    console.log(`[Registration] Found ${dealIds.length} unique deals`);

    // STEP 3: Batch read ALL deal details (1 call per 100 deals)
    const dealMap = await this.batchReadObjects('deals', dealIds,
      ['dealname', 'amount', 'dealstage', 'pipeline', 'createdate', 'closedate', 'remaining_amount']);
    console.log(`[Registration] Loaded ${dealMap.size} deal details`);

    // STEP 4: Batch get contact associations for ALL deals (1 call per 100 deals)
    const dealToContactMap = await this.batchGetAssociations('deals', 'contacts', dealIds);

    // Build contactId → [dealId, ...] mapping
    const contactDealMap = new Map();
    for (const [dealId, contactIds] of dealToContactMap.entries()) {
      for (const cid of contactIds) {
        if (!contactDealMap.has(cid)) contactDealMap.set(cid, []);
        contactDealMap.get(cid).push(dealId);
      }
    }

    const contactIds = Array.from(contactDealMap.keys());
    console.log(`[Registration] Found ${contactIds.length} unique contacts`);

    // STEP 5: Batch read ALL contact details (1 call per 100 contacts)
    const contactMap = await this.batchReadObjects('contacts', contactIds,
      ['firstname', 'lastname', 'email', 'student_id', 'phone']);

    // STEP 6: Get contact history for cycle count & program flags
    // Use batch: contact → deals associations, then deal → line_items
    const contactToAllDealsMap = await this.batchGetAssociations('contacts', 'deals', contactIds);

    // Collect ALL historical deal IDs across all contacts
    const allHistDealIds = new Set();
    for (const dealIds of contactToAllDealsMap.values()) {
      for (const d of dealIds) allHistDealIds.add(d);
    }

    // Batch read all historical deals (for dealname)
    const histDealMap = await this.batchReadObjects('deals', Array.from(allHistDealIds),
      ['dealname']);

    // Batch get line item associations for all historical deals
    const histDealToLIMap = await this.batchGetAssociations('deals', 'line_items', Array.from(allHistDealIds));

    // Collect ALL historical line item IDs
    const allHistLIIds = new Set();
    for (const liIds of histDealToLIMap.values()) {
      for (const id of liIds) allHistLIIds.add(id);
    }

    // Batch read all historical line items (for name)
    const histLIMap = await this.batchReadObjects('line_items', Array.from(allHistLIIds), ['name']);

    console.log(`[Registration] Loaded history: ${allHistDealIds.size} deals, ${allHistLIIds.size} line items`);

    // Now compute flags per contact from the pre-fetched data
    const contactHistories = new Map();
    for (const contactId of contactIds) {
      const histDealIds = contactToAllDealsMap.get(contactId) || [];
      let cycleCount = 0;
      let hasRoadmap = false;
      let hasAFK = false;
      let hasACJ = false;

      for (const dId of histDealIds) {
        const deal = histDealMap.get(dId);
        const dealName = (deal?.properties?.dealname || '').toUpperCase();
        let dealHasNDC = dealName.includes('NDC');
        if (dealName.includes('ROADMAP')) hasRoadmap = true;
        if (dealName.includes('AFK')) hasAFK = true;
        if (dealName.includes('ACJ')) hasACJ = true;

        // Check line items of this deal
        const liIds = histDealToLIMap.get(dId) || [];
        for (const liId of liIds) {
          const li = histLIMap.get(liId);
          const liName = (li?.properties?.name || '').toUpperCase();
          if (liName.includes('NDC')) dealHasNDC = true;
          if (liName.includes('ROADMAP')) hasRoadmap = true;
          if (liName.includes('AFK')) hasAFK = true;
          if (liName.includes('ACJ')) hasACJ = true;
        }

        if (dealHasNDC) cycleCount++;
      }

      contactHistories.set(contactId, { cycleCount, hasRoadmap, hasAFK, hasACJ });
    }

    // STEP 7: Assemble rows
    const rows = [];
    for (const [contactId, cDealIds] of contactDealMap.entries()) {
      const contact = contactMap.get(contactId);
      if (!contact) continue;

      const primaryDealId = cDealIds[0];
      const deal = dealMap.get(primaryDealId);
      if (!deal) continue;

      const matchingLineItems = lineItemsByDeal.get(primaryDealId) || [];
      const lineItem = matchingLineItems[0];

      const stageId = deal.properties.dealstage;
      const pipelineId = deal.properties.pipeline;
      let paymentStatus = stageId || 'Unknown';
      if (stageId && pipelineId) {
        try {
          paymentStatus = await this.getDealStageName(pipelineId, stageId);
        } catch {
          // use raw stageId
        }
      }

      // Skip excluded deal stages
      const statusLower = paymentStatus.toLowerCase();
      if (statusLower.includes('enrollment lost') || statusLower.includes('withdrawn enrollment')) continue;

      const history = contactHistories.get(contactId) || { cycleCount: 0, hasRoadmap: false, hasAFK: false, hasACJ: false };

      rows.push({
        seatNumber: 0,
        firstName: contact.properties.firstname || '',
        lastName: contact.properties.lastname || '',
        email: contact.properties.email || '',
        phone: contact.properties.phone || '',
        studentId: contact.properties.student_id || '',
        courseStartDate: lineItem?.properties?.course_start_date || null,
        courseEndDate: lineItem?.properties?.course_end_date || null,
        registrationDate: deal.properties.createdate || null,
        paymentStatus,
        outstanding: deal.properties.remaining_amount ? parseFloat(deal.properties.remaining_amount) : 0,
        cycleCount: history.cycleCount,
        hasRoadmap: history.hasRoadmap,
        hasAFK: history.hasAFK,
        hasACJ: history.hasACJ,
        contactId,
        dealId: primaryDealId,
      });
    }

    // STEP 8: Sort by registration date ASC, assign seat numbers
    rows.sort((a, b) => {
      const dateA = a.registrationDate ? new Date(a.registrationDate).getTime() : Infinity;
      const dateB = b.registrationDate ? new Date(b.registrationDate).getTime() : Infinity;
      return dateA - dateB;
    });
    rows.forEach((row, i) => { row.seatNumber = i + 1; });

    console.log(`[Registration] Done! ${rows.length} students`);

    const result = {
      rows,
      meta: {
        totalStudents: rows.length,
        shift,
        fetchedAt: new Date().toISOString(),
      },
    };

    if (cacheKey) {
      this.registrationCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return result;
  }

  clearRegistrationCache(cacheKey) {
    if (cacheKey) {
      this.registrationCache.delete(cacheKey);
    } else {
      this.registrationCache.clear();
    }
  }
}

module.exports = new HubSpotService();
