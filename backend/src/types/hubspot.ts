// --- HubSpot API Response Types ---

export interface HubSpotContactProperties {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  student_id?: string;
  qr_code_id?: string;
  lifecyclestage?: string;
  ndecc_exam_date?: string;
}

export interface HubSpotContact {
  id: string;
  properties: HubSpotContactProperties;
}

export interface HubSpotDealProperties {
  dealname?: string;
  amount?: string;
  dealstage?: string;
  pipeline?: string;
  createdate?: string;
  closedate?: string;
  remaining_amount?: string;
}

export interface HubSpotDeal {
  id: string;
  properties: HubSpotDealProperties;
  stageName?: string;
}

export interface HubSpotLineItemProperties {
  name?: string;
  quantity?: string;
  price?: string;
  hs_product_id?: string;
  course_start_date?: string;
  course_end_date?: string;
}

export interface HubSpotLineItem {
  id: string;
  properties: HubSpotLineItemProperties;
}

export interface HubSpotAssociation {
  id: string;
  type?: string;
}

export interface HubSpotPagingNext {
  after?: string;
}

export interface HubSpotPaging {
  next?: HubSpotPagingNext;
}

export interface HubSpotSearchResponse<T> {
  results: T[];
  paging?: HubSpotPaging;
}

export interface HubSpotBatchReadResponse<T> {
  results: T[];
}

export interface HubSpotAssociationResult {
  from?: { id: string };
  to?: { toObjectId: string }[];
}

export interface HubSpotBatchAssociationResponse {
  results: HubSpotAssociationResult[];
}

// --- Normalized Types (returned to our services) ---

export interface NormalizedContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  studentId: string;
  qrCodeId: string;
  fullName: string;
  lifeCycleStage: string;
  paymentStatus: string;
  deals: HubSpotDeal[];
}

export interface RegistrationRow {
  seatNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  studentId: string;
  courseStartDate: string | null;
  courseEndDate: string | null;
  registrationDate: string | null;
  paymentStatus: string;
  outstanding: number;
  cycleCount: number;
  hasRoadmap: boolean;
  hasAFK: boolean;
  hasACJ: boolean;
  examDate: string | null;
  contactId: string;
  dealId: string;
}

export interface RegistrationResult {
  rows: RegistrationRow[];
  meta: {
    totalStudents: number;
    shift: string;
    fetchedAt: string;
    noCodes?: boolean;
  };
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface ContactHistory {
  cycleCount: number;
  hasRoadmap: boolean;
  hasAFK: boolean;
  hasACJ: boolean;
}
