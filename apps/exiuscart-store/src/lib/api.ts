import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; full_name: string; phone?: string }) =>
    api.post('/auth/register', data),
  setupPassword: (token: string, password: string) =>
    api.post('/auth/setup-password', { token, password }),
};

// ── Shop ──────────────────────────────────────────────
export const shopApi = {
  getMyShop: () => api.get('/shops/me'),
  updateShop: (data: any) => api.put('/shops/me', data),
  getAllBranches: () => api.get('/shops/'),
  createBranch: (data: any) => api.post('/shops/', data),
  updateBranch: (shopId: number, data: any) => api.put(`/shops/${shopId}`, data),
  deleteBranch: (shopId: number) => api.delete(`/shops/${shopId}`),
};

// ── Dashboard ─────────────────────────────────────────
export const dashboardApi = {
  getStats: (shopId: string) => api.get(`/shops/${shopId}/stats`),
};

// ── Products ──────────────────────────────────────────
export const productsApi = {
  getAll: (shopId: string, params?: { search?: string; category?: string }) =>
    api.get(`/shops/${shopId}/products`, { params }),
  create: (shopId: string, data: any) =>
    api.post(`/shops/${shopId}/products`, data),
  update: (shopId: string, productId: string, data: any) =>
    api.put(`/shops/${shopId}/products/${productId}`, data),
  delete: (shopId: string, productId: string) =>
    api.delete(`/shops/${shopId}/products/${productId}`),
  getCategories: (shopId: string) =>
    api.get(`/shops/${shopId}/products/categories`),
  bulkImport: (shopId: string, rows: any[]) =>
    api.post(`/shops/${shopId}/products/bulk-import`, rows),
};

// ── Orders ────────────────────────────────────────────
export const ordersApi = {
  getAll: (shopId: string, params?: { status?: string; search?: string }) =>
    api.get(`/shops/${shopId}/orders`, { params }),
  getOne: (shopId: string, orderId: string) =>
    api.get(`/shops/${shopId}/orders/${orderId}`),
  create: (shopId: string, data: any) =>
    api.post(`/shops/${shopId}/orders`, data),
  updateStatus: (shopId: string, orderId: string, status: string) =>
    api.patch(`/shops/${shopId}/orders/${orderId}/status`, { status }),
  ship: (shopId: string, orderId: string, data: {
    tracking_number: string;
    carrier?: string;
    estimated_delivery?: string;
  }) => api.post(`/shops/${shopId}/orders/${orderId}/ship`, data),
  getTracking: (shopId: string, orderId: string) =>
    api.get(`/shops/${shopId}/orders/${orderId}/tracking`),
  getDetails: (shopId: string, orderId: string) =>
    api.get(`/shops/${shopId}/orders/${orderId}/details`),
  sendInvoice: (shopId: string, orderId: string, customerEmail?: string) =>
    api.post(`/shops/${shopId}/orders/${orderId}/send-invoice`, { customer_email: customerEmail || null }),
};

// ── Customers ─────────────────────────────────────────
export const customersApi = {
  getAll: (shopId: string, params?: { search?: string }) =>
    api.get(`/shops/${shopId}/customers`, { params }),
  create: (shopId: string, data: any) =>
    api.post(`/shops/${shopId}/customers`, data),
  update: (shopId: string, customerId: string, data: any) =>
    api.put(`/shops/${shopId}/customers/${customerId}`, data),
  delete: (shopId: string, customerId: string) =>
    api.delete(`/shops/${shopId}/customers/${customerId}`),
};

// ── Inventory ─────────────────────────────────────────
export const inventoryApi = {
  getLowStock: (shopId: string) =>
    api.get(`/shops/${shopId}/inventory/low-stock`),
  adjustStock: (shopId: string, productId: string, quantity: number, reason: string) =>
    api.post(`/shops/${shopId}/inventory/adjust`, { product_id: productId, quantity, reason }),
};

// ── Reports ───────────────────────────────────────────
export const reportsApi = {
  getSalesReport: (shopId: string, params: { from: string; to: string }) =>
    api.get(`/shops/${shopId}/reports/sales`, { params }),
  getTopProducts: (shopId: string) =>
    api.get(`/shops/${shopId}/reports/top-products`),
  getVatReport: (shopId: string, params: { year?: number; quarter?: number; vat_rate?: number; prices_include_vat?: boolean }) =>
    api.get(`/shops/${shopId}/reports/vat`, { params }),
};

