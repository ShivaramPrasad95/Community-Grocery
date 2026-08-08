'use client';

import React, { useEffect, useState } from 'react';
import { Item, Order, Customer, Announcement } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { CSVUploader } from '@/components/CSVUploader';
import {
  ShieldCheck,
  Package,
  ShoppingBag,
  Upload,
  Megaphone,
  Users,
  Plus,
  Trash2,
  Edit2,
  Lock,
  LogOut,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Truck,
  Send,
  Tag,
  Sparkles,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // Active Tab: 'stock' | 'orders' | 'csv' | 'broadcast' | 'customers'
  const [activeTab, setActiveTab] = useState<'stock' | 'orders' | 'csv' | 'broadcast' | 'customers'>('stock');

  // Data states
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchStock, setSearchStock] = useState('');
  const [searchOrders, setSearchOrders] = useState('');

  // Item Modal state
  const [editingItem, setEditingItem] = useState<Partial<Item> | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemSaveError, setItemSaveError] = useState('');

  // Broadcast Announcement Form state
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annKind, setAnnKind] = useState<'new_arrival' | 'offer'>('offer');
  const [annImage, setAnnImage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  // Check existing token on mount
  useEffect(() => {
    const saved = localStorage.getItem('cg_admin_token');
    if (saved) setToken(saved);
  }, []);

  // Fetch all admin data upfront when authenticated so top counters show instantly
  const fetchAdminData = async (quiet = false) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    try {
      const [itemsRes, ordersRes, custRes, annRes] = await Promise.all([
        supabase.from('items').select('*').order('name'),
        supabase
          .from('orders')
          .select('*, customers(*)')
          .order('created_at', { ascending: false }),
        fetch('/api/admin/customers', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : { customers: [] })),
        supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      if (itemsRes.data) setItems(itemsRes.data);
      if (ordersRes.data) setOrders(ordersRes.data);
      if (custRes.customers) setCustomers(custRes.customers);
      if (annRes.data) setAnnouncements(annRes.data);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

// Play Order Notification Bell Sound via Web Audio API
function playOrderBellSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // 2-step crystal chime bell sound (880Hz -> 1318.5Hz)
    playTone(880, 0, 0.4);
    playTone(1318.51, 0.18, 0.7);
  } catch (err) {
    console.warn('Audio chime notice:', err);
  }
}

  const [newOrderNotice, setNewOrderNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchAdminData(false);

    // Pure Supabase Realtime listener on orders table - ZERO periodic timers or bulk refetches!
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          playOrderBellSound();
          const newOrd = payload.new as Order;
          const shortId = (newOrd.id || '').slice(0, 8);
          setNewOrderNotice(`🔔 New Order Received! (#${shortId})`);
          setTimeout(() => setNewOrderNotice(null), 8000);

          // Fetch only the single new order row with customer relation
          const { data: fullOrder } = await supabase
            .from('orders')
            .select('*, customers(*)')
            .eq('id', newOrd.id)
            .maybeSingle();

          if (fullOrder) {
            setOrders((prev) => {
              if (prev.some((o) => o.id === fullOrder.id)) return prev;
              return [fullOrder, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status } : o))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token]);

  // Auth Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthenticating(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      setToken(data.token);
      localStorage.setItem('cg_admin_token', data.token);
      setPasswordInput('');
    } catch (err: any) {
      setAuthError(err.message || 'Invalid password.');
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('cg_admin_token');
  };

  // Stock Delta Adjustment
  const handleAdjustStock = async (itemId: string, delta: number) => {
    try {
      const res = await fetch('/api/admin/adjust-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ item_id: itemId, delta }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, stock: Math.max(0, i.stock + delta) } : i))
        );
      }
    } catch (err) {
      console.error('Error adjusting stock:', err);
    }
  };

  // Delete Item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      const res = await fetch(`/api/admin/items/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  // Save Item (Create / Edit)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setItemSaveError('');

    try {
      const isNew = !editingItem.id;
      const url = isNew ? '/api/admin/items' : `/api/admin/items/${editingItem.id}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingItem),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save item.');

      setIsItemModalOpen(false);
      setEditingItem(null);
      fetchAdminData();
    } catch (err: any) {
      setItemSaveError(err.message || 'Save error');
    }
  };

  // Order Status Update
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: status as any } : o))
        );
      }
    } catch (err) {
      console.error('Error updating order status:', err);
    }
  };

  // Broadcast Announcement Submit
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcasting(true);
    setBroadcastResult(null);

    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: annTitle,
          body: annBody,
          kind: annKind,
          image_url: annImage || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Broadcast failed.');

      // Directly trigger local broadcast dispatch for instant execution
      try {
        const { data: custData } = await supabase.from('customers').select('id, name, phone');
        if (custData && custData.length > 0) {
          const kindEmoji = annKind === 'offer' ? '🏷️' : '🆕';
          const msgBody = `${kindEmoji} *${annTitle}*\n\n${annBody}\n\n— Community Grocery`;
          await fetch('/api/broadcast', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'x-internal-secret': process.env.NEXT_PUBLIC_INTERNAL_SECRET || '',
            },
            body: JSON.stringify({
              announcement_id: data.id,
              body: msgBody,
              customers: custData,
            }),
          });
        }
      } catch (bcErr) {
        console.warn('Direct broadcast dispatch notice:', bcErr);
      }

      setBroadcastResult('Announcement created & broadcast sent successfully!');
      setAnnTitle('');
      setAnnBody('');
      setAnnImage('');
      fetchAdminData();
    } catch (err: any) {
      setBroadcastResult(`Error: ${err.message}`);
    } finally {
      setBroadcasting(false);
    }
  };

  // If not logged in -> render Auth overlay
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-lg shadow-emerald-600/30">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="font-extrabold text-2xl text-slate-900">Admin Authentication</h2>
            <p className="text-xs text-slate-500">Enter password to access shop management</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {authError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter shop password"
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authenticating}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              {authenticating ? 'Verifying...' : 'Unlock Admin Portal'}
            </button>
          </form>

          <div className="text-center">
            <Link href="/" className="text-xs text-emerald-600 font-semibold hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Filter stock items
  const filteredStock = items.filter(
    (i) =>
      i.name.toLowerCase().includes(searchStock.toLowerCase()) ||
      i.category.toLowerCase().includes(searchStock.toLowerCase()) ||
      (i.barcode && i.barcode.includes(searchStock))
  );

  // Helper to check if an order requested ASAP / Urgent delivery
  const isAsapOrder = (ord: Order) => {
    const slot = (ord.delivery_time || ord.notes || '').toLowerCase();
    return (
      slot.includes('asap') ||
      slot.includes('as soon as possible') ||
      slot.includes('immediate') ||
      slot.includes('express') ||
      slot.includes('urgent')
    );
  };

  // Filter orders by Order ID, Customer Name, Flat, Phone, or Status
  const filteredOrders = orders.filter((ord) => {
    if (!searchOrders.trim()) return true;
    const q = searchOrders.toLowerCase();
    const shortId = ord.id.slice(0, 8).toLowerCase();
    const fullId = ord.id.toLowerCase();
    const custName = ord.customers?.name?.toLowerCase() || '';
    const custPhone = ord.customers?.phone?.toLowerCase() || '';
    const custFlat = ord.customers?.flat?.toLowerCase() || '';
    const status = ord.status.toLowerCase();
    const slot = (ord.delivery_time || '').toLowerCase();

    return (
      shortId.includes(q) ||
      fullId.includes(q) ||
      custName.includes(q) ||
      custPhone.includes(q) ||
      custFlat.includes(q) ||
      status.includes(q) ||
      slot.includes(q)
    );
  });

  // Priority Queue Sorting:
  // 1. Active pending/confirmed orders at top
  // 2. ASAP orders prioritized at the VERY TOP of active queue
  // 3. Chronological FIFO order (oldest first) so shopkeepers can close one by one
  // 4. Completed / cancelled orders placed at bottom
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const aActive = a.status !== 'delivered' && a.status !== 'cancelled';
    const bActive = b.status !== 'delivered' && b.status !== 'cancelled';

    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    if (aActive && bActive) {
      const aAsap = isAsapOrder(a);
      const bAsap = isAsapOrder(b);

      if (aAsap && !bAsap) return -1;
      if (!aAsap && bAsap) return 1;

      // Oldest first for active queue (FIFO)
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return aTime - bTime;
    }

    // Newest first for completed/cancelled
    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();
    return bTime - aTime;
  });

  // Calculate active order queue rank map
  const queueMap = new Map<string, number>();
  let activeCounter = 0;
  sortedOrders.forEach((ord) => {
    if (ord.status !== 'delivered' && ord.status !== 'cancelled') {
      activeCounter++;
      queueMap.set(ord.id, activeCounter);
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Realtime Order Arrival Bell Toast */}
      {newOrderNotice && (
        <div className="bg-emerald-600 text-white font-extrabold text-sm px-4 py-2.5 text-center flex items-center justify-center gap-2 shadow-lg animate-bounce sticky top-0 z-40">
          <span className="text-base">🔔</span>
          <span>{newOrderNotice}</span>
        </div>
      )}

      {/* Top Admin Header */}
      <header className="glass-header sticky top-0 z-30 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Shop Control Center
              </h1>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Tabs Bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'stock'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" /> Stock & Catalog ({items.length})
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Orders ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'csv'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-4 h-4" /> Bulk CSV
          </button>

          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'broadcast'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Megaphone className="w-4 h-4" /> WhatsApp Broadcast
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'customers'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" /> Customers ({customers.length})
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        {/* 1. STOCK TAB */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="search"
                  value={searchStock}
                  onChange={(e) => setSearchStock(e.target.value)}
                  placeholder="Filter stock by name, category, barcode..."
                  className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                onClick={() => {
                  setEditingItem({
                    name: '',
                    category: 'General',
                    price: 0,
                    unit: 'kg',
                    stock: 10,
                    image_emoji: '📦',
                  });
                  setIsItemModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 animate-pulse">Loading stock inventory...</div>
            ) : (
              <div className="glass-card rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-3">Item</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Price</th>
                        <th className="p-3">Stock Count</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStock.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 flex items-center gap-3">
                            <span className="text-2xl">{item.image_emoji || '📦'}</span>
                            <div>
                              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                                <span>{item.name}</span>
                                {item.is_new_arrival && (
                                  <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                                    New
                                  </span>
                                )}
                                {item.is_offer && (
                                  <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                                    Offer (₹{item.offer_price})
                                  </span>
                                )}
                              </div>
                              {item.barcode && <div className="text-slate-400 font-mono text-xs">Barcode: {item.barcode}</div>}
                            </div>
                          </td>
                          <td className="p-3 text-slate-600 font-medium">{item.category}</td>
                          <td className="p-3 font-extrabold text-emerald-600">
                            ₹{item.price} / {item.unit}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAdjustStock(item.id, -1)}
                                className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <span className={`font-bold text-sm ${item.stock <= 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                {item.stock}
                              </span>
                              <button
                                onClick={() => handleAdjustStock(item.id, 1)}
                                className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setIsItemModalOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <h3 className="font-bold text-slate-800 text-lg">Customer Orders ({filteredOrders.length})</h3>
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="search"
                  value={searchOrders}
                  onChange={(e) => setSearchOrders(e.target.value)}
                  placeholder="Search by Order ID, name, flat, phone..."
                  className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 animate-pulse">Loading orders queue...</div>
            ) : sortedOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 p-6">
                {searchOrders ? 'No orders match your search criteria.' : 'No customer orders in queue.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedOrders.map((ord) => {
                  const isActive = ord.status !== 'delivered' && ord.status !== 'cancelled';
                  const queuePosition = queueMap.get(ord.id) || null;
                  const isAsap = isAsapOrder(ord);

                  const custName = ord.customers?.name || 'Customer';
                  const custFlat = ord.customers?.flat || 'N/A';
                  const custPhone = ord.customers?.phone || 'N/A';
                  const shortId = ord.id ? ord.id.slice(0, 8) : 'N/A';

                  return (
                    <div
                      key={ord.id}
                      className={`glass-card rounded-2xl p-5 border transition-all space-y-3 relative ${
                        isAsap && isActive
                          ? 'border-red-300 ring-2 ring-red-400/40 bg-gradient-to-br from-red-50/40 to-amber-50/30'
                          : isActive
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-200 bg-slate-50/60 opacity-75'
                      }`}
                    >
                      {/* Queue Header Badge */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {queuePosition && (
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  isAsap
                                    ? 'bg-red-600 text-white shadow-xs animate-pulse'
                                    : 'bg-slate-800 text-white'
                                }`}
                              >
                                {isAsap ? `🔥 ASAP PRIORITY (Queue #${queuePosition})` : `Queue #${queuePosition}`}
                              </span>
                            )}
                            <span className="font-bold text-slate-900 text-base">{custName}</span>
                            <span
                              className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"
                              title={`Full Order ID: ${ord.id}`}
                            >
                              #{shortId}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Flat: <span className="font-semibold text-slate-700">{custFlat}</span> • Phone:{' '}
                            <span className="font-semibold text-slate-700">{custPhone}</span>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${
                            ord.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : ord.status === 'confirmed'
                              ? 'bg-blue-100 text-blue-800'
                              : ord.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>

                      {/* Order items summary */}
                      <div className="text-xs space-y-1 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        {Array.isArray(ord.items) &&
                          ord.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-slate-700">
                              <span>
                                {it.qty}x {it.name}
                              </span>
                              <span className="font-semibold">₹{it.price * it.qty}</span>
                            </div>
                          ))}
                        <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-slate-900">
                          <span>Total Payable</span>
                          <span className="text-emerald-600">₹{ord.total}</span>
                        </div>
                      </div>

                      {ord.delivery_time && (
                        <div className="text-xs text-slate-500">
                          Slot:{' '}
                          <span className={`font-semibold ${isAsap ? 'text-red-600 font-extrabold' : ''}`}>
                            {ord.delivery_time}
                          </span>
                        </div>
                      )}

                      {ord.notes && (
                        <div className="text-xs text-slate-500 italic bg-amber-50/60 p-2 rounded-lg border border-amber-100">
                          Note: "{ord.notes}"
                        </div>
                      )}

                      {/* Status change actions */}
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-xs font-semibold text-slate-500">Set status:</span>
                        {['pending', 'confirmed', 'delivered', 'cancelled'].map((st) => (
                          <button
                            key={st}
                            onClick={() => handleUpdateOrderStatus(ord.id, st)}
                            className={`px-2 py-1 rounded text-[11px] font-bold capitalize transition-colors cursor-pointer ${
                              ord.status === st
                                ? 'bg-slate-800 text-white'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. CSV TAB */}
        {activeTab === 'csv' && (
          <CSVUploader token={token} onSuccess={fetchAdminData} />
        )}

        {/* 4. BROADCAST TAB */}
        {activeTab === 'broadcast' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card rounded-3xl p-6 border border-slate-200 space-y-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-emerald-600" />
                Publish & Broadcast Announcement
              </h3>
              <p className="text-xs text-slate-500">
                Create new arrivals or special offers. Saving broadcasts an automated WhatsApp alert to registered customers.
              </p>

              {broadcastResult && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  {broadcastResult}
                </div>
              )}

              <form onSubmit={handleBroadcast} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="e.g. 20% OFF Fresh Alphonso Mangoes!"
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Announcement Body
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={annBody}
                    onChange={(e) => setAnnBody(e.target.value)}
                    placeholder="e.g. Fresh batch arrived from farm today. Order directly on the web app for free flat delivery."
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Type
                    </label>
                    <select
                      value={annKind}
                      onChange={(e) => setAnnKind(e.target.value as any)}
                      className="w-full px-3 py-2 border rounded-xl text-sm bg-white"
                    >
                      <option value="offer">Special Offer</option>
                      <option value="new_arrival">New Arrival</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Image URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={annImage}
                      onChange={(e) => setAnnImage(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={broadcasting}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span>{broadcasting ? 'Publishing...' : 'Publish Announcement'}</span>
                  </button>
                  {annTitle && (
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `${annKind === 'offer' ? '🏷️' : '🆕'} *${annTitle}*\n\n${annBody}\n\n🛒 Order on store: https://community-grocery.vercel.app`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                    >
                      <span>📲 Share to WhatsApp</span>
                    </a>
                  )}
                </div>
              </form>
            </div>

            {/* Previous announcements */}
            <div className="glass-card rounded-3xl p-6 border border-slate-200 space-y-4">
              <h3 className="font-bold text-slate-800 text-lg">Broadcast History</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {announcements.map((a) => (
                  <div key={a.id} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{a.title}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold uppercase">
                        {a.kind}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{a.body}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400">
                        {new Date(a.created_at || Date.now()).toLocaleDateString()}
                      </span>
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                          `${a.kind === 'offer' ? '🏷️' : '🆕'} *${a.title}*\n\n${a.body}\n\n🛒 Order on store: https://community-grocery.vercel.app`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        <span>📲 Share to WhatsApp Group</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. CUSTOMERS TAB */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 text-lg">Registered Customers ({customers.length})</h3>
            <div className="glass-card rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Flat / Address</th>
                    <th className="p-3">Phone Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{c.name}</td>
                      <td className="p-3 text-slate-600 font-medium">{c.flat}</td>
                      <td className="p-3 font-mono text-emerald-600 font-bold">{c.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Edit/Create Item Modal */}
      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setIsItemModalOpen(false)} />
          <div className="relative bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl z-10 space-y-4">
            <h3 className="font-extrabold text-xl text-slate-900">
              {editingItem.id ? 'Edit Item' : 'Add New Item'}
            </h3>

            {itemSaveError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl">
                {itemSaveError}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={editingItem.name || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={editingItem.category || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Unit (e.g. kg, pcs, pkt)</label>
                  <input
                    type="text"
                    required
                    value={editingItem.unit || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingItem.price ?? ''}
                    onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={editingItem.stock ?? ''}
                    onChange={(e) => setEditingItem({ ...editingItem, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Emoji Icon</label>
                  <input
                    type="text"
                    value={editingItem.image_emoji || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, image_emoji: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Barcode (Optional)</label>
                  <input
                    type="text"
                    value={editingItem.barcode || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, barcode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingItem.is_new_arrival}
                    onChange={(e) => setEditingItem({ ...editingItem, is_new_arrival: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span className="font-semibold text-slate-700">New Arrival</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingItem.is_offer}
                    onChange={(e) => setEditingItem({ ...editingItem, is_offer: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span className="font-semibold text-slate-700">Offer Active</span>
                </label>
              </div>

              {editingItem.is_offer && (
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Offer Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.offer_price ?? ''}
                    onChange={(e) => setEditingItem({ ...editingItem, offer_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
