import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach admin JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('admin_access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
};

// ── Admin ─────────────────────────────────────────────
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getReports: (params?: { date_range?: string }) => api.get('/admin/reports', { params }),
  getPendingSubscriptions: () => api.get('/admin/pending-subscriptions'),
  getExpiringSoon: () => api.get('/admin/expiring-subscriptions'),
  getRecentShops: () => api.get('/admin/recent-shops'),

  // Shops
  getShops: (params?: { search?: string; status_filter?: string }) =>
    api.get('/admin/shops', { params }),
  toggleShopStatus: (shopId: number) =>
    api.put(`/admin/shops/${shopId}/status`),
  changeShopPlan: (shopId: number, plan_type: string, billing_type: string) =>
    api.put(`/admin/shops/${shopId}/plan`, { plan_type, billing_type }),
  deleteShop: (shopId: number) =>
    api.delete(`/admin/shops/${shopId}`),

  // Users
  getUsers: (params?: { search?: string }) =>
    api.get('/admin/users', { params }),
  toggleUserStatus: (userId: number) =>
    api.put(`/admin/users/${userId}/status`),

  // Subscriptions / Payments
  getSubscriptions: (params?: { status_filter?: string; plan_filter?: string }) =>
    api.get('/admin/subscriptions', { params }),
  getSubscriptionPayments: (params?: { shop_id?: number; source_filter?: string }) =>
    api.get('/admin/subscription-payments', { params }),
  approveSubscription: (subId: number) =>
    api.put(`/admin/subscriptions/${subId}/approve`),
  refundPayment: (paymentId: number) =>
    api.put(`/admin/subscription-payments/${paymentId}/refund`),
  rejectSubscription: (subId: number) =>
    api.put(`/admin/subscriptions/${subId}/reject`),
  updateSubscription: (subId: number, data: {
    plan_type: string; billing_type: string; status: string;
    amount_paid: number; currency: string; expires_at?: string | null;
  }) => api.patch(`/admin/subscriptions/${subId}`, data),

  // Leads
  getLeads: (params?: { search?: string; status_filter?: string }) =>
    api.get('/admin/leads', { params }),
  createLead: (data: any) => api.post('/admin/leads', data),
  updateLead: (leadId: number, data: any) => api.put(`/admin/leads/${leadId}`, data),
  deleteLead: (leadId: number) => api.delete(`/admin/leads/${leadId}`),

  // Shopping / dropshipping products
  getShoppingProducts: (params?: { search?: string }) =>
    api.get('/admin/shopping/products', { params }),
  createShoppingProduct: (data: any) => api.post('/admin/shopping/products', data),
  updateShoppingProduct: (id: number, data: any) => api.put(`/admin/shopping/products/${id}`, data),
  deleteShoppingProduct: (id: number) => api.delete(`/admin/shopping/products/${id}`),
  uploadShoppingImage: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/admin/shopping/upload-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  cjStatus: () => api.get('/admin/shopping/cj/status'),
  cjConnect: (apiKey: string) => api.post('/admin/shopping/cj/connect', { api_key: apiKey }),
  cjSearch: (q: string, page = 1) => api.get('/admin/shopping/cj/search', { params: { q, page } }),
  cjImport: (cjPid: string, price?: number, categoryName?: string) =>
    api.post('/admin/shopping/cj/import', { cj_pid: cjPid, price, category_name: categoryName }),
  metaAdsSearch: (q: string, country = 'US') =>
    api.get('/admin/shopping/meta-ads/search', { params: { q, country } }),

  // NexCode Codes
  getNexCodes: () => api.get('/admin/nexcodes'),
  createNexCode: (data: {
    client_email?: string;
    plan_type?: string;
    duration_months?: number | null;
    max_uses?: number;
    max_shops?: number;
    notes?: string;
    code_expires_days?: number | null;
  }) => api.post('/admin/nexcodes', data),
  toggleNexCode: (codeId: number) => api.put(`/admin/nexcodes/${codeId}/toggle`),
  deleteNexCode: (codeId: number) => api.delete(`/admin/nexcodes/${codeId}`),

  // Affiliates
  getAffiliates: (params?: { search?: string; status_filter?: string }) =>
    api.get('/admin/affiliates', { params }),
  getAffiliate: (affiliateId: number) =>
    api.get(`/admin/affiliates/${affiliateId}`),
  toggleAffiliateStatus: (affiliateId: number) =>
    api.put(`/admin/affiliates/${affiliateId}/status`),
  updateCommissionRate: (affiliateId: number, rate: number) =>
    api.put(`/admin/affiliates/${affiliateId}/commission-rate`, null, { params: { rate } }),
  approveCommission: (commissionId: number) =>
    api.put(`/admin/commissions/${commissionId}/approve`),
  payCommission: (commissionId: number) =>
    api.put(`/admin/commissions/${commissionId}/pay`),
  getPayoutRequests: (status?: string) =>
    api.get('/admin/payout-requests', { params: status ? { status_filter: status } : {} }),
  payPayoutRequest: (requestId: number) =>
    api.put(`/admin/payout-requests/${requestId}/pay`),
  rejectPayoutRequest: (requestId: number, notes?: string) =>
    api.put(`/admin/payout-requests/${requestId}/reject`, null, { params: notes ? { notes } : {} }),

  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data: Record<string, any>) => api.put('/admin/settings', data),
};
