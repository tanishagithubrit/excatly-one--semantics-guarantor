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
      padding: '4px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: s.bg,
      color: s.text,
      border: `1px solid ${s.border}`
    }}>
      {status.toUpperCase()}
    </span>
  );
}

function TTLBar({ expiresAt, status, ttlSeconds }) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (status !== 'pending') return;

    const exp = new Date(expiresAt).getTime();
    const total = ttlSeconds * 1000;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, exp - now);
      const p = (remaining / total) * 100;
      setPct(Math.max(0, Math.min(100, p)));
    }, 500);

    return () => clearInterval(interval);
  }, [expiresAt, status, ttlSeconds]);

  const color = pct > 60 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';

  return (
    <div style={{ margin: '8px 0' }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>
        TTL remaining
      </div>
      <div style={{ height: 6, background: '#eee', borderRadius: 3 }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          transition: 'width 0.5s'
        }} />
      </div>
    </div>
  );
}

function PaymentCard({ p, onRefresh }) {
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

  const handleDestroy = async () => {
    setLoading(true); setMsg('');
    try {
      await axios.delete(`${API}/${p.id}`);
      setMsg('Request destroyed');
      onRefresh();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Error');
    }
    setLoading(false);
  };

  return (
    <div style={{
      border: '1px solid #eee',
      borderRadius: 12,
      padding: 16,
      marginBottom: 14,
      background: '#fafafa',
      boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#555' }}>
          {p.id.slice(0, 18)}…
        </span>
        <Badge status={p.status} />
      </div>

      <div style={{ fontSize: 15, marginBottom: 5 }}>
        <strong>${p.metadata?.amount}</strong> {p.metadata?.currency}
      </div>

      <div style={{ fontSize: 12, color: '#777', marginBottom: 5 }}>
        {p.metadata?.customerName || 'N/A'} · {p.metadata?.customerEmail || ''}
      </div>

      <div style={{ fontSize: 11, color: '#aaa' }}>
        TTL: {p.ttlSeconds}s
      </div>

      {p.status === 'pending' && (
        <TTLBar expiresAt={p.expiresAt} status={p.status} ttlSeconds={p.ttlSeconds} />
      )}

      {msg && <div style={{ fontSize: 12, marginTop: 6 }}>{msg}</div>}

      {p.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: '#2e7d32',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            {loading ? '...' : '✓ Confirm'}
          </button>

          <button
            onClick={handleDestroy}
            disabled={loading}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: '#c62828',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            {loading ? '...' : '✗ Destroy'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState({
    amount: '',
    currency: 'USD',
    description: '',
    customerName: '',
    customerEmail: ''
  });

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchPayments = useCallback(async () => {
    try {
      const res = await axios.get(API);
      setPayments(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchPayments();
    const t = setInterval(fetchPayments, 4000);
    return () => clearInterval(t);
  }, [fetchPayments]);

  const handlePay = async () => {
    if (!form.amount || isNaN(form.amount)) {
      setMsg('Enter valid amount');
      return;
    }

    setLoading(true);
    setMsg('');

    try {
      const idempotencyKey = Date.now().toString();

      const res = await axios.post(`${API}/initiate`, {
        ...form,
        idempotencyKey
      });

      setMsg(`Request created: ${res.data.id.slice(0, 12)}…`);
      setForm({
        amount: '',
        currency: 'USD',
        description: '',
        customerName: '',
        customerEmail: ''
      });

      fetchPayments();

    } catch (e) {
      setMsg(e.response?.data?.error || 'Error');
    }

    setLoading(false);
  };

  return (
    <div style={{
      maxWidth: 650,
      margin: '50px auto',
      padding: 30,
      borderRadius: 12,
      background: '#ffffff',
      boxShadow: '0 5px 25px rgba(0,0,0,0.1)',
      fontFamily: 'system-ui'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: 20, color: '#1a237e' }}>
        Exactly Once Semantics Guarantor
      </h2>

      <div style={{ display: 'flex', gap: 10 }}>
        <input
          placeholder="Enter Amount"
          value={form.amount}
          onChange={e => setForm({ ...form, amount: e.target.value })}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: 6,
            border: '1px solid #ccc'
          }}
        />

        <button
          onClick={handlePay}
          disabled={loading}
          style={{
            padding: '10px 16px',
            borderRadius: 6,
            border: 'none',
            background: '#1976d2',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {loading ? 'Processing…' : 'Pay'}
        </button>
      </div>

      {msg && (
        <div style={{
          marginTop: 15,
          padding: 10,
          borderRadius: 6,
          background: '#e3f2fd',
          color: '#0d47a1',
          fontSize: 13
        }}>
          {msg}
        </div>
      )}

      <hr style={{ margin: '25px 0', borderTop: '1px solid #eee' }} />

      {payments.map(p => (
        <PaymentCard key={p.id} p={p} onRefresh={fetchPayments} />
      ))}
    </div>
  );
}