// ── Webhooks ──────────────────────────────────────────
export const webhooksApi = {
  getAll: (shopId: string) => api.get(`/shops/${shopId}/webhooks`),
  create: (shopId: string, data: { url: string; secret?: string; events: string[] }) =>
    api.post(`/shops/${shopId}/webhooks`, data),
  update: (shopId: string, webhookId: number, data: any) =>
    api.put(`/shops/${shopId}/webhooks/${webhookId}`, data),
  delete: (shopId: string, webhookId: number) =>
    api.delete(`/shops/${shopId}/webhooks/${webhookId}`),
  test: (shopId: string, webhookId: number) =>
    api.post(`/shops/${shopId}/webhooks/${webhookId}/test`),
  getLogs: (shopId: string, webhookId: number) =>
    api.get(`/shops/${shopId}/webhooks/${webhookId}/logs`),
};

// ── Suppliers ─────────────────────────────────────────
export const suppliersApi = {
  getAll: (shopId: string, params?: { search?: string }) =>
    api.get(`/shops/${shopId}/suppliers`, { params }),
  create: (shopId: string, data: any) => api.post(`/shops/${shopId}/suppliers`, data),
  update: (shopId: string, supplierId: number, data: any) =>
    api.put(`/shops/${shopId}/suppliers/${supplierId}`, data),
  delete: (shopId: string, supplierId: number) =>
    api.delete(`/shops/${shopId}/suppliers/${supplierId}`),
};

// ── Purchases ─────────────────────────────────────────
export const purchasesApi = {
  getAll: (shopId: string) => api.get(`/shops/${shopId}/purchases`),
  create: (shopId: string, data: any) => api.post(`/shops/${shopId}/purchases`, data),
  receive: (shopId: string, poId: number, receivedQtys: Record<string, number>) =>
    api.put(`/shops/${shopId}/purchases/${poId}/receive`, { received_qtys: receivedQtys }),
};

// ── Expenses ──────────────────────────────────────────
export const expensesApi = {
  getAll: (shopId: string) => api.get(`/shops/${shopId}/expenses`),
  create: (shopId: string, data: any) => api.post(`/shops/${shopId}/expenses`, data),
  delete: (shopId: string, expenseId: string) =>
    api.delete(`/shops/${shopId}/expenses/${expenseId}`),
};

// ── Quotations ────────────────────────────────────────
export const quotationsApi = {
  getAll: (shopId: string) => api.get(`/shops/${shopId}/quotations`),
  create: (shopId: string, data: any) => api.post(`/shops/${shopId}/quotations`, data),
};

// ── Staff ─────────────────────────────────────────────
export const staffApi = {
  getAll: (shopId: string) => api.get(`/shops/${shopId}/staff`),
  invite: (shopId: string, data: { email: string; role: string }) =>
    api.post(`/shops/${shopId}/staff/invite`, data),
  remove: (shopId: string, staffId: string) =>
    api.delete(`/shops/${shopId}/staff/${staffId}`),
};

// ── Subscription ──────────────────────────────────────
export const subscriptionApi = {
  getCurrent: (shopId: string) => api.get(`/shops/${shopId}/subscription`),
  requestUpgrade: (shopId: string, plan: string) =>
    api.post(`/shops/${shopId}/subscription/upgrade`, { plan }),
};

// ── Shop Fields (Custom Product Fields) ───────────────
export const fieldsApi = {
  getAll: (shopId: string) =>
    api.get(`/shops/${shopId}/fields`),
  create: (shopId: string, data: {
    label: string; field_key: string; field_type: string;
    options?: string[]; is_required?: boolean; sort_order?: number;
  }) => api.post(`/shops/${shopId}/fields`, data),
  update: (shopId: string, fieldId: string, data: any) =>
    api.put(`/shops/${shopId}/fields/${fieldId}`, data),
  delete: (shopId: string, fieldId: string) =>
    api.delete(`/shops/${shopId}/fields/${fieldId}`),
  reorder: (shopId: string, ids: number[]) =>
    api.put(`/shops/${shopId}/fields/reorder`, ids),
};

