'use client';

import React, { useState } from 'react';
import { Announcement } from '@/types';
import { Megaphone, X, Tag, Sparkles } from 'lucide-react';

interface AnnouncementBannerProps {
  announcement: Announcement | null;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ announcement }) => {
  const [dismissed, setDismissed] = useState(false);

  if (!announcement || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-sm px-4 py-2.5">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 font-medium overflow-hidden">
          {announcement.kind === 'offer' ? (
            <Tag className="w-4 h-4 text-amber-100 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-100 shrink-0" />
          )}
          <span className="font-bold underline uppercase text-xs tracking-wider">
            {announcement.title}:
          </span>
          <span className="truncate">{announcement.body}</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss banner"
          className="p-1 hover:bg-white/20 rounded-lg transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
