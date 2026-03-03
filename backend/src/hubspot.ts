import axios, { AxiosResponse } from 'axios';
import logger from './logger';
import config from './config';
import type {
  HubSpotContact,
  HubSpotDeal,
  HubSpotLineItem,
  HubSpotAssociation,
  HubSpotSearchResponse,
  HubSpotBatchReadResponse,
  HubSpotBatchAssociationResponse,
  NormalizedContact,
  RegistrationRow,
  RegistrationResult,
  CacheEntry,
  ContactHistory,
} from './types/hubspot';

class HubSpotService {
  apiKey: string;
  private baseUrl: string;
  private cache: Map<string, CacheEntry<string>>;
  private cacheTimeout: number;
  private registrationCache: Map<string, CacheEntry<RegistrationResult>>;
  private registrationCacheTTL: number;
  private _requestTimestamps: number[];
  private _rateLimit: number;
  private _rateWindow: number;

  constructor() {
    this.apiKey = config.hubspotApiKey;
    this.baseUrl = 'https://api.hubapi.com';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
    this.registrationCache = new Map();
    this.registrationCacheTTL = 60 * 1000;
    this._requestTimestamps = [];
    this._rateLimit = 90;
    this._rateWindow = 10000;

    if (!this.apiKey) {
      logger.warn('HUBSPOT_API_KEY not found — HubSpot integration disabled');
    }
  }

