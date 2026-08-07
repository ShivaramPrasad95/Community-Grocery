'use client';

import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';

interface FloatingCartBarProps {
  cartCount: number;
  totalAmount: number;
  onOpenCart: () => void;
}

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({
  cartCount,
  totalAmount,
  onOpenCart,
}) => {
  if (cartCount <= 0) return null;

  return (
    <div className="fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-40 animate-in slide-in-from-bottom-6 fade-in duration-300">
      <button
        onClick={onOpenCart}
        className="w-full bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl shadow-slate-900/40 border border-slate-700/60 flex items-center justify-between group cursor-pointer hover:bg-slate-800 transition-all active:scale-98"
      >
        {/* Left Info: Cart Icon + Items & Total */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white relative">
            <ShoppingBag className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          </div>
          <div className="text-left">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              {cartCount} {cartCount === 1 ? 'Item' : 'Items'} Added
            </div>
            <div className="text-base font-extrabold text-white">
              ₹{totalAmount} <span className="text-xs text-slate-400 font-normal">plus taxes</span>
            </div>
          </div>
        </div>

        {/* Right Action: View Cart */}
        <div className="flex items-center gap-1.5 font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl transition-colors">
          <span>View Cart</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>
    </div>
  );
};
