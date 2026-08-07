'use client';

import React, { useState } from 'react';
import { Item } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { QrCode, Search, ArrowLeft, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import Link from 'next/link';

export default function QRScannerPage() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundItem, setFoundItem] = useState<Item | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    setSearching(true);
    setErrorMsg('');
    setFoundItem(null);

    try {
      const q = barcodeInput.trim();
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .or(`barcode.eq.${q},id.eq.${q}`)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFoundItem(data);
      } else {
        setErrorMsg(`No item found matching barcode/ID "${q}".`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error searching barcode');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="glass-header sticky top-0 z-30 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-600" />
              Barcode & Order Scanner
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8 flex-1 w-full space-y-6">
        <div className="glass-card rounded-3xl p-6 border border-slate-200 space-y-6">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto text-2xl">
              <QrCode className="w-8 h-8" />
            </div>
            <h2 className="font-extrabold text-xl text-slate-900">Scan or Enter Code</h2>
            <p className="text-xs text-slate-500">
              Enter product barcode or item ID to view current stock & price
            </p>
          </div>

          <form onSubmit={handleLookup} className="space-y-3">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan or enter barcode / ID..."
                className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={searching}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              {searching ? 'Searching Database...' : 'Lookup Item'}
            </button>
          </form>

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {foundItem && (
            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{foundItem.image_emoji || '📦'}</span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded">
                    {foundItem.category}
                  </span>
                  <h3 className="font-bold text-slate-900 text-base leading-snug mt-1">
                    {foundItem.name}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-emerald-200/60">
                <div>
                  <span className="text-slate-500">Price:</span>
                  <div className="font-extrabold text-slate-900 text-sm">
                    ₹{foundItem.price} / {foundItem.unit}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Stock Available:</span>
                  <div
                    className={`font-extrabold text-sm ${
                      foundItem.stock <= 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {foundItem.stock} {foundItem.unit}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
