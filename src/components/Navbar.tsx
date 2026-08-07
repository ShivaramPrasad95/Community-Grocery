'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ cartCount, onOpenCart }) => {
  return (
    <header className="sticky top-0 z-30 glass-header border-b border-emerald-100 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center text-white text-xl shadow-md group-hover:scale-105 transition-transform">
            🛒
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900 leading-tight">
              Community Grocery
            </h1>
            <p className="text-xs text-emerald-600 font-medium">
              Fresh groceries, delivered to your flat
            </p>
          </div>
        </Link>

        {/* Customer Cart Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCart}
            aria-label="Open shopping cart"
            className="relative flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm animate-pulse">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
