import axios from 'axios';

const apiClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

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
};
