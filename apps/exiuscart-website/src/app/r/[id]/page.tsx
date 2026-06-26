import { notFound } from 'next/navigation';
import { Package, User, Phone, Clock, Lock, CheckCircle2, XCircle, AlertCircle, BadgeCheck } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

interface ReservationInfo {
  id: number;
  customer_name: string;
  customer_phone: string | null;
  product_name: string;
  quantity: number;
  reservation_type: 'soft_hold' | 'confirmed';
  status: string;
  advance_amount: number | null;
  notes: string | null;
  lpo_number: string | null;
  expires_at: string | null;
  created_at: string | null;
  shop_name: string;
  currency: string;
  product_stock: number | null;
  product_reserved: number | null;
}

async function getReservation(id: string): Promise<ReservationInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/reservation/${id}`, {
      next: { revalidate: 15 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function ReservationInfoPage({ params }: { params: { id: string } }) {
  const r = await getReservation(params.id);
  if (!r) notFound();

  const typeConfig = r.reservation_type === 'confirmed'
    ? { label: 'Confirmed Reservation', icon: Lock, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' }
    : { label: 'Soft Hold', icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' };

  const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
    active:    { label: 'Active',    icon: CheckCircle2, color: 'text-green-400' },
    expired:   { label: 'Expired',   icon: AlertCircle,  color: 'text-red-400' },
    fulfilled: { label: 'Fulfilled', icon: BadgeCheck,   color: 'text-blue-400' },
    cancelled: { label: 'Cancelled', icon: XCircle,      color: 'text-gray-400' },
  };

  const status = statusConfig[r.status] ?? statusConfig.active;
  const StatusIcon = status.icon;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="min-h-screen bg-[#0B1121] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-gray-500 text-xs mb-1">Reservation #{r.id}</p>
          <p className="text-gray-400 text-xs">{r.shop_name}</p>
        </div>

        {/* Type badge */}
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border mb-4 ${typeConfig.bg}`}>
          <TypeIcon className={`w-5 h-5 ${typeConfig.color} flex-shrink-0`} />
          <div>
            <p className={`font-semibold text-sm ${typeConfig.color}`}>{typeConfig.label}</p>
            <p className="text-gray-500 text-xs">
              {r.reservation_type === 'confirmed'
                ? 'This reservation is confirmed and held for the customer.'
                : 'Temporary hold — expires if not confirmed.'}
            </p>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-[#151F32] border border-gray-800 rounded-2xl overflow-hidden">

          {/* Status bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <span className="text-gray-400 text-sm">Status</span>
            <div className={`flex items-center gap-1.5 font-semibold text-sm ${status.color}`}>
              <StatusIcon className="w-4 h-4" />
              {status.label}
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Product */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0D1526] flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-[#7B4FE9]" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Product</p>
                <p className="text-white font-semibold">{r.product_name}</p>
                <p className="text-gray-400 text-sm mt-0.5">
                  Qty: <span className="text-white font-bold">{r.quantity}</span>
                </p>
              </div>
            </div>

            {/* Customer */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0D1526] flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-[#7B4FE9]" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Customer</p>
                <p className="text-white font-semibold">{r.customer_name}</p>
                {r.customer_phone && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-gray-500" />
                    <p className="text-gray-400 text-sm">{r.customer_phone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-800" />

            {/* Dates & amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0D1526] rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Created</p>
                <p className="text-white text-sm font-medium">{formatDate(r.created_at)}</p>
              </div>
              {r.expires_at && (
                <div className="bg-[#0D1526] rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Expires</p>
                  <p className="text-orange-400 text-sm font-medium">{formatDate(r.expires_at)}</p>
                </div>
              )}
              {r.advance_amount && (
                <div className="bg-[#0D1526] rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Advance Paid</p>
                  <p className="text-green-400 text-sm font-bold">{r.currency} {r.advance_amount.toFixed(2)}</p>
                </div>
              )}
              {r.lpo_number && (
                <div className="bg-[#0D1526] rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">LPO Number</p>
                  <p className="text-white text-sm font-medium">{r.lpo_number}</p>
                </div>
              )}
            </div>

            {/* Notes */}
            {r.notes && (
              <div className="bg-[#0D1526] rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-gray-300 text-sm">{r.notes}</p>
              </div>
            )}

            {/* Stock context */}
            {r.product_stock !== null && (
              <>
                <div className="border-t border-gray-800" />
                <div>
                  <p className="text-xs text-gray-500 mb-2">Product Stock Overview</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#0D1526] rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-white">{r.product_stock}</p>
                      <p className="text-xs text-gray-500">Total Stock</p>
                    </div>
                    <div className="bg-[#0D1526] rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-yellow-400">{r.product_reserved}</p>
                      <p className="text-xs text-gray-500">Total Reserved</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-gray-700 text-xs mt-4">Powered by ExiusCart</p>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const r = await getReservation(params.id);
  return {
    title: r ? `Reservation #${r.id} — ${r.product_name}` : 'Reservation Info',
  };
}
