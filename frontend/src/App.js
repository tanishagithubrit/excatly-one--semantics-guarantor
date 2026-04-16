import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = '/api/payments';

const STATUS_COLORS = {
  pending:   { bg: '#fff8e1', text: '#f57f17', border: '#ffe082' },
  success:   { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
  destroyed: { bg: '#fce4ec', text: '#b71c1c', border: '#ef9a9a' },
  expired:   { bg: '#f3e5f5', text: '#6a1b9a', border: '#ce93d8' },
};

function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`
    }}>
      {status.toUpperCase()}
    </span>
  );
}

function TTLBar({ expiresAt, status }) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (status !== 'pending') return;
    const interval = setInterval(() => {
      const now = Date.now();
      const exp = new Date(expiresAt).getTime();
      const total = exp - (now - 35000); // approx total
      const remaining = Math.max(0, exp - now);
      const p = Math.min(100, Math.max(0, (remaining / (exp - (exp - 30000))) * 100));
      setPct(p);
    }, 500);
    return () => clearInterval(interval);
  }, [expiresAt, status]);

  const color = pct > 60 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';

  return (
    <div style={{ margin: '6px 0' }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>TTL remaining</div>
      <div style={{ height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.5s, background 0.5s' }} />
      </div>
    </div>
  );
}

function PaymentCard({ p, onConfirm, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleConfirm = async () => {
    setLoading(true); setMsg('');
    try {
      const res = await axios.post(`${API}/confirm/${p.id}`);
      setMsg(res.data.message);
      onRefresh();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Error');
    }
    setLoading(false);
  };

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#555' }}>{p.id.slice(0, 18)}…</span>
        <Badge status={p.status} />
      </div>
      <div style={{ fontSize: 14, marginBottom: 4 }}>
        <strong>${p.metadata?.amount}</strong> {p.metadata?.currency} — {p.metadata?.description || 'Payment'}
      </div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
        Customer: {p.metadata?.customerName || 'N/A'} · {p.metadata?.customerEmail || ''}
      </div>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>
        Created: {new Date(p.timestamp).toLocaleString()} · TTL: {p.ttlSeconds}s
      </div>
      {p.status === 'pending' && <TTLBar expiresAt={p.expiresAt} status={p.status} />}
      {msg && <div style={{ fontSize: 12, margin: '6px 0', color: msg.toLowerCase().includes('error') || msg.toLowerCase().includes('expired') ? '#c62828' : '#2e7d32' }}>{msg}</div>}
      {p.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={handleConfirm} disabled={loading} style={btnStyle('#1976d2')}>
            {loading ? '...' : '✓ Confirm Payment'}
          </button>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg) {
  return {
    padding: '6px 14px', borderRadius: 6, border: 'none',
    background: bg, color: '#fff', cursor: 'pointer', fontSize: 13
  };
}

export default function App() {
  const [form, setForm] = useState({ amount: '', currency: 'USD', description: '', customerName: '', customerEmail: '' });
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('pay');

  const fetchPayments = useCallback(async () => {
    try {
      const res = await axios.get(API);
      setPayments(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchPayments();
    const t = setInterval(fetchPayments, 4000);
    return () => clearInterval(t);
  }, [fetchPayments]);

  const handlePay = async () => {
    if (!form.amount || isNaN(form.amount)) { setMsg('Enter a valid amount'); return; }
    setLoading(true); setMsg('');
    try {
      const res = await axios.post(`${API}/initiate`, form);
      const killed = res.data.destroyedPrevious;
      const extra = killed > 0 ? ` (${killed} previous request${killed > 1 ? 's' : ''} destroyed)` : '';
      setMsg(`Request created! ID: ${res.data.id.slice(0, 12)}…${extra}`);
      setForm({ amount: '', currency: 'USD', description: '', customerName: '', customerEmail: '' });
      fetchPayments();
      setTab('requests');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to initiate');
    }
    setLoading(false);
  };

  const tabStyle = (t) => ({
    padding: '8px 20px', border: 'none', cursor: 'pointer', fontWeight: 600,
    borderBottom: tab === t ? '2px solid #1976d2' : '2px solid transparent',
    background: 'none', color: tab === t ? '#1976d2' : '#555', fontSize: 14
  });

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a237e' }}>
          Exactly Once Semantics Guarantor
        </h1>
        <p style={{ margin: '6px 0 0', color: '#888', fontSize: 13 }}>
          Payment Gateway · TTL Agent · MongoDB Store
        </p>
      </div>

      {/* Architecture note */}
      <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#555' }}>
        <strong>Flow:</strong> Pay Button → Request (id, metadata, timestamp) → MongoDB Store → TTL Agent monitors → Confirm within TTL = <strong>Payment Successful</strong>. Timeout = <strong>Request Destroyed</strong>.
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #eee', marginBottom: 20 }}>
        <button style={tabStyle('pay')} onClick={() => setTab('pay')}>💳 Pay</button>
        <button style={tabStyle('requests')} onClick={() => { setTab('requests'); fetchPayments(); }}>
          📋 Requests ({payments.filter(p => p.status === 'pending').length} pending)
        </button>
        <button style={tabStyle('all')} onClick={() => { setTab('all'); fetchPayments(); }}>
          📦 All ({payments.length})
        </button>
      </div>

      {/* Pay Tab */}
      {tab === 'pay' && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 24 }}>
          <h2 style={{ margin: '0 0 18px', fontSize: 16, color: '#333' }}>New Payment</h2>
          {[
            { key: 'amount', label: 'Amount ($)', placeholder: '100', type: 'number' },
            { key: 'currency', label: 'Currency', placeholder: 'USD' },
            { key: 'description', label: 'Description', placeholder: 'Order #1234' },
            { key: 'customerName', label: 'Customer Name', placeholder: 'John Doe' },
            { key: 'customerEmail', label: 'Customer Email', placeholder: 'john@example.com' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>{f.label}</label>
              <input
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          ))}
          {msg && <div style={{ fontSize: 13, color: msg.includes('created') ? '#2e7d32' : '#c62828', marginBottom: 12 }}>{msg}</div>}
          <button onClick={handlePay} disabled={loading} style={{ ...btnStyle('#1976d2'), width: '100%', padding: '10px', fontSize: 15 }}>
            {loading ? 'Processing…' : '💳 Pay Now'}
          </button>
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 10, textAlign: 'center' }}>
            Requests auto-expire after {30}s if not confirmed (TTL Agent destroys them)
          </p>
        </div>
      )}

      {/* Pending Requests Tab */}
      {tab === 'requests' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: '#555' }}>Pending Payment Requests</span>
            <button onClick={fetchPayments} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#f9f9f9' }}>↻ Refresh</button>
          </div>
          {payments.filter(p => p.status === 'pending').length === 0
            ? <div style={{ textAlign: 'center', color: '#aaa', padding: 40 }}>No pending requests</div>
            : payments.filter(p => p.status === 'pending').map(p => (
              <PaymentCard key={p.id} p={p} onRefresh={fetchPayments} />
            ))
          }
        </div>
      )}

      {/* All Requests Tab */}
      {tab === 'all' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: '#555' }}>All Payment Requests</span>
            <button onClick={fetchPayments} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#f9f9f9' }}>↻ Refresh</button>
          </div>
          {payments.length === 0
            ? <div style={{ textAlign: 'center', color: '#aaa', padding: 40 }}>No requests yet</div>
            : payments.map(p => <PaymentCard key={p.id} p={p} onRefresh={fetchPayments} />)
          }
        </div>
      )}
    </div>
  );
}