// ── HR & Payroll ──────────────────────────────────────
export const hrApi = {
  // Employees
  getEmployees: (shopId: string) => api.get(`/shops/${shopId}/employees`),
  createEmployee: (shopId: string, data: any) => api.post(`/shops/${shopId}/employees`, data),
  updateEmployee: (shopId: string, empId: number, data: any) =>
    api.put(`/shops/${shopId}/employees/${empId}`, data),
  deleteEmployee: (shopId: string, empId: number) =>
    api.delete(`/shops/${shopId}/employees/${empId}`),
  // Payroll
  getPayroll: (shopId: string, month?: string) =>
    api.get(`/shops/${shopId}/payroll`, { params: month ? { month } : {} }),
  runPayroll: (shopId: string, data: { month: string; deductions?: Record<string, number>; bonuses?: Record<string, number> }) =>
    api.post(`/shops/${shopId}/payroll/run`, data),
  markPaid: (shopId: string, recordId: number) =>
    api.put(`/shops/${shopId}/payroll/${recordId}/pay`, {}),
  // Leave
  getLeaves: (shopId: string) => api.get(`/shops/${shopId}/leaves`),
  createLeave: (shopId: string, data: any) => api.post(`/shops/${shopId}/leaves`, data),
  updateLeaveStatus: (shopId: string, leaveId: number, status: string) =>
    api.put(`/shops/${shopId}/leaves/${leaveId}/status`, { status }),
};

// ── Marketing ─────────────────────────────────────────
export const marketingApi = {
  // Email Campaigns
  getEmailCampaigns: (shopId: string) => api.get(`/shops/${shopId}/marketing/email`),
  createEmailCampaign: (shopId: string, data: any) => api.post(`/shops/${shopId}/marketing/email`, data),
  updateEmailCampaign: (shopId: string, cid: number, data: any) => api.put(`/shops/${shopId}/marketing/email/${cid}`, data),
  deleteEmailCampaign: (shopId: string, cid: number) => api.delete(`/shops/${shopId}/marketing/email/${cid}`),
  // SMS Campaigns
  getSmsCampaigns: (shopId: string) => api.get(`/shops/${shopId}/marketing/sms`),
  createSmsCampaign: (shopId: string, data: any) => api.post(`/shops/${shopId}/marketing/sms`, data),
  updateSmsCampaign: (shopId: string, cid: number, data: any) => api.put(`/shops/${shopId}/marketing/sms/${cid}`, data),
  deleteSmsCampaign: (shopId: string, cid: number) => api.delete(`/shops/${shopId}/marketing/sms/${cid}`),
  // Events
  getEvents: (shopId: string) => api.get(`/shops/${shopId}/events`),
  createEvent: (shopId: string, data: any) => api.post(`/shops/${shopId}/events`, data),
  updateEvent: (shopId: string, eid: number, data: any) => api.put(`/shops/${shopId}/events/${eid}`, data),
  deleteEvent: (shopId: string, eid: number) => api.delete(`/shops/${shopId}/events/${eid}`),
  // Surveys
  getSurveys: (shopId: string) => api.get(`/shops/${shopId}/surveys`),
  createSurvey: (shopId: string, data: any) => api.post(`/shops/${shopId}/surveys`, data),
  updateSurveyStatus: (shopId: string, sid: number, status: string) =>
    api.put(`/shops/${shopId}/surveys/${sid}/status`, { status }),
  deleteSurvey: (shopId: string, sid: number) => api.delete(`/shops/${shopId}/surveys/${sid}`),
};

// ── Recruitment ───────────────────────────────────────
export const recruitmentApi = {
  getJobs: (shopId: string) => api.get(`/shops/${shopId}/recruitment/jobs`),
  createJob: (shopId: string, data: any) => api.post(`/shops/${shopId}/recruitment/jobs`, data),
  updateJob: (shopId: string, jid: number, data: any) => api.put(`/shops/${shopId}/recruitment/jobs/${jid}`, data),
  deleteJob: (shopId: string, jid: number) => api.delete(`/shops/${shopId}/recruitment/jobs/${jid}`),
  getApplicants: (shopId: string, stage?: string) =>
    api.get(`/shops/${shopId}/recruitment/applicants`, { params: stage ? { stage } : {} }),
  createApplicant: (shopId: string, data: any) => api.post(`/shops/${shopId}/recruitment/applicants`, data),
  moveStage: (shopId: string, aid: number, stage: string, notes?: string) =>
    api.put(`/shops/${shopId}/recruitment/applicants/${aid}/stage`, { stage, notes }),
  deleteApplicant: (shopId: string, aid: number) =>
    api.delete(`/shops/${shopId}/recruitment/applicants/${aid}`),
};

