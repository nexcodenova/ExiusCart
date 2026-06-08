'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Search, Phone, Clock, ExternalLink, ShoppingCart, Plus } from 'lucide-react';
import { ordersApi } from '@/lib/api';

interface WhatsAppOrder {
  id: string;
  customer: { name: string; phone: string };
  message: string;
  total?: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
  unread?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  confirmed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function WhatsAppPage() {
  const [orders, setOrders] = useState<WhatsAppOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  useEffect(() => {
    if (!shopId) return;
    ordersApi.getAll(shopId, { status: undefined })
      .then((res) => {
        const whatsapp = (res.data ?? []).filter((o: any) => o.source === 'whatsapp');
        setOrders(whatsapp);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [shopId]);

  const filtered = orders.filter((o) =>
    o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customer.phone.includes(searchQuery)
  );

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp Orders</h1>
        <p className="text-muted-foreground text-sm">Manage orders received through WhatsApp</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : orders.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-500">{loading ? '—' : pendingCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-500">{loading ? '—' : orders.filter(o=>o.status==='completed').length}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input type="text" placeholder="Search by customer name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <MessageCircle className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">{searchQuery ? 'No orders found' : 'No WhatsApp orders yet'}</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {searchQuery ? 'Try a different search' : 'WhatsApp orders will appear here when customers message you to place orders'}
            </p>
            {!searchQuery && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg max-w-sm mx-auto">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">How it works</p>
                <p className="text-xs text-muted-foreground mt-1">Customers message your WhatsApp number → You create an order in POS → It appears here with "WhatsApp" source</p>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((order) => (
              <div key={order.id} className="p-4 hover:bg-muted/30 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{order.customer.name}</p>
                        {order.unread && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />{order.customer.phone}
                      </p>
                      {order.message && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{order.message}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[order.status] ?? 'bg-muted text-muted-foreground'}`}>{order.status}</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleDateString('en-AE')}
                    </div>
                    <a href={`https://wa.me/${order.customer.phone.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer"
                      className="text-xs flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline">
                      <ExternalLink className="w-3 h-3" /> Open Chat
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
