import { useEffect, useState } from 'react';
import API from '../api';

export default function PrincipalDashboard() {
  const [leaves,  setLeaves]  = useState([]);
  const [subReqs, setSubReqs] = useState([]);
  const [msg,     setMsg]     = useState('');
  const [msgType, setMsgType] = useState('success');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      const [l, s] = await Promise.all([
        API.get('/leaves/all'),
        API.get('/substitutes/all'),
      ]);
      setLeaves(l.data);
      setSubReqs(s.data);
    } catch (err) {
      notify('Failed to load. Check backend.', 'error');
    }
  }

  function notify(text, type = 'success') {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  }

  async function approveLeave(id) {
    try {
      await API.patch(`/leaves/${id}/principal-approve`);
      notify('Leave fully approved. Balance deducted.');
      setLeaves(l => l.map(x => x._id === id ? { ...x, status: 'principal_approved' } : x));
    } catch (err) {
      notify(err.response?.data?.message || 'Error', 'error');
    }
  }

  async function rejectLeave(id) {
    await API.patch(`/leaves/${id}/reject`);
    notify('Leave rejected.', 'error');
    setLeaves(l => l.map(x => x._id === id ? { ...x, status: 'rejected' } : x));
  }

  async function approveSub(id) {
    await API.patch(`/substitutes/${id}/principal-approve`);
    notify('Substitute fully approved.');
    setSubReqs(r => r.map(x => x._id === id ? { ...x, status: 'principal_approved' } : x));
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN') : '—';

  const s = {
    wrap:  { maxWidth: 860, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' },
    card:  { border: '1px solid #eee', borderRadius: 10, padding: 16, marginBottom: 16 },
    row:   { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 },
    toast: (t) => ({
      padding: '10px 16px', borderRadius: 8, marginBottom: 14, fontSize: 13,
      background: t === 'error' ? '#FCEBEB' : '#EAF3DE',
      color:      t === 'error' ? '#791F1F' : '#27500A',
      border:     `1px solid ${t === 'error' ? '#F09595' : '#97C459'}`,
    }),
    btn: (c) => ({
      padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, border: '1px solid',
      ...(c === 'green' ? { background: '#EAF3DE', color: '#27500A', borderColor: '#97C459' } :
          c === 'red'   ? { background: '#FCEBEB', color: '#791F1F', borderColor: '#F09595' } :
                          { background: '#E6F1FB', color: '#0C447C', borderColor: '#85B7EB' }),
    }),
  };

  const hodApprovedLeaves = leaves.filter(l => l.status === 'hod_approved');
  const hodApprovedSubs   = subReqs.filter(r => r.status === 'hod_approved');

  return (
    <div style={s.wrap}>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 20 }}>Principal Dashboard</h2>

      {msg && <div style={s.toast(msgType)}>{msg}</div>}

      {/* HOD-approved leaves */}
      <div style={s.card}>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
          HOD-approved leaves — final approval ({hodApprovedLeaves.length})
        </h3>
        {hodApprovedLeaves.length === 0
          ? <p style={{ color: '#999', fontSize: 13 }}>No leaves awaiting final approval.</p>
          : hodApprovedLeaves.map(l => (
            <div key={l._id} style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>
                  {l.teacher?.name} —{' '}
                  {l.leaveType?.charAt(0).toUpperCase() + l.leaveType?.slice(1)} leave
                </div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
                  {fmtDate(l.startDate)} to {fmtDate(l.endDate)} · {l.reason}
                </div>
                <div style={{ color: '#534AB7', fontSize: 11, marginTop: 3 }}>✓ HOD approved</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => approveLeave(l._id)} style={s.btn('green')}>Final approve</button>
                <button onClick={() => rejectLeave(l._id)}  style={s.btn('red')}>Reject</button>
              </div>
            </div>
          ))
        }
      </div>

      {/* HOD-confirmed substitutes */}
      <div style={s.card}>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
          HOD-confirmed substitutes — final approval ({hodApprovedSubs.length})
        </h3>
        {hodApprovedSubs.length === 0
          ? <p style={{ color: '#999', fontSize: 13 }}>No substitutes awaiting final approval.</p>
          : hodApprovedSubs.map(r => (
            <div key={r._id} style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>
                  {r.substituteTeacher?.name} covers {r.absentTeacher?.name}
                </div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
                  Period {r.period?.periodNumber} · {r.period?.subject} · Class {r.period?.className}
                  {' · '}{fmtDate(r.date)}
                </div>
              </div>
              <button onClick={() => approveSub(r._id)} style={s.btn('green')}>Approve</button>
            </div>
          ))
        }
      </div>
    </div>
  );
}
