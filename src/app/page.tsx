'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Item, CartItem, Announcement } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Navbar } from '@/components/Navbar';
import { ItemCard } from '@/components/ItemCard';
import { CartDrawer } from '@/components/CartDrawer';
import { CheckoutModal } from '@/components/CheckoutModal';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { FloatingCartBar } from '@/components/FloatingCartBar';
import { Search, Sparkles, Tag, CheckCircle, RefreshCw, ShoppingBag, PhoneCall, ShieldCheck, QrCode } from 'lucide-react';
import Link from 'next/link';

export default function StorefrontPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMode, setActiveMode] = useState<'all' | 'new' | 'offer'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart & Checkout state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  // Load items & announcements
  const fetchData = async () => {
    setLoading(true);
    setConnectionError(false);
    try {
      const [itemsRes, annRes] = await Promise.all([
        supabase.from('items').select('*').order('name'),
        supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      setItems(itemsRes.data || []);
      setAnnouncements(annRes.data || []);
    } catch (err) {
      console.error('Error loading storefront data:', err);
      setConnectionError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to realtime item stock changes
    const channel = supabase
      .channel('public:items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Mode filter
      if (activeMode === 'new' && !item.is_new_arrival) return false;
      if (activeMode === 'offer' && !item.is_offer) return false;

      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchDesc) return false;
      }

      return true;
    });
  }, [items, activeMode, selectedCategory, searchQuery]);

  // Cart operations
  const updateCartQuantity = (item: Item, delta: number) => {
    setCart((prevCart) => {
      const existing = prevCart.find((ci) => ci.item.id === item.id);
      if (!existing) {
        if (delta <= 0) return prevCart;
        return [...prevCart, { item, quantity: 1 }];
      }
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        return prevCart.filter((ci) => ci.item.id !== item.id);
      }
      return prevCart.map((ci) =>
        ci.item.id === item.id ? { ...ci, quantity: Math.min(newQty, item.stock) } : ci
      );
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter((ci) => ci.item.id !== itemId));
  };

  const cartCount = useMemo(() => {
    return cart.reduce((sum, ci) => sum + ci.quantity, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, ci) => {
      const price = ci.item.is_offer && ci.item.offer_price ? ci.item.offer_price : ci.item.price;
      return sum + price * ci.quantity;
    }, 0);
  }, [cart]);

  const handleOrderSuccess = (orderId: string) => {
    setPlacedOrderId(orderId);
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    setCart([]);
  };

  return (
    <div className="min-h-screen pb-24 sm:pb-12 bg-slate-50 flex flex-col">
      {/* Top Announcement Banner */}
      <AnnouncementBanner announcement={announcements[0] || null} />

      {/* Clean Customer Navbar */}
      <Navbar cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} />

      {/* Connection Error Banner */}
      {connectionError && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 text-xs font-semibold flex items-center justify-between">
          <span>⚠️ Connecting to shop… Click retry if items do not load.</span>
          <button
            onClick={fetchData}
            className="flex items-center gap-1 bg-amber-200 hover:bg-amber-300 text-amber-900 px-2 py-1 rounded transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        {/* Controls: Search, Filter Tabs & Category Chips */}
        <section className="space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items, e.g. rice, milk, onion..."
              className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs text-slate-800 text-sm"
            />
          </div>

          {/* Filter Modes */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActiveMode('all')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeMode === 'all'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setActiveMode('new')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeMode === 'new'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              <Sparkles className="w-4 h-4" /> New Arrivals
            </button>
            <button
              onClick={() => setActiveMode('offer')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeMode === 'offer'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <Tag className="w-4 h-4" /> Offers
            </button>
          </div>

          {/* Category Chips */}
          {categories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-100 p-8 shadow-xs">
            <div className="text-5xl mb-3">🔍</div>
            <h3 className="font-bold text-slate-700 text-lg">No items match your search</h3>
            <p className="text-xs text-slate-500 mt-1">Try clearing filters or search for another item.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveMode('all');
                setSelectedCategory('All');
              }}
              className="mt-4 px-4 py-2 bg-emerald-50 text-emerald-700 font-semibold text-xs rounded-xl hover:bg-emerald-100 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const inCart = cart.find((ci) => ci.item.id === item.id);
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  quantityInCart={inCart ? inCart.quantity : 0}
                  onUpdateCart={(delta) => updateCartQuantity(item, delta)}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Swiggy / Zomato style Sticky Floating Cart Bar */}
      <FloatingCartBar
        cartCount={cartCount}
        totalAmount={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={(itemId, delta) => {
          const ci = cart.find((c) => c.item.id === itemId);
          if (ci) updateCartQuantity(ci.item, delta);
        }}
        onRemoveItem={removeFromCart}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Order Success Modal */}
      {placedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" />
          <div className="relative bg-white rounded-3xl p-6 text-center max-w-sm w-full shadow-2xl z-10 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
              <CheckCircle className="w-10 h-10" />
            </div>
            <div>
              <h3 className="font-extrabold text-2xl text-slate-800">Order Placed!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Order ID: <span className="font-mono text-slate-700 font-bold">{placedOrderId.slice(0, 8)}</span>
              </p>
            </div>
            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Your order has been received. The shopkeeper will call your mobile number to confirm delivery.
            </p>
            <button
              onClick={() => setPlacedOrderId(null)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* Discreet Footer for Shop Owners */}
      <footer className="mt-12 py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} Community Grocery • Delivered directly to your flat</div>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/qr" className="hover:text-slate-600 transition-colors flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5" /> Barcode Lookup
            </Link>
            <span>•</span>
            <Link href="/admin" className="hover:text-slate-600 transition-colors flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Shop Owner Login
            </Link>
          </div>
        </div>
      </footer>

      {/* Mobile Customer Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 glass-header border-t border-slate-200 z-30 px-6 py-2 flex items-center justify-around">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex flex-col items-center text-emerald-600 font-semibold text-xs cursor-pointer"
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Catalog</span>
        </button>

        <button
          onClick={() => {
            searchInputRef.current?.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex flex-col items-center text-slate-500 hover:text-emerald-600 text-xs cursor-pointer"
        >
          <Search className="w-5 h-5" />
          <span>Search</span>
        </button>

        <a
          href="https://wa.me/?text=Hi%2C%20I%20need%20help%20with%20my%20grocery%20order"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center text-slate-500 hover:text-emerald-600 text-xs"
        >
          <PhoneCall className="w-5 h-5" />
          <span>Help</span>
        </a>
      </nav>
    </div>
  );
}
