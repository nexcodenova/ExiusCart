import axios from 'axios';

const TOKEN_KEY = 'prodora_token';

const apiClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      if (typeof window !== 'undefined' && localStorage.getItem(TOKEN_KEY)) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

export const prodoraAuth = {
  requestAccess: async (email: string): Promise<{ name: string }> => {
    const response = await apiClient.post('/shopping/request-access', { email });
    localStorage.setItem(TOKEN_KEY, response.data.access_token);
    return { name: response.data.name };
  },
  hasAccess: (): boolean => typeof window !== 'undefined' && !!localStorage.getItem(TOKEN_KEY),
  logout: () => {
    if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  },
};

export interface Product {
  id: number;
  name: string;
  price: number;
  cost_price?: number | null;
  discount_pct?: number | null;
  currency: string;
  image_url?: string;
  video_url?: string;
  source_url?: string | null;
  is_trending: boolean;
  is_featured: boolean;
  category_name?: string;
  category_slug?: string;
  stock: number;
  description?: string;
  sku?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface ProductsParams {
  category?: string;
  search?: string;
  trending?: boolean;
  featured?: boolean;
}

export const shoppingApi = {
  getProducts: async (params?: ProductsParams): Promise<Product[]> => {
    const response = await apiClient.get('/shopping/products', { params });
    return response.data;
  },

  getProduct: async (id: number): Promise<Product> => {
    const response = await apiClient.get(`/shopping/products/${id}`);
    return response.data;
  },

  getCategories: async (): Promise<Category[]> => {
    const response = await apiClient.get('/shopping/categories');
    return response.data;
  },

  importProduct: async (id: number): Promise<{ product_id: number; name: string; shop_id: number }> => {
    const response = await apiClient.post(`/shopping/products/${id}/import`);
    return response.data;
  },
};
