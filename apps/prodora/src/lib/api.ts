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
    try { localStorage.setItem('prodora_name', response.data.name || ''); } catch {}
    return { name: response.data.name };
  },
  hasAccess: (): boolean => typeof window !== 'undefined' && !!localStorage.getItem(TOKEN_KEY),
  logout: () => {
    if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  },
};

export interface ProductVariant {
  color: string | null;
  color_hex: string | null;
}

export interface ProductVideo {
  url: string;
  platform: string;
  thumbnail_url: string | null;
  title: string | null;
  embed_html: string | null;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  cost_price?: number | null;
  discount_pct?: number | null;
  currency: string;
  image_url?: string;
  images?: string[];
  video_url?: string;
  videos?: ProductVideo[];
  source_url?: string | null;
  is_trending: boolean;
  is_featured: boolean;
  is_bestseller?: boolean;
  category_name?: string;
  category_slug?: string;
  category_id?: number | null;
  stock: number;
  description?: string;
  sku?: string;
  variants?: ProductVariant[];
  winning_score?: number | null;
  trend_percent?: number | null;
  competition_level?: string | null;
  saturation_level?: string | null;
  orders_count?: number | null;
  supplier_name?: string | null;
  supplier_rating?: number | null;
  fulfillment_rate?: number | null;
  processing_time?: string | null;
  shipping_time?: string | null;
  warehouse_country?: string | null;
  shipping_cost?: number | null;
  demand_trend_json?: string | null;
  orders_trend_json?: string | null;
  top_countries_json?: string | null;
  ad_facebook_url?: string | null;
  ad_tiktok_url?: string | null;
  ad_instagram_url?: string | null;
  ad_pinterest_url?: string | null;
  specs_json?: string | null;
  tags?: string | null;
  // Only sent to Growth and Scale, and only when an analysis exists.
  intel_verdict?: 'TEST' | 'WATCH' | 'AVOID';
  intel_confidence?: 'high' | 'medium' | 'low';
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  image_url?: string | null;
  product_count?: number;
}

export interface ProductsParams {
  category?: string;
  search?: string;
  trending?: boolean;
  featured?: boolean;
  bestseller?: boolean;
}

export interface IntelAnalysis {
  verdict: 'TEST' | 'WATCH' | 'AVOID';
  headline: string;
  confidence: 'high' | 'medium' | 'low';
  reasons_for: string[];
  concerns: string[];
  captured_at: string | null;
  stale: boolean;
  market: string;
  product_type: string | null;
  target_margin_pct: number | null;
  basis_price: number | null;
  price: { market: { lowest: number; median: number; highest: number } | null; low: number | null; high: number | null; floor: number | null; note: string | null };
  economics: {
    lines: { key: string; label: string; amount: number; kind: string }[];
    profit: number | null; margin_pct: number | null; break_even_cac: number | null; break_even_roas: number | null;
    assumptions: { key: string; label: string; value: number; unit: string }[]; advertising_included: boolean;
  };
  checked: { source: string; count: number }[];
  competitor_count: number;
  by_marketplace: Record<string, number>;
  competitors: { marketplace: string; title: string; price: number; url?: string | null; rating?: number | null; review_count?: number | null }[];
  not_measured: { key: string; label: string; why: string }[];
}

export type IntelResponse =
  | { locked: true; plan: string | null; required_plan: string; available: boolean }
  | { locked: false; available: false }
  | { locked: false; available: true; analysis: IntelAnalysis };

export const shoppingApi = {
  getIntelligence: async (id: number): Promise<IntelResponse> => {
    const response = await apiClient.get(`/shopping/products/${id}/intelligence`);
    return response.data;
  },
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

  getRelatedProducts: async (id: number): Promise<Product[]> => {
    const response = await apiClient.get(`/shopping/products/${id}/related`);
    return response.data;
  },

  getShippingEstimate: async (id: number, countryCode: string): Promise<ShippingEstimate> => {
    const response = await apiClient.get(`/shopping/products/${id}/shipping-estimate`, { params: { country_code: countryCode } });
    return response.data;
  },
};

// ── Digital Bundles — ExiusCart's own design packs, sold through
// ExiusCart's own Whop store rather than sourced from a supplier. Same
// auth (prodoraAuth token) as everything else in this app.
export interface DigitalBundle {
  id: number;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  price: number;
  suggested_resale_price: number | null;
  resale_notes: string | null;
  ad_facebook_url: string | null;
  ad_tiktok_url: string | null;
  ad_instagram_url: string | null;
  ad_pinterest_url: string | null;
  whop_checkout_url: string | null;
  is_trending?: boolean;
  is_bestseller?: boolean;
  purchased: boolean;
}

export const digitalBundlesApi = {
  list: async (): Promise<DigitalBundle[]> => {
    const response = await apiClient.get('/prodora/digital-bundles');
    return response.data?.bundles ?? [];
  },
  download: async (id: number): Promise<{ editable_file_url: string | null; pdf_file_url: string | null }> => {
    const response = await apiClient.get(`/prodora/digital-bundles/${id}/download`);
    return response.data;
  },
  import: async (id: number): Promise<{ product_id: number; name: string }> => {
    const response = await apiClient.post(`/prodora/digital-bundles/${id}/import`);
    return response.data;
  },
};

// ── Amazon KDP print-ready files for a purchased digital book ─────────────────
export interface KdpPack {
  bundle: { id: number; name: string };
  options: { trim: string; paper: string };
  choices: { trims: string[]; papers: Record<string, string> };
  interior: { source_pages: number; final_pages: number; blank_pages_added: number };
  cover: { width_in: number; height_in: number; spine_in: number; spine_text_allowed: boolean };
  listing: { title: string; description: string; keywords: string[]; suggested_list_price: number | null };
  checklist: string[];
}

export const kdpApi = {
  pack: async (id: number, trim: string, paper: string): Promise<KdpPack> => {
    const response = await apiClient.get(`/prodora/digital-bundles/${id}/kdp/pack`, { params: { trim, paper } });
    return response.data;
  },
  file: async (id: number, kind: 'interior' | 'cover', trim: string, paper: string): Promise<Blob> => {
    const response = await apiClient.get(`/prodora/digital-bundles/${id}/kdp/${kind}.pdf`, { params: { trim, paper }, responseType: 'blob' });
    return response.data;
  },
  track: async (id: number): Promise<{ id: number; status: string }> => {
    const response = await apiClient.post(`/prodora/digital-bundles/${id}/kdp/track`);
    return response.data;
  },
};

export interface ShippingOption {
  logistic_name: string;
  price: number;
  days: string | null;
}

export interface ShippingEstimate {
  country_code: string;
  options: ShippingOption[];
}

export interface ProdoraAccount {
  name: string;
  email: string;
  plan_type: string | null;
  plan_name: string;
  status: string | null;
  trial_ends_at: string | null;
  imports: { used: number; limit: number | null; resets_at: string };
  store_products: { used: number; limit: number | null };
}

export const accountApi = {
  me: async (): Promise<ProdoraAccount> => {
    const response = await apiClient.get('/shopping/me');
    return response.data;
  },
};

// Sent to the ExiusCart admin Reviews queue; only goes live once approved.
export const feedbackApi = {
  submit: async (message: string, rating: number): Promise<void> => {
    await apiClient.post('/feedback', { message, rating, area: 'prodora' });
  },
};
