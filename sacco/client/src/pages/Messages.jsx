import { useEffect, useMemo, useState } from 'react';
import { api, mediaUrl } from '../api';

function Avatar({ url, name, className = 'w-9 h-9' }) {
  const initials = String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
  const src = mediaUrl(url);
  return (
    <span
      className={`${className} rounded-full overflow-hidden bg-school-navy/10 text-school-navy flex items-center justify-center text-xs font-semibold shrink-0`}
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : initials}
    </span>
  );
}

export default function Messages() {
  const [contacts, setContacts] = useState([]);
  const [threads, setThreads] = useState([]);
  const [peerId, setPeerId] = useState('');
  const [rows, setRows] = useState([]);
  const [body, setBody] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('threads');

  const loadThreads = () => api.messages.threads().then(setThreads).catch((e) => setError(e.message));
  const loadContacts = () => api.messages.contacts().then(setContacts).catch((e) => setError(e.message));

  const loadChat = (id) => {
    if (!id) return;
    api.messages
      .list(id)
      .then(setRows)
      .then(() => loadThreads())
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadThreads();
    loadContacts();
  }, []);

  useEffect(() => {
    if (peerId) loadChat(peerId);
  }, [peerId]);

  const filteredContacts = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return contacts;
    return contacts.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.role?.toLowerCase().includes(s) ||
        c.member_number?.toLowerCase().includes(s)
    );
  }, [contacts, q]);

  const peer =
    contacts.find((c) => String(c.id) === String(peerId)) ||
    threads.find((t) => String(t.peer_id) === String(peerId));

  const send = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.messages.send({ body, user_id: peerId });
      setBody('');
      loadChat(peerId);
      setTab('threads');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="page-title">Messages</h2>
        <p className="muted mt-1">Message any SACCO account — members, chairperson, or treasurer.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-3 flex flex-col min-h-[24rem]">
          <div className="flex gap-1 p-1 mb-2 rounded-xl bg-black/5">
            <button
              type="button"
              className={`flex-1 text-xs font-semibold py-2 rounded-lg ${tab === 'threads' ? 'bg-white shadow-sm' : ''}`}
              onClick={() => setTab('threads')}
            >
              Conversations
            </button>
            <button
              type="button"
              className={`flex-1 text-xs font-semibold py-2 rounded-lg ${tab === 'new' ? 'bg-white shadow-sm' : ''}`}
              onClick={() => setTab('new')}
            >
              New message
            </button>
          </div>
          {tab === 'new' && (
            <>
              <input
                className="input-field mb-2 text-sm"
                placeholder="Search people…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="records-scroll flex-1">
                {filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setPeerId(String(c.id));
                      setTab('threads');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2 ${
                      String(c.id) === String(peerId) ? 'bg-school-navy/10 font-semibold' : 'hover:bg-black/5'
                    }`}
                  >
                    <Avatar url={c.avatar_url} name={c.full_name} className="w-8 h-8" />
                    <span className="min-w-0">
                      <span className="block truncate">{c.full_name}</span>
                      <span className="muted text-xs capitalize">
                        {c.role}
                        {c.member_number ? ` · ${c.member_number}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
                {!filteredContacts.length && <p className="muted text-sm px-3 py-6">No matches.</p>}
              </div>
            </>
          )}
          {tab === 'threads' && (
            <div className="records-scroll flex-1">
              {threads.map((t) => (
                <button
                  key={t.peer_id}
                  type="button"
                  onClick={() => setPeerId(String(t.peer_id))}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2 ${
                    String(t.peer_id) === String(peerId) ? 'bg-school-navy/10 font-semibold' : 'hover:bg-black/5'
                  }`}
                >
                  <Avatar url={t.peer_avatar} name={t.peer_name} className="w-8 h-8" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{t.peer_name}</span>
                      {t.unread > 0 && (
                        <span className="text-[10px] bg-school-red text-white rounded-full px-1.5 py-0.5">{t.unread}</span>
                      )}
                    </span>
                    <span className="muted text-xs line-clamp-1">{t.body}</span>
                  </span>
                </button>
              ))}
              {!threads.length && (
                <p className="muted text-sm px-3 py-6">No conversations yet. Start one under New message.</p>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 card p-5 flex flex-col min-h-[24rem]">
          {!peerId && <p className="muted text-sm">Select a person to chat.</p>}
          {peerId && (
            <>
              <div className="border-b pb-3 mb-3 flex items-center gap-3" style={{ borderColor: 'var(--theme-border)' }}>
                <Avatar
                  url={peer?.peer_avatar || peer?.avatar_url}
                  name={peer?.peer_name || peer?.full_name}
                  className="w-11 h-11"
                />
                <div>
                  <p className="font-semibold">{peer?.peer_name || peer?.full_name}</p>
                  <p className="text-xs muted capitalize">
                    {peer?.peer_role || peer?.role}
                    {(peer?.peer_email || peer?.email) && ` · ${peer.peer_email || peer.email}`}
                  </p>
                </div>
              </div>
              <div className="flex-1 space-y-3 records-scroll mb-4">
                {rows.map((m) => {
                  const mine = String(m.sender_id) !== String(peerId);
                  return (
                    <div key={m.id} className={`text-sm flex gap-2 max-w-[90%] ${mine ? 'ml-auto flex-row-reverse' : ''}`}>
                      <Avatar url={m.sender_avatar} name={m.sender_name} className="w-8 h-8 mt-4" />
                      <div className={mine ? 'text-right' : ''}>
                        <p className="text-[10px] uppercase font-bold muted">
                          {m.sender_name} · {new Date(m.created_at).toLocaleString()}
                        </p>
                        <p
                          className={`mt-0.5 inline-block rounded-2xl px-3 py-2 ${
                            mine ? 'bg-school-navy text-white' : 'bg-black/5'
                          }`}
                        >
                          {m.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {!rows.length && <p className="muted text-sm">No messages yet. Say hello.</p>}
              </div>
              <form onSubmit={send} className="flex gap-2">
                <input
                  className="input-field"
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a message"
                />
                <button type="submit" className="btn-primary shrink-0">
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
