/**
 * Provisional contract for the ERP activities response.
 * Confirm field names, ID formats, status values, pagination, and weekday
 * numbering with the ERP API specification before connecting to production.
 */
export type ErpActivityStatus = 'ACTIVE' | 'INACTIVE';

/** Provisional query shape; confirm supported filters and names with the ERP. */
export interface GetActivitiesParams {
  page?: number;
  pageSize?: number;
  filters?: Record<string, string | number | boolean>;
}

export interface ErpActivitySchedule {
  /** Provisional string ID; the ERP's actual ID format is not yet known. */
  id: string;
  /** Weekday numbering convention must be confirmed with the ERP. */
  dayOfWeek: number;
  /** Provisional 24-hour HH:mm representation from the design example. */
  startTime: string;
  endTime: string;
  location?: string;
}

export interface ErpActivity {
  /** Provisional string ID; the ERP's actual ID format is not yet known. */
  id: string;
  name: string;
  instituteId: string;
  instituteName?: string;
  status: ErpActivityStatus;
  schedules: ErpActivitySchedule[];
}

export interface ErpActivitiesResponse {
  data: ErpActivity[];
  /** Pagination fields and names are a proposal until confirmed by the ERP. */
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