  async getAccessToken(): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        'Missing HUBSPOT_API_KEY. Please set it in your .env or deployment environment (Private App access token).',
      );
    }
    return this.apiKey;
  }

  async searchContacts(query: string, limit = 10): Promise<NormalizedContact[]> {
    try {
      const token = await this.getAccessToken();

      const trimmed = String(query).trim();
      const tokens = trimmed.split(/\s+/).filter(Boolean);

      const filterGroups: {
        filters: { propertyName: string; operator: string; value: string }[];
      }[] = [];

      filterGroups.push({
        filters: [{ propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: trimmed }],
      });
      filterGroups.push({
        filters: [{ propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: trimmed }],
      });
      filterGroups.push({
        filters: [{ propertyName: 'email', operator: 'CONTAINS_TOKEN', value: trimmed }],
      });
      if (/^\d+$/.test(trimmed)) {
        filterGroups.push({
          filters: [{ propertyName: 'student_id', operator: 'EQ', value: trimmed }],
        });
      }

      if (tokens.length >= 2) {
        const first = tokens[0]!;
        const last = tokens[tokens.length - 1]!;
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

      const response: AxiosResponse<HubSpotSearchResponse<HubSpotContact>> = await axios.post(
        `${this.baseUrl}/crm/v3/objects/contacts/search`,
        {
          properties: [
            'firstname',
            'lastname',
            'email',
            'qr_code_id',
            'student_id',
            'phone',
            'lifecyclestage',
          ],
          filterGroups,
          limit,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const contacts = response.data.results || [];

      const contactsWithDeals: NormalizedContact[] = await Promise.all(
        contacts.map(async (contact): Promise<NormalizedContact> => {
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
              fullName:
                `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
              lifeCycleStage: contact.properties.lifecyclestage || 'Unknown',
              paymentStatus,
              deals,
            };
          } catch (error) {
            logger.warn({ contactId: contact.id, err: error }, 'Failed to fetch deals for contact');
            return {
              id: contact.id,
              firstName: contact.properties.firstname || '',
              lastName: contact.properties.lastname || '',
              email: contact.properties.email || '',
              phone: contact.properties.phone || '',
              studentId: contact.properties.student_id || '',
              qrCodeId: contact.properties.qr_code_id || '',
              fullName:
                `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
              lifeCycleStage: contact.properties.lifecyclestage || 'Unknown',
              paymentStatus: 'Unknown',
              deals: [],
            };
          }
        }),
      );

      return contactsWithDeals;
    } catch (error) {
      const axiosErr = error as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      const status = axiosErr.response?.status;
      const message = axiosErr.response?.data?.message || axiosErr.message || 'Unknown error';

      if (status === 401) {
        logger.error({ status }, 'HubSpot auth error — invalid or expired token');
      } else if (status === 429) {
        logger.warn({ status }, 'HubSpot rate limit reached — retry after delay');
      } else {
        logger.error({ status, message }, 'HubSpot search error');
      }

      throw new Error(`Failed to search contacts in HubSpot: ${message}`);
    }
  }

  async getContactDeals(contactId: string): Promise<HubSpotDeal[]> {
    try {
      const token = await this.getAccessToken();

      let allDealIds: HubSpotAssociation[] = [];
      let after: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const response: AxiosResponse<HubSpotSearchResponse<HubSpotAssociation>> = await axios.get(
          `${this.baseUrl}/crm/v3/objects/contacts/${contactId}/associations/deals`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            params: {
              limit: 100,
              ...(after && { after }),
            },
          },
        );

        const results = response.data.results || [];
        allDealIds = [...allDealIds, ...results];

        after = response.data.paging?.next?.after;
        hasMore = !!after;
      }

      const deals: HubSpotDeal[] = (
        await Promise.all(
          allDealIds.map(async (dealAssoc): Promise<HubSpotDeal | null> => {
            try {
              const dealResponse: AxiosResponse<HubSpotDeal> = await axios.get(
                `${this.baseUrl}/crm/v3/objects/deals/${dealAssoc.id}?properties=dealname,amount,dealstage,closedate,pipeline`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                },
              );

              const deal = dealResponse.data;
              const stageId = deal.properties.dealstage;
              const pipelineId = deal.properties.pipeline;

              if (stageId && pipelineId) {
                try {
                  const stageName = await this.getDealStageName(pipelineId, stageId);
                  deal.stageName = stageName;
                } catch (error) {
                  logger.warn({ stageId, err: error }, 'Failed to fetch stage name');
                  deal.stageName = stageId;
                }
              }

              return deal;
            } catch (error) {
              logger.warn({ dealId: dealAssoc.id, err: error }, 'Failed to fetch deal');
              return null;
            }
          }),
        )
      ).filter((deal): deal is HubSpotDeal => deal !== null);

      return deals;
    } catch (error) {
      logger.warn({ contactId, err: error }, 'Failed to fetch deals for contact');
      return [];
    }
  }

  async getDealStageName(pipelineId: string, stageId: string): Promise<string> {
    try {
      const token = await this.getAccessToken();

      const cacheKey = `stage_${pipelineId}_${stageId}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const response: AxiosResponse<{ label?: string }> = await axios.get(
        `${this.baseUrl}/crm/v3/pipelines/deals/${pipelineId}/stages/${stageId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const stageName = response.data.label || stageId;

      this.cache.set(cacheKey, {
        data: stageName,
        timestamp: Date.now(),
      });

      return stageName;
    } catch (error) {
      logger.warn({ err: error }, 'Failed to fetch stage name');
      return stageId;
    }
  }

  getPaymentStatusFromDeals(deals: HubSpotDeal[]): string {
    if (!deals || deals.length === 0) {
      return 'No Deals';
    }

    const dealWithStage = deals.find((deal) => deal.stageName) || deals[0];

    if (!dealWithStage) {
      return 'Unknown';
    }

    return dealWithStage.stageName || dealWithStage.properties.dealstage || 'Unknown';
  }

  async getContactById(contactId: string): Promise<NormalizedContact> {
    try {
      const token = await this.getAccessToken();

      const response: AxiosResponse<HubSpotContact> = await axios.get(
        `${this.baseUrl}/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,qr_code_id,student_id,phone,lifecyclestage`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
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
        fullName:
          `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
        lifeCycleStage: contact.properties.lifecyclestage || 'Unknown',
        paymentStatus,
        deals,
      };
    } catch (error) {
      logger.error({ contactId, err: error }, 'Failed to get contact');
      throw new Error(`Failed to get contact from HubSpot: ${(error as Error).message}`);
    }
  }

  async updateContactPaymentStatus(
    contactId: string,
    paymentStatus: string,
  ): Promise<{ success: boolean; message: string }> {
    logger.info({ contactId, paymentStatus }, 'Payment status update tracked via deals');
    return { success: true, message: 'Payment status tracked via deals' };
  }

  // --- Rate limiter & batch utilities ---

  async throttledRequest<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    this._requestTimestamps = this._requestTimestamps.filter((t) => now - t < this._rateWindow);
    if (this._requestTimestamps.length >= this._rateLimit) {
      const oldest = this._requestTimestamps[0]!;
      const waitMs = this._rateWindow - (now - oldest) + 50;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this._requestTimestamps.push(Date.now());
    return fn();
  }

  async batchProcess<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 5): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map((item) => fn(item)));
      results.push(...batchResults);
    }
    return results;
  }

  // --- Batch Association Helpers (v4 API) ---

  async batchGetAssociations(
    fromType: string,
    toType: string,
    ids: string[],
  ): Promise<Map<string, string[]>> {
    const token = await this.getAccessToken();
    const resultMap = new Map<string, string[]>();
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      try {
        const response: AxiosResponse<HubSpotBatchAssociationResponse> =
          await this.throttledRequest(() =>
            axios.post(
              `${this.baseUrl}/crm/v4/associations/${fromType}/${toType}/batch/read`,
              { inputs: batch.map((id) => ({ id })) },
              { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
            ),
          );
        for (const result of response.data.results || []) {
          const fromId = String(result.from?.id);
          const toIds = (result.to || []).map((t) => String(t.toObjectId));
          if (fromId && toIds.length > 0) {
            resultMap.set(fromId, toIds);
          }
        }
      } catch (error) {
        logger.warn({ fromType, toType, err: error }, 'Batch association error');
      }
    }
    return resultMap;
  }

  async batchReadObjects<T extends { id: string }>(
    objectType: string,
    ids: string[],
    properties: string[],
  ): Promise<Map<string, T>> {
    const token = await this.getAccessToken();
    const resultMap = new Map<string, T>();
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      try {
        const response: AxiosResponse<HubSpotBatchReadResponse<T>> = await this.throttledRequest(
          () =>
            axios.post(
              `${this.baseUrl}/crm/v3/objects/${objectType}/batch/read`,
              { inputs: batch.map((id) => ({ id })), properties },
              { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
            ),
        );
        for (const obj of response.data.results || []) {
          resultMap.set(obj.id, obj);
        }
      } catch (error) {
        logger.warn({ objectType, err: error }, 'Batch read error');
      }
    }
    return resultMap;
  }

  // --- Registration List Methods ---

  async searchLineItemsByName(courseCode: string): Promise<HubSpotLineItem[]> {
    const token = await this.getAccessToken();
    const allResults: HubSpotLineItem[] = [];
    let after: string | undefined = undefined;

    do {
      const response: AxiosResponse<HubSpotSearchResponse<HubSpotLineItem>> =
        await this.throttledRequest(() =>
          axios.post(
            `${this.baseUrl}/crm/v3/objects/line_items/search`,
            {
              filterGroups: [
                {
                  filters: [
                    {
                      propertyName: 'name',
                      operator: 'CONTAINS_TOKEN',
                      value: courseCode,
                    },
                  ],
                },
              ],
              properties: [
                'name',
                'quantity',
                'price',
                'hs_product_id',
                'course_start_date',
                'course_end_date',
              ],
              limit: 100,
              ...(after && { after }),
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          ),
        );

      const results = response.data.results || [];
      allResults.push(...results);
      after = response.data.paging?.next?.after;
    } while (after);

    return allResults;
  }

  async getDealLineItems(dealId: string): Promise<HubSpotLineItem[]> {
    const token = await this.getAccessToken();
    try {
      const assocResponse: AxiosResponse<HubSpotSearchResponse<HubSpotAssociation>> =
        await this.throttledRequest(() =>
          axios.get(`${this.baseUrl}/crm/v3/objects/deals/${dealId}/associations/line_items`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }),
        );

      const assocResults = assocResponse.data.results || [];
      if (assocResults.length === 0) return [];

      const lineItemIds = assocResults.map((a) => a.id);
      const response: AxiosResponse<HubSpotBatchReadResponse<HubSpotLineItem>> =
        await this.throttledRequest(() =>
          axios.post(
            `${this.baseUrl}/crm/v3/objects/line_items/batch/read`,
            {
              inputs: lineItemIds.map((id) => ({ id })),
              properties: ['name', 'quantity', 'price', 'course_start_date', 'course_end_date'],
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          ),
        );

      return response.data.results || [];
    } catch (error) {
      logger.warn({ dealId, err: error }, 'Failed to get line items for deal');
      return [];
    }
  }

  async buildRegistrationList(
    shiftCodes: string[],
    shift: string,
    cacheKey: string | null = null,
  ): Promise<RegistrationResult> {
    if (cacheKey) {
      const cached = this.registrationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.registrationCacheTTL) {
        return cached.data;
      }
    }

    logger.info({ shift, shiftCodes }, '[Registration] Building list');

    // STEP 1: Search line items for each course code
    const allLineItems: HubSpotLineItem[] = [];
    for (const courseCode of shiftCodes) {
      const items = await this.searchLineItemsByName(courseCode);
      allLineItems.push(...items);
      logger.info({ courseCode, count: items.length }, '[Registration] Found line items');
    }

    if (allLineItems.length === 0) {
      const result: RegistrationResult = {
        rows: [],
        meta: { totalStudents: 0, shift, fetchedAt: new Date().toISOString() },
      };
      if (cacheKey) this.registrationCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    // STEP 2: Batch get deal associations for ALL line items
    const lineItemIds = allLineItems.map((li) => li.id);
    const liToDealMap = await this.batchGetAssociations('line_items', 'deals', lineItemIds);
    logger.info({ count: liToDealMap.size }, '[Registration] Got deal associations');

    // Build dealId → lineItems mapping
    const dealIdSet = new Set<string>();
    const lineItemsByDeal = new Map<string, HubSpotLineItem[]>();
    for (const li of allLineItems) {
      const dealIds = liToDealMap.get(li.id) || [];
      for (const dealId of dealIds) {
        dealIdSet.add(dealId);
        if (!lineItemsByDeal.has(dealId)) lineItemsByDeal.set(dealId, []);
        lineItemsByDeal.get(dealId)!.push(li);
      }
    }

    const dealIds = Array.from(dealIdSet);
    if (dealIds.length === 0) {
      const result: RegistrationResult = {
        rows: [],
        meta: { totalStudents: 0, shift, fetchedAt: new Date().toISOString() },
      };
      if (cacheKey) this.registrationCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }
    logger.info({ count: dealIds.length }, '[Registration] Found unique deals');

    // STEP 3: Batch read ALL deal details
    const dealMap = await this.batchReadObjects<HubSpotDeal>('deals', dealIds, [
      'dealname',
      'amount',
      'dealstage',
      'pipeline',
      'createdate',
      'closedate',
      'remaining_amount',
    ]);
    logger.info({ count: dealMap.size }, '[Registration] Loaded deal details');

    // STEP 4: Batch get contact associations for ALL deals
    const dealToContactMap = await this.batchGetAssociations('deals', 'contacts', dealIds);

    // Build contactId → [dealId, ...] mapping
    const contactDealMap = new Map<string, string[]>();
    for (const [dealId, contactIds] of dealToContactMap.entries()) {
      for (const cid of contactIds) {
        if (!contactDealMap.has(cid)) contactDealMap.set(cid, []);
        contactDealMap.get(cid)!.push(dealId);
      }
    }

    const contactIds = Array.from(contactDealMap.keys());
    logger.info({ count: contactIds.length }, '[Registration] Found unique contacts');

    // STEP 5: Batch read ALL contact details
    const contactMap = await this.batchReadObjects<HubSpotContact>('contacts', contactIds, [
      'firstname',
      'lastname',
      'email',
      'student_id',
      'phone',
      'ndecc_exam_date',
    ]);

    // STEP 6: Get contact history for cycle count & program flags
    const contactToAllDealsMap = await this.batchGetAssociations('contacts', 'deals', contactIds);

    const allHistDealIds = new Set<string>();
    for (const histDealIds of contactToAllDealsMap.values()) {
      for (const d of histDealIds) allHistDealIds.add(d);
    }

    const histDealMap = await this.batchReadObjects<HubSpotDeal>(
      'deals',
      Array.from(allHistDealIds),
      ['dealname'],
    );

    const histDealToLIMap = await this.batchGetAssociations(
      'deals',
      'line_items',
      Array.from(allHistDealIds),
    );

    const allHistLIIds = new Set<string>();
    for (const liIds of histDealToLIMap.values()) {
      for (const id of liIds) allHistLIIds.add(id);
    }

    const histLIMap = await this.batchReadObjects<HubSpotLineItem>(
      'line_items',
      Array.from(allHistLIIds),
      ['name'],
    );

    logger.info(
      { deals: allHistDealIds.size, lineItems: allHistLIIds.size },
      '[Registration] Loaded history',
    );

    // Compute flags per contact from pre-fetched data
    const contactHistories = new Map<string, ContactHistory>();
    const NDC_CLINICAL_RE = /NDC-[^-]+-Mis(\d+)-Clinical/i;

    for (const contactId of contactIds) {
      const histDealIdsForContact = contactToAllDealsMap.get(contactId) || [];
      const uniqueMisCycles = new Set<string>();
      let hasRoadmap = false;
      let hasAFK = false;
      let hasACJ = false;

      for (const dId of histDealIdsForContact) {
        const deal = histDealMap.get(dId);
        const dealName = (deal?.properties?.dealname || '').toUpperCase();
        if (dealName.includes('ROADMAP')) hasRoadmap = true;
        if (dealName.includes('AFK')) hasAFK = true;
        if (dealName.includes('ACJ')) hasACJ = true;

        const liIds = histDealToLIMap.get(dId) || [];
        const dealMisNumbers = new Set<string>();
        for (const liId of liIds) {
          const li = histLIMap.get(liId);
          const liName = li?.properties?.name || '';
          const match = liName.match(NDC_CLINICAL_RE);
          if (match?.[1]) dealMisNumbers.add(`${dId}-Mis${match[1]}`);
          if (liName.toUpperCase().includes('ROADMAP')) hasRoadmap = true;
          if (liName.toUpperCase().includes('AFK')) hasAFK = true;
          if (liName.toUpperCase().includes('ACJ')) hasACJ = true;
        }
        for (const key of dealMisNumbers) uniqueMisCycles.add(key);
      }

      contactHistories.set(contactId, {
        cycleCount: uniqueMisCycles.size,
        hasRoadmap,
        hasAFK,
        hasACJ,
      });
    }

    // STEP 7: Assemble rows
    const rows: RegistrationRow[] = [];
    for (const [contactId, cDealIds] of contactDealMap.entries()) {
      const contact = contactMap.get(contactId);
      if (!contact) continue;

      const primaryDealId = cDealIds[0];
      if (!primaryDealId) continue;
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

      const statusLower = paymentStatus.toLowerCase();
      if (
        statusLower.includes('enrol') &&
        (statusLower.includes('lost') || statusLower.includes('withdrawn'))
      )
        continue;

      const history = contactHistories.get(contactId) || {
        cycleCount: 0,
        hasRoadmap: false,
        hasAFK: false,
        hasACJ: false,
      };

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
        outstanding: deal.properties.remaining_amount
          ? parseFloat(deal.properties.remaining_amount)
          : 0,
        cycleCount: history.cycleCount,
        hasRoadmap: history.hasRoadmap,
        hasAFK: history.hasAFK,
        hasACJ: history.hasACJ,
        examDate: contact.properties.ndecc_exam_date || null,
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
    rows.forEach((row, i) => {
      row.seatNumber = i + 1;
    });

    logger.info({ count: rows.length }, '[Registration] Done');

    const result: RegistrationResult = {
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

  clearRegistrationCache(cacheKey?: string): void {
    if (cacheKey) {
      this.registrationCache.delete(cacheKey);
    } else {
      this.registrationCache.clear();
    }
  }
}

export = new HubSpotService();