// ── Attendance ────────────────────────────────────────
export const attendanceApi = {
  getAll: (shopId: string, month?: string) =>
    api.get(`/shops/${shopId}/attendance`, { params: month ? { month } : {} }),
  create: (shopId: string, data: any) => api.post(`/shops/${shopId}/attendance`, data),
  update: (shopId: string, rid: number, data: any) => api.put(`/shops/${shopId}/attendance/${rid}`, data),
  delete: (shopId: string, rid: number) => api.delete(`/shops/${shopId}/attendance/${rid}`),
};

// ── Fleet ─────────────────────────────────────────────
export const fleetApi = {
  getVehicles: (shopId: string) => api.get(`/shops/${shopId}/fleet`),
  createVehicle: (shopId: string, data: any) => api.post(`/shops/${shopId}/fleet`, data),
  updateVehicle: (shopId: string, vid: number, data: any) => api.put(`/shops/${shopId}/fleet/${vid}`, data),
  deleteVehicle: (shopId: string, vid: number) => api.delete(`/shops/${shopId}/fleet/${vid}`),
  getServices: (shopId: string, vid: number) => api.get(`/shops/${shopId}/fleet/${vid}/services`),
  addService: (shopId: string, vid: number, data: any) => api.post(`/shops/${shopId}/fleet/${vid}/services`, data),
};

// ── Projects & Services ───────────────────────────────
export const projectsApi = {
  getProjects: (shopId: string) => api.get(`/shops/${shopId}/projects`),
  createProject: (shopId: string, data: any) => api.post(`/shops/${shopId}/projects`, data),
  updateProject: (shopId: string, pid: number, data: any) => api.put(`/shops/${shopId}/projects/${pid}`, data),
  deleteProject: (shopId: string, pid: number) => api.delete(`/shops/${shopId}/projects/${pid}`),
  getTasks: (shopId: string, pid: number) => api.get(`/shops/${shopId}/projects/${pid}/tasks`),
  createTask: (shopId: string, pid: number, data: any) => api.post(`/shops/${shopId}/projects/${pid}/tasks`, data),
  updateTask: (shopId: string, tid: number, data: any) => api.put(`/shops/${shopId}/tasks/${tid}`, data),
  deleteTask: (shopId: string, tid: number) => api.delete(`/shops/${shopId}/tasks/${tid}`),
};

export const helpdeskApi = {
  getTickets: (shopId: string, status?: string) =>
    api.get(`/shops/${shopId}/helpdesk`, { params: status ? { status } : {} }),
  createTicket: (shopId: string, data: any) => api.post(`/shops/${shopId}/helpdesk`, data),
  updateTicket: (shopId: string, tid: number, data: any) => api.put(`/shops/${shopId}/helpdesk/${tid}`, data),
  deleteTicket: (shopId: string, tid: number) => api.delete(`/shops/${shopId}/helpdesk/${tid}`),
};

export const appointmentsApi = {
  getAll: (shopId: string) => api.get(`/shops/${shopId}/appointments`),
  create: (shopId: string, data: any) => api.post(`/shops/${shopId}/appointments`, data),
  update: (shopId: string, aid: number, data: any) => api.put(`/shops/${shopId}/appointments/${aid}`, data),
  delete: (shopId: string, aid: number) => api.delete(`/shops/${shopId}/appointments/${aid}`),
};

// ── Shopify Integration ───────────────────────────────
export const shopifyApi = {
  getStatus: (shopId: string) => api.get(`/shops/${shopId}/shopify/status`),
  connect: (shopId: string, data: { shopify_domain: string; access_token: string }) =>
    api.post(`/shops/${shopId}/shopify/connect`, data),
  disconnect: (shopId: string) => api.delete(`/shops/${shopId}/shopify/disconnect`),
  updateSettings: (shopId: string, data: { sync_products?: boolean; sync_orders?: boolean; sync_inventory?: boolean }) =>
    api.put(`/shops/${shopId}/shopify/settings`, data),
  syncProducts: (shopId: string) => api.post(`/shops/${shopId}/shopify/sync/products`),
  syncOrders: (shopId: string) => api.post(`/shops/${shopId}/shopify/sync/orders`),
  syncInventory: (shopId: string) => api.post(`/shops/${shopId}/shopify/sync/inventory`),
  getLogs: (shopId: string) => api.get(`/shops/${shopId}/shopify/logs`),
};

