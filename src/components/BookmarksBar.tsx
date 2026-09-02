import React from 'react';
import { Bookmark as BookmarkType } from '../types';
import { Globe, Folder, Plus } from 'lucide-react';

interface BookmarksBarProps {
  bookmarks: BookmarkType[];
  onNavigate: (url: string) => void;
  onOpenBookmarksManager: () => void;
}

export const BookmarksBar: React.FC<BookmarksBarProps> = ({
  bookmarks,
  onNavigate,
  onOpenBookmarksManager,
}) => {
  return (
    <div
      id="browser-bookmarks-bar"
      className="flex items-center gap-1 bg-slate-850 px-3 py-1 bg-slate-900/95 border-b border-slate-800 text-xs text-slate-300 overflow-x-auto no-scrollbar select-none h-7"
    >
      {bookmarks.slice(0, 12).map((bookmark) => (
        <button
          key={bookmark.id}
          id={`bookmark-${bookmark.id}`}
          onClick={() => onNavigate(bookmark.url)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-800 hover:text-slate-100 transition-colors shrink-0 max-w-[150px] truncate"
          title={bookmark.url}
        >
          {bookmark.favicon ? (
            <img
              src={bookmark.favicon}
              alt=""
              className="w-3.5 h-3.5 rounded-sm shrink-0 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <Globe className="w-3 h-3 text-slate-400 shrink-0" />
          )}
          <span className="truncate text-[11px]">{bookmark.title}</span>
        </button>
      ))}

      <button
        onClick={onOpenBookmarksManager}
        className="ml-auto flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded hover:bg-slate-800 shrink-0"
      >
        <Folder className="w-3 h-3" />
        <span>Manage</span>
      </button>
    </div>
  );
};
