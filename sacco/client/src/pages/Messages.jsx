import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Messages() {
  const { isOfficer } = useAuth();
  const [threads, setThreads] = useState([]);
  const [memberId, setMemberId] = useState('');
  const [rows, setRows] = useState([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const loadThreads = () => {
    if (!isOfficer) return;
    api.messages.threads().then(setThreads).catch((e) => setError(e.message));
  };

  const loadChat = (id) => {
    api.messages
      .list(isOfficer ? id : undefined)
      .then(setRows)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadThreads();
    if (!isOfficer) loadChat();
  }, [isOfficer]);

  useEffect(() => {
    if (isOfficer && memberId) loadChat(memberId);
  }, [memberId, isOfficer]);

  const send = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.messages.send({ body, member_id: isOfficer ? memberId : undefined });
      setBody('');
      loadChat(memberId);
      loadThreads();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="page-title">Messages</h2>
        <p className="muted mt-1">
          {isOfficer
            ? 'Reply to member threads from the credits desk.'
            : 'Write to the credits desk. Chairperson and treasurer see this inbox.'}
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className={`grid gap-4 ${isOfficer ? 'lg:grid-cols-3' : ''}`}>
        {isOfficer && (
          <div className="card p-3 records-scroll">
            <p className="text-xs uppercase font-bold muted px-2 py-2">Threads</p>
            {threads.map((t) => (
              <button
                key={t.member_id}
                type="button"
                onClick={() => setMemberId(String(t.member_id))}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm ${
                  String(t.member_id) === String(memberId) ? 'bg-school-navy/10 font-semibold' : 'hover:bg-black/5'
                }`}
              >
                <span className="block">{t.full_name}</span>
                <span className="muted text-xs line-clamp-1">{t.last_body}</span>
              </button>
            ))}
            {!threads.length && <p className="muted text-sm px-3 py-6">No member messages yet.</p>}
          </div>
        )}
        <div className={isOfficer ? 'lg:col-span-2 card p-5 flex flex-col min-h-[24rem]' : 'card p-5 flex flex-col min-h-[24rem]'}>
          {isOfficer && !memberId && <p className="muted text-sm">Select a member thread.</p>}
          {(!isOfficer || memberId) && (
            <>
              <div className="flex-1 space-y-3 records-scroll mb-4">
                {rows.map((m) => (
                  <div key={m.id} className="text-sm">
                    <p className="text-[10px] uppercase font-bold muted">
                      {m.sender_name} · {m.sender_role} · {new Date(m.created_at).toLocaleString()}
                    </p>
                    <p className="mt-0.5">{m.body}</p>
                  </div>
                ))}
                {!rows.length && <p className="muted text-sm">No messages yet. Start the conversation.</p>}
              </div>
              <form onSubmit={send} className="flex gap-2">
                <input className="input-field" required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message" />
                <button type="submit" className="btn-primary shrink-0">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
