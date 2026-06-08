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

  // Users
  getUsers: (params?: { search?: string }) =>
    api.get('/admin/users', { params }),
  toggleUserStatus: (userId: number) =>
    api.put(`/admin/users/${userId}/status`),

  // Subscriptions / Payments
  getSubscriptions: (params?: { status_filter?: string; plan_filter?: string }) =>
    api.get('/admin/subscriptions', { params }),
  approveSubscription: (subId: number) =>
    api.put(`/admin/subscriptions/${subId}/approve`),
  rejectSubscription: (subId: number) =>
    api.put(`/admin/subscriptions/${subId}/reject`),

  // Leads
  getLeads: (params?: { search?: string; status_filter?: string }) =>
    api.get('/admin/leads', { params }),
  createLead: (data: any) => api.post('/admin/leads', data),
  updateLead: (leadId: number, data: any) => api.put(`/admin/leads/${leadId}`, data),
  deleteLead: (leadId: number) => api.delete(`/admin/leads/${leadId}`),

  // Shopping products
  getShoppingProducts: (params?: { search?: string; shop_id?: number }) =>
    api.get('/admin/shopping/products', { params }),
  createShoppingProduct: (data: any) => api.post('/admin/shopping/products', data),
  updateShoppingProduct: (id: number, data: any) => api.put(`/admin/shopping/products/${id}`, data),
  deleteShoppingProduct: (id: number) => api.delete(`/admin/shopping/products/${id}`),
  getShopsForProduct: () => api.get('/admin/shopping/shops'),
  getCategoriesForShop: (shopId?: number) =>
    api.get('/admin/shopping/categories', { params: shopId ? { shop_id: shopId } : {} }),

  // Affiliates
  getAffiliates: (params?: { search?: string; status_filter?: string }) =>
    api.get('/admin/affiliates', { params }),
  getAffiliate: (affiliateId: number) =>
    api.get(`/admin/affiliates/${affiliateId}`),
  toggleAffiliateStatus: (affiliateId: number) =>
    api.put(`/admin/affiliates/${affiliateId}/status`),
  updateCommissionRate: (affiliateId: number, rate: number) =>
    api.put(`/admin/affiliates/${affiliateId}/commission-rate`, null, { params: { rate } }),
  payCommission: (commissionId: number) =>
    api.put(`/admin/commissions/${commissionId}/pay`),
};
