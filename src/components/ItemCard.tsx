'use client';

import React from 'react';
import { Item } from '@/types';
import { Plus, Minus, Tag, Sparkles } from 'lucide-react';

interface ItemCardProps {
  item: Item;
  quantityInCart: number;
  onUpdateCart: (delta: number) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, quantityInCart, onUpdateCart }) => {
  const isOutOfStock = item.stock <= 0;
  const isLowStock = item.stock > 0 && item.stock <= 3;
  const effectivePrice = item.is_offer && item.offer_price ? item.offer_price : item.price;

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col justify-between hover:shadow-lg hover:border-emerald-200 transition-all group relative">
      {/* Top Badges */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <div className="flex flex-wrap gap-1">
          {item.is_new_arrival && (
            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-md">
              <Sparkles className="w-3 h-3" /> New
            </span>
          )}
          {item.is_offer && (
            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-md">
              <Tag className="w-3 h-3" /> Offer
            </span>
          )}
        </div>
        {isOutOfStock ? (
          <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded-md">
            Out of Stock
          </span>
        ) : isLowStock ? (
          <span className="text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md">
            Only {item.stock} left
          </span>
        ) : null}
      </div>

      {/* Item Image / Emoji */}
      <div className="w-full h-32 bg-slate-100/70 rounded-xl flex items-center justify-center text-5xl mb-3 group-hover:scale-105 transition-transform overflow-hidden relative">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{item.image_emoji || '📦'}</span>
        )}
      </div>

      {/* Item Info */}
      <div className="mb-3">
        <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">
          {item.category}
        </div>
        <h3 className="font-semibold text-slate-900 text-base leading-snug line-clamp-1">
          {item.name}
        </h3>
        {item.description && (
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
            {item.description}
          </p>
        )}
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-lg font-bold text-emerald-600">
            ₹{effectivePrice}
          </span>
          {item.is_offer && item.offer_price && (
            <span className="text-xs text-slate-400 line-through">
              ₹{item.price}
            </span>
          )}
          <span className="text-xs text-slate-500 font-medium">
            / {item.unit}
          </span>
        </div>
      </div>

      {/* Cart Actions */}
      <div>
        {isOutOfStock ? (
          <button
            disabled
            className="w-full py-2 bg-slate-100 text-slate-400 rounded-xl text-sm font-medium cursor-not-allowed"
          >
            Unavailable
          </button>
        ) : quantityInCart === 0 ? (
          <button
            onClick={() => onUpdateCart(1)}
            className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-xl text-sm transition-colors border border-emerald-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" /> Add to Cart
          </button>
        ) : (
          <div className="flex items-center justify-between bg-emerald-600 text-white rounded-xl p-1 shadow-sm">
            <button
              onClick={() => onUpdateCart(-1)}
              className="w-8 h-8 rounded-lg hover:bg-emerald-700 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold text-sm px-2">{quantityInCart}</span>
            <button
              onClick={() => onUpdateCart(1)}
              disabled={quantityInCart >= item.stock}
              className="w-8 h-8 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
