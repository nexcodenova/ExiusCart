'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ShoppingBag, Minus, Plus, Trash2, Package } from 'lucide-react';
import { cartApi, CartItem } from '@/lib/api';

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setItems(cartApi.getCart());
  }, []);

  const updateQty = (id: number, qty: number) => {
    const updated = cartApi.updateQty(id, qty);
    setItems(updated);
  };

  const removeItem = (id: number) => {
    const updated = cartApi.removeItem(id);
    setItems(updated);
  };

  const handleCheckout = () => {
    alert('Checkout coming soon! Stay tuned for updates.');
  };

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

  // Use first item's currency or default to USD
  const currency = items[0]?.currency || 'USD';
  const formattedSubtotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(subtotal);

  // -------------------------------------------------------------------------
  // Avoid hydration mismatch
  // -------------------------------------------------------------------------
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto px-4 py-6 animate-pulse">
          <div className="h-8 w-24 bg-[#1e1e1e] rounded-lg mb-6" />
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-[#111] border border-[#222] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#999] hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </Link>
          <h1 className="text-xl font-extrabold text-white">
            Your Cart
            {totalItems > 0 && (
              <span className="ml-2 text-sm font-normal text-[#999]">({totalItems} items)</span>
            )}
          </h1>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Empty state                                                        */}
        {/* ----------------------------------------------------------------- */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <ShoppingBag className="w-16 h-16 text-[#333]" />
            <h2 className="text-xl font-bold text-white">Your cart is empty</h2>
            <p className="text-[#999]">Looks like you haven&apos;t added anything yet.</p>
            <Link
              href="/"
              className="flex items-center gap-2 px-6 py-2.5 bg-[#F5A623] text-black font-bold rounded-xl hover:bg-[#e8961a] transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <>
            {/* -------------------------------------------------------------- */}
            {/* Cart items                                                      */}
            {/* -------------------------------------------------------------- */}
            <div className="flex flex-col gap-3 mb-6">
              {items.map((item) => {
                const itemPrice = new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: item.currency || 'USD',
                }).format(item.price * item.quantity);

                return (
                  <div
                    key={item.id}
                    className="bg-[#111] border border-[#222] rounded-2xl p-3 flex gap-3 items-start"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-20 h-20 flex-shrink-0 bg-[#1a1a1a] rounded-xl overflow-hidden">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-[#444]" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/product/${item.id}`}
                        className="text-sm font-semibold text-white hover:text-[#F5A623] transition-colors line-clamp-2"
                      >
                        {item.name}
                      </Link>
                      <div className="text-[#F5A623] font-bold text-sm mt-1">{itemPrice}</div>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center bg-[#1a1a1a] border border-[#333] rounded-lg hover:border-[#F5A623]/50 hover:text-[#F5A623] transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold text-white w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock}
                          className="w-7 h-7 flex items-center justify-center bg-[#1a1a1a] border border-[#333] rounded-lg hover:border-[#F5A623]/50 hover:text-[#F5A623] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="flex-shrink-0 p-1.5 text-[#555] hover:text-red-400 transition-colors rounded-lg hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* -------------------------------------------------------------- */}
            {/* Order summary                                                   */}
            {/* -------------------------------------------------------------- */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-4 flex flex-col gap-4">
              <h2 className="text-base font-bold text-white">Order Summary</h2>

              <div className="flex justify-between text-sm text-[#999]">
                <span>Subtotal ({totalItems} items)</span>
                <span className="text-white font-semibold">{formattedSubtotal}</span>
              </div>
              <div className="flex justify-between text-sm text-[#999]">
                <span>Shipping</span>
                <span className="text-[#999]">Calculated at checkout</span>
              </div>

              <div className="border-t border-[#222] pt-3 flex justify-between font-extrabold text-white text-base">
                <span>Total</span>
                <span className="text-[#F5A623]">{formattedSubtotal}</span>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-3 bg-[#F5A623] text-black font-bold rounded-xl hover:bg-[#e8961a] active:scale-[0.98] transition-all duration-150"
              >
                Proceed to Checkout
              </button>

              <Link
                href="/"
                className="text-center text-sm text-[#999] hover:text-white transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
