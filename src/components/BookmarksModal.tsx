import React, { useState } from 'react';
import { X, Bookmark as BookmarkIcon, Plus, Trash2, Globe, Folder, Edit3, ExternalLink } from 'lucide-react';
import { Bookmark } from '../types';

interface BookmarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  onNavigate: (url: string) => void;
  onAddBookmark: (bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => void;
  onDeleteBookmark: (id: string) => void;
}

export const BookmarksModal: React.FC<BookmarksModalProps> = ({
  isOpen,
  onClose,
  bookmarks,
  onNavigate,
  onAddBookmark,
  onDeleteBookmark,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newFolder, setNewFolder] = useState('Favorites');

  if (!isOpen) return null;

  const folders = ['All', ...Array.from(new Set(bookmarks.map((b) => b.folder || 'Unsorted')))];

  const filtered = selectedFolder === 'All'
    ? bookmarks
    : bookmarks.filter((b) => (b.folder || 'Unsorted') === selectedFolder);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    onAddBookmark({
      title: newTitle.trim(),
      url: newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`,
      folder: newFolder,
      favicon: `https://www.google.com/s2/favicons?domain=${newUrl.trim()}&sz=64`,
    });

    setNewTitle('');
    setNewUrl('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2">
            <BookmarkIcon className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-slate-200">Bookmarks Manager</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Bookmark</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Add Bookmark Sub-form */}
        {showAddForm && (
          <form onSubmit={handleAddSubmit} className="p-4 bg-slate-850 border-b border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-slate-300">Add New Bookmark</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                required
              />
              <input
                type="text"
                placeholder="https://example.com"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                required
              />
              <input
                type="text"
                placeholder="Folder name"
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {/* Folder Filter Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800 bg-slate-900 overflow-x-auto no-scrollbar">
          {folders.map((folder) => (
            <button
              key={folder}
              onClick={() => setSelectedFolder(folder)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                selectedFolder === folder
                  ? 'bg-slate-800 text-indigo-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {folder}
            </button>
          ))}
        </div>

        {/* Bookmarks List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-850 p-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              No bookmarks found in this folder.
            </div>
          ) : (
            filtered.map((bm) => (
              <div
                key={bm.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/60 transition-colors group"
              >
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    onNavigate(bm.url);
                    onClose();
                  }}
                >
                  {bm.favicon ? (
                    <img
                      src={bm.favicon}
                      alt=""
                      className="w-4 h-4 rounded-sm shrink-0 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-200 truncate group-hover:text-indigo-300">
                      {bm.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{bm.url}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {bm.folder || 'Favorites'}
                  </span>

                  <button
                    onClick={() => onDeleteBookmark(bm.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-all"
                    title="Delete bookmark"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
