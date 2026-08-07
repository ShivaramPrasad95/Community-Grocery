'use client';

import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, FileText, ArrowUpRight } from 'lucide-react';

interface CSVUploaderProps {
  token: string;
  onSuccess: () => void;
}

export const CSVUploader: React.FC<CSVUploaderProps> = ({ token, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      if (values.length < headers.length) continue;

      const obj: any = {};
      headers.forEach((h, index) => {
        obj[h] = values[index];
      });

      if (obj.name && obj.category && obj.price && obj.unit && obj.stock) {
        rows.push({
          name: obj.name,
          category: obj.category,
          price: Number(obj.price),
          unit: obj.unit,
          stock: Number(obj.stock),
          barcode: obj.barcode || null,
          image_url: obj.image_url || null,
          image_emoji: obj.image_emoji || '📦',
          description: obj.description || null,
        });
      }
    }
    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatusMsg(null);
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const rows = parseCSV(content);
      setParsedRows(rows);
    };
    reader.readAsText(selected);
  };

  const handleUpload = async () => {
    if (!parsedRows.length) return;
    setUploading(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/admin/bulk-upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows: parsedRows }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload inventory.');

      setStatusMsg({
        type: 'success',
        text: `Successfully uploaded ${data.inserted || parsedRows.length} items to inventory!`,
      });
      setFile(null);
      setParsedRows([]);
      onSuccess();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error uploading CSV.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-card rounded-3xl p-6 border border-slate-200 space-y-6">
      <div>
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" />
          Bulk Inventory CSV Upload
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Upload a CSV file containing columns: <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">name, category, price, unit, stock, barcode, image_emoji</code>
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Upload Dropzone */}
      <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">Select a CSV inventory file</p>
        <p className="text-xs text-slate-400 mt-0.5">.csv files up to 5MB</p>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="mt-4 text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
        />
      </div>

      {/* CSV Preview Table */}
      {parsedRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Preview ({parsedRows.length} valid rows found)
            </span>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{uploading ? 'Uploading...' : 'Confirm & Upload All'}</span>
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 sticky top-0">
                <tr>
                  <th className="p-2 border-b">Name</th>
                  <th className="p-2 border-b">Category</th>
                  <th className="p-2 border-b">Price</th>
                  <th className="p-2 border-b">Unit</th>
                  <th className="p-2 border-b">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2 font-medium text-slate-800">{r.name}</td>
                    <td className="p-2 text-slate-600">{r.category}</td>
                    <td className="p-2 text-emerald-600 font-bold">₹{r.price}</td>
                    <td className="p-2 text-slate-500">{r.unit}</td>
                    <td className="p-2 text-slate-700 font-semibold">{r.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