// ── AI SEO Tools ──────────────────────────────────────
export const aiSeoApi = {
  generateDescription: (shopId: string, data: {
    product_name: string; category?: string; key_features?: string;
    target_audience?: string; tone?: string; language?: string;
  }) => api.post(`/shops/${shopId}/ai/product-description`, data),
  generateMetaTags: (shopId: string, data: {
    page_title: string; page_type?: string; content_summary?: string; business_name?: string;
  }) => api.post(`/shops/${shopId}/ai/meta-tags`, data),
  generateKeywords: (shopId: string, data: {
    topic: string; industry?: string; target_region?: string;
  }) => api.post(`/shops/${shopId}/ai/keywords`, data),
  generateBlogPost: (shopId: string, data: {
    topic: string; target_keyword?: string; word_count?: number; business_name?: string;
  }) => api.post(`/shops/${shopId}/ai/blog-post`, data),
  seoAudit: (shopId: string) => api.get(`/shops/${shopId}/ai/seo-audit`),
  optimizeTitles: (shopId: string, titles: { id: number; title: string }[]) =>
    api.post(`/shops/${shopId}/ai/optimize-titles`, { titles }),
};

// ── Product Attributes (values per product) ────────────
export const attributesApi = {
  get: (shopId: string, productId: string) =>
    api.get(`/shops/${shopId}/products/${productId}/attributes`),
  save: (shopId: string, productId: string, attrs: { field_key: string; value: string }[]) =>
    api.put(`/shops/${shopId}/products/${productId}/attributes`, attrs),
};

// ── Product Images (max 6) ─────────────────────────────
export const imagesApi = {
  getAll: (shopId: string, productId: string) =>
    api.get(`/shops/${shopId}/products/${productId}/images`),
  upload: (shopId: string, productId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/shops/${shopId}/products/${productId}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (shopId: string, productId: string, imageId: string) =>
    api.delete(`/shops/${shopId}/products/${productId}/images/${imageId}`),
  setPrimary: (shopId: string, productId: string, imageId: string) =>
    api.put(`/shops/${shopId}/products/${productId}/images/${imageId}/primary`, {}),
};

// ── Product Variants ───────────────────────────────────
export const variantsApi = {
  getAll: (shopId: string, productId: string) =>
    api.get(`/shops/${shopId}/products/${productId}/variants`),
  save: (shopId: string, productId: string, variants: {
    size?: string; color?: string; sku?: string; quantity: number; price?: number;
  }[]) => api.put(`/shops/${shopId}/products/${productId}/variants`, variants),
};

// ── Channel Integrations ───────────────────────────────
export const channelsApi = {
  getConnections: (shopId: string) =>
    api.get(`/shops/${shopId}/channels`),
  connect: (shopId: string, data: {
    channel_type: string;
    channel_api_key: string;
    channel_api_url?: string;
    channel_seller_id?: string;
  }) => api.post(`/shops/${shopId}/channels`, data),
  syncCategories: (shopId: string, channelId: number) =>
    api.post(`/shops/${shopId}/channels/${channelId}/sync-categories`),
  getCategories: (shopId: string, channelId: number) =>
    api.get(`/shops/${shopId}/channels/${channelId}/categories`),
  setProductCategory: (shopId: string, productId: string, data: {
    channel_connection_id: number;
    channel_category_id: string;
    channel_category_name: string;
  }) => api.put(`/shops/${shopId}/products/${productId}/channel-category`, data),
  getAllChannelStatuses: (shopId: string) =>
    api.get(`/shops/${shopId}/channel-statuses`),
  getProductChannelStatus: (shopId: string, productId: string) =>
    api.get(`/shops/${shopId}/products/${productId}/channel-status`),
  getProductChannelCategories: (shopId: string, productId: string) =>
    api.get(`/shops/${shopId}/products/${productId}/channel-category`),
  getTheDersiInfo: (shopId: string, channelId: number) =>
    api.get(`/shops/${shopId}/channels/${channelId}/thedersi-info`),
  getTheDersiPayouts: (shopId: string, channelId: number) =>
    api.get(`/shops/${shopId}/channels/${channelId}/thedersi-payouts`),
  requestTheDersiPayout: (shopId: string, channelId: number) =>
    api.post(`/shops/${shopId}/channels/${channelId}/thedersi-request-payout`),
};
