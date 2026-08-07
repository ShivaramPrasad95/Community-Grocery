'use client';

import React, { useState } from 'react';
import { CartItem } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { X, CheckCircle2, Truck, Phone, Home, User, Clock, AlertCircle } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onOrderSuccess: (orderId: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onOrderSuccess,
}) => {
  const [name, setName] = useState('');
  const [flat, setFlat] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const total = items.reduce((sum, ci) => {
    const price = ci.item.is_offer && ci.item.offer_price ? ci.item.offer_price : ci.item.price;
    return sum + price * ci.quantity;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!deliveryTime) {
      setErrorMsg('Please select a preferred delivery slot.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Upsert Customer in `customers` table
      let customerId: string | null = null;
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
        await supabase
          .from('customers')
          .update({ name, flat })
          .eq('id', customerId);
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({ name, flat, phone: cleanPhone })
          .select('id')
          .single();

        if (custErr) {
          throw new Error(custErr.message || 'Failed to save customer details.');
        }
        if (newCust) {
          customerId = newCust.id;
        }
      }

      // 2. Prepare items JSONB array matching schema
      const itemsPayload = items.map((ci) => {
        const price = ci.item.is_offer && ci.item.offer_price ? ci.item.offer_price : ci.item.price;
        return {
          id: ci.item.id,
          name: ci.item.name,
          price: price,
          qty: ci.quantity,
          unit: ci.item.unit,
        };
      });

      // 3. Create Order in `orders` table
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          items: itemsPayload,
          subtotal: total,
          delivery_charge: 0,
          total: total,
          delivery_time: deliveryTime,
          notes: notes || null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (orderErr || !orderData) {
        throw new Error(orderErr?.message || 'Failed to place order.');
      }

      // 4. Decrement Stock via RPC
      await supabase.rpc('decrement_stock', {
        items: items.map((ci) => ({ id: ci.item.id, qty: ci.quantity })),
      });

      // 5. Trigger Telegram Bot notification to shop owner
      try {
        await fetch('/api/send-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderData.id }),
        });
      } catch (err) {
        console.warn('Telegram notification trigger notice:', err);
      }

      onOrderSuccess(orderData.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong while placing order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            <h3 className="font-bold text-lg">Delivery Details</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close delivery modal"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Your Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Flat / Block Address
            </label>
            <div className="relative">
              <Home className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={flat}
                onChange={(e) => setFlat(e.target.value)}
                placeholder="e.g. B-204, Tower 3"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Mobile Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="tel"
                required
                pattern="[0-9]{10}"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit phone number"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Preferred Delivery Time
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <select
                required
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm bg-white"
              >
                <option value="">Select a slot</option>
                <option value="Morning (8 AM – 11 AM)">Morning (8 AM – 11 AM)</option>
                <option value="Afternoon (12 PM – 4 PM)">Afternoon (12 PM – 4 PM)</option>
                <option value="Evening (5 PM – 8 PM)">Evening (5 PM – 8 PM)</option>
                <option value="As soon as possible">As soon as possible</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Special Instructions (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Ring doorbell twice, leave at front door"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Total payable</div>
              <div className="text-xl font-extrabold text-emerald-600">₹{total}</div>
            </div>
            <div className="text-xs font-semibold text-slate-600 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
              💵 Pay on delivery
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {submitting ? (
              <span>Confirming Order...</span>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Confirm Order</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
