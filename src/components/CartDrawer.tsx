'use client';

import React from 'react';
import { CartItem } from '@/types';
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
}) => {
  if (!isOpen) return null;

  const total = items.reduce((sum, ci) => {
    const price = ci.item.is_offer && ci.item.offer_price ? ci.item.offer_price : ci.item.price;
    return sum + price * ci.quantity;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Content */}
      <aside className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-800 text-lg">Your Cart</h2>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
              {items.length} items
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="w-8 h-8 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="text-5xl mb-3">🛍️</div>
              <p className="font-semibold text-slate-600">Your cart is empty</p>
              <p className="text-xs mt-1">Add items from the store to begin order</p>
            </div>
          ) : (
            items.map(({ item, quantity }) => {
              const effectivePrice = item.is_offer && item.offer_price ? item.offer_price : item.price;
              const itemTotal = effectivePrice * quantity;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-2xl shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        item.image_emoji || '📦'
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-1">
                        {item.name}
                      </h4>
                      <div className="text-xs text-slate-500 mt-0.5">
                        ₹{effectivePrice} / {item.unit}
                      </div>
                      <div className="text-xs font-bold text-emerald-600 mt-0.5">
                        ₹{itemTotal}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
                      <button
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold px-2">{quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        disabled={quantity >= item.stock}
                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 rounded transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-slate-400 hover:text-red-500 p-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-white space-y-3">
            <div className="flex justify-between items-center text-slate-600 text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">₹{total}</span>
            </div>
            <div className="flex justify-between items-center text-slate-900 font-bold text-lg">
              <span>Total</span>
              <span className="text-emerald-600">₹{total}</span>
            </div>

            <button
              onClick={onProceedToCheckout}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Place Order</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-xs text-center text-slate-400">
              Pay on delivery via Cash or UPI • Confirmed on shop call
            </p>
          </div>
        )}
      </aside>
    </div>
  );
};
