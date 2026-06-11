'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Truck, Package, CheckCircle, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';
import { ordersApi } from '@/lib/api';

interface TrackingInfo {
  order_number: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  estimated_delivery: string | null;
}

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

const STEP_LABELS: Record<string, string> = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  processing: 'Preparing',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export default function TrackingPage() {
  const params = useParams();
  const orderId = params.id as string;
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const [info, setInfo] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shopId || !orderId) return;
    ordersApi.getTracking(shopId, orderId)
      .then(res => setInfo(res.data))
      .catch(() => setError('Order not found'))
      .finally(() => setLoading(false));
  }, [shopId, orderId]);

  const currentStep = info ? STATUS_STEPS.indexOf(info.status) : -1;

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <Package className="w-14 h-14 mx-auto text-muted-foreground opacity-40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Order not found</h2>
        <p className="text-sm text-muted-foreground mb-6">We couldn&apos;t find tracking info for this order.</p>
        <Link href="/dashboard/orders" className="text-sm text-primary hover:underline">Back to orders</Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Order Tracking</h1>
        <p className="text-muted-foreground text-sm">{info.order_number}</p>
      </div>

      {/* Status stepper */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between gap-2">
          {STATUS_STEPS.map((step, idx) => {
            if (step === 'cancelled') return null;
            const done = idx <= currentStep;
            const active = idx === currentStep;
            return (
              <div key={step} className="flex-1 flex flex-col items-center gap-1 relative">
                {idx < STATUS_STEPS.length - 1 && (
                  <div className={`absolute top-4 left-1/2 w-full h-0.5 ${done && idx < currentStep ? 'bg-primary' : 'bg-border'}`} style={{ transform: 'translateX(50%)' }} />
                )}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 transition-all ${active ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-primary bg-primary/20 text-primary' : 'border-border bg-muted text-muted-foreground'}`}>
                  {done && idx < currentStep ? <CheckCircle className="w-4 h-4" /> : active ? <Clock className="w-4 h-4" /> : <span className="text-xs">{idx + 1}</span>}
                </div>
                <span className={`text-xs text-center leading-tight ${active ? 'font-semibold text-foreground' : done ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tracking details */}
      {info.tracking_number && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Truck className="w-5 h-5 text-cyan-500" /> Shipment Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Carrier</p>
              <p className="text-sm font-medium text-foreground">{info.carrier || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Tracking Number</p>
              <p className="text-sm font-mono font-medium text-foreground break-all">{info.tracking_number}</p>
            </div>
            {info.shipped_at && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Shipped On</p>
                <p className="text-sm text-foreground">{new Date(info.shipped_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            )}
            {info.estimated_delivery && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Est. Delivery</p>
                <p className="text-sm font-medium text-foreground">{new Date(info.estimated_delivery).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!info.tracking_number && (
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">Tracking information will appear here once your order has been shipped.</p>
        </div>
      )}

      <div className="text-center">
        <Link href="/dashboard/orders" className="text-sm text-primary hover:underline">← Back to orders</Link>
      </div>
    </div>
  );
}
