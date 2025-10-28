// api/backend/hubspot.js
const axios = require('axios');
require('dotenv').config();

class HubSpotService {
  constructor() {
    this.apiKey = process.env.HUBSPOT_API_KEY; // Private App access token
    this.baseUrl = 'https://api.hubapi.com';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

    if (!this.apiKey) {
      console.warn(
        '⚠️  HUBSPOT_API_KEY not found. HubSpot integration will be disabled until a valid token is provided.'
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

      // Normalize query and split into tokens for better matching
      const trimmed = String(query).trim();
      const tokens = trimmed.split(/\s+/).filter(Boolean);

      // Build OR filter groups for the supported fields
      const filterGroups = [];

      // Basic single-field contains searches
      filterGroups.push({ filters: [{ propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: trimmed }] });
      filterGroups.push({ filters: [{ propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: trimmed }] });
      filterGroups.push({ filters: [{ propertyName: 'email', operator: 'CONTAINS_TOKEN', value: trimmed }] });
      // Student ID: only add when the query is a pure number (HubSpot numeric properties do not support CONTAINS_TOKEN)
      if (/^\d+$/.test(trimmed)) {
        filterGroups.push({ filters: [{ propertyName: 'student_id', operator: 'EQ', value: trimmed }] });
      }

      // If there are multiple tokens (e.g., "Sandra Awada"), add AND combinations
      if (tokens.length >= 2) {
        const first = tokens[0];
        const last = tokens[tokens.length - 1];
        // firstname: first AND lastname: last
        filterGroups.push({
          filters: [
            { propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: first },
            { propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: last },
          ],
        });
        // firstname: last AND lastname: first (handle reversed order)
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
      
      // Fetch deal associations for each contact to get payment status
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
        console.error('❌ HubSpot auth error — invalid or expired token.');
      } else if (status === 429) {
        console.warn('⚠️ HubSpot rate limit reached — retry after delay.');
      } else {
        console.error('HubSpot search error:', message);
      }

      throw new Error(`Failed to search contacts in HubSpot: ${message}`);
    }
  }

  async getContactDeals(contactId) {
    try {
      const token = await this.getAccessToken();
      
      // Fetch all deals with pagination support
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
        
        // Check if there are more pages
        after = response.data.paging?.next?.after;
        hasMore = !!after;
      }

      const dealIds = allDealIds;
      
      console.log(`📊 Fetching ${dealIds.length} deals for contact ${contactId}`);
      
      // Fetch deal details for each associated deal
      const deals = await Promise.all(
        dealIds.map(async (dealAssoc) => {
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
            
            // Fetch the stage name
            const deal = dealResponse.data;
            const stageId = deal.properties.dealstage;
            const pipelineId = deal.properties.pipeline;
            
            if (stageId && pipelineId) {
              try {
                const stageName = await this.getDealStageName(pipelineId, stageId);
                deal.stageName = stageName;
              } catch (error) {
                console.warn(`Failed to fetch stage name for ${stageId}:`, error.message);
                deal.stageName = stageId; // Fallback to stage ID
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
      
      // Check cache first
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
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: stageName,
        timestamp: Date.now()
      });
      
      return stageName;
    } catch (error) {
      console.warn(`Failed to fetch stage name:`, error.message);
      return stageId; // Fallback to stage ID
    }
  }

  getPaymentStatusFromDeals(deals) {
    if (!deals || deals.length === 0) {
      return 'No Deals';
    }

    // Find the most recent deal with a stage name
    const dealWithStage = deals.find(deal => deal.stageName) || deals[0];
    
    if (!dealWithStage) {
      return 'Unknown';
    }

    // Use the stage name if available, otherwise use the stage ID
    const stageName = dealWithStage.stageName || dealWithStage.properties.dealstage || 'Unknown';
    
    return stageName;
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
    // Since payment status comes from deals, we don't update it directly on the contact
    // Instead, we could update the deal stage or create a note
    console.log(`Payment status update for contact ${contactId}: ${paymentStatus}`);
    // This is a placeholder - you might want to update the deal stage instead
    return { success: true, message: 'Payment status tracked via deals' };
  }
}

module.exports = new HubSpotService();
