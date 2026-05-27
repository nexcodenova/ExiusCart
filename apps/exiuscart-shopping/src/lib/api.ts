import axios from 'axios';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const apiClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Product {
  id: number;
  name: string;
  price: number;
  currency: string;
  image_url?: string;
  video_url?: string;
  is_trending: boolean;
  is_featured: boolean;
  category_name?: string;
  stock: number;
  description?: string;
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

// ---------------------------------------------------------------------------
// Shopping API
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Cart API — client-side only, localStorage-based
// ---------------------------------------------------------------------------
export interface CartItem {
  id: number;
  name: string;
  price: number;
  currency: string;
  image_url?: string;
  quantity: number;
  stock: number;
}

const CART_KEY = 'exiuscart_cart';

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export const cartApi = {
  getCart: (): CartItem[] => {
    return readCart();
  },

  addItem: (product: Product): CartItem[] => {
    const cart = readCart();
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + 1, product.stock);
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        image_url: product.image_url,
        quantity: 1,
        stock: product.stock,
      });
    }
    writeCart(cart);
    return cart;
  },

  removeItem: (id: number): CartItem[] => {
    const cart = readCart().filter((item) => item.id !== id);
    writeCart(cart);
    return cart;
  },

  updateQty: (id: number, qty: number): CartItem[] => {
    const cart = readCart();
    const item = cart.find((i) => i.id === id);
    if (item) {
      if (qty <= 0) {
        const filtered = cart.filter((i) => i.id !== id);
        writeCart(filtered);
        return filtered;
      }
      item.quantity = Math.min(qty, item.stock);
    }
    writeCart(cart);
    return cart;
  },

  clearCart: (): CartItem[] => {
    writeCart([]);
    return [];
  },
};
