import { useEffect, useState } from 'react';
import API from '../api';

const STATUS_LABEL = {
  pending:             'Pending',
  substitute_assigned: 'Substitute assigned',
  hod_approved:        'HOD approved',
  principal_approved:  'Fully approved',
  rejected:            'Rejected',
};

export default function HODDashboard() {
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
    await API.patch(`/leaves/${id}/hod-approve`);
    notify('Leave approved by HOD. Forwarded to Principal.');
    setLeaves(l => l.map(x => x._id === id ? { ...x, status: 'hod_approved', hodApproval: true } : x));
  }

  async function rejectLeave(id) {
    await API.patch(`/leaves/${id}/reject`);
    notify('Leave rejected.', 'error');
    setLeaves(l => l.map(x => x._id === id ? { ...x, status: 'rejected' } : x));
  }

  async function approveSub(id) {
    await API.patch(`/substitutes/${id}/hod-approve`);
    notify('Substitute confirmed. Forwarded to Principal.');
    setSubReqs(r => r.map(x => x._id === id ? { ...x, status: 'hod_approved' } : x));
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
      ...(c === 'blue'  ? { background: '#E6F1FB', color: '#0C447C', borderColor: '#85B7EB' } :
          c === 'red'   ? { background: '#FCEBEB', color: '#791F1F', borderColor: '#F09595' } :
                          { background: '#EAF3DE', color: '#27500A', borderColor: '#97C459' }),
    }),
    badge: (s) => ({
      display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11,
      background:
        s === 'substitute_assigned' ? '#E6F1FB' :
        s === 'hod_approved'        ? '#EEEDFE' :
        s === 'rejected'            ? '#FCEBEB' : '#FAEEDA',
      color:
        s === 'substitute_assigned' ? '#0C447C' :
        s === 'hod_approved'        ? '#3C3489' :
        s === 'rejected'            ? '#791F1F' : '#633806',
    }),
  };

  const pendingLeaves = leaves.filter(l => ['pending', 'substitute_assigned'].includes(l.status));
  const acceptedSubs  = subReqs.filter(r => r.status === 'accepted');

  return (
    <div style={s.wrap}>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 20 }}>HOD Dashboard</h2>

      {msg && <div style={s.toast(msgType)}>{msg}</div>}

      {/* Leave applications */}
      <div style={s.card}>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
          Leave applications ({pendingLeaves.length} pending)
        </h3>
        {pendingLeaves.length === 0
          ? <p style={{ color: '#999', fontSize: 13 }}>No leaves pending.</p>
          : pendingLeaves.map(l => (
            <div key={l._id} style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>
                  {l.teacher?.name} —{' '}
                  {l.leaveType?.charAt(0).toUpperCase() + l.leaveType?.slice(1)} leave
                </div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
                  {fmtDate(l.startDate)} to {fmtDate(l.endDate)} · {l.reason}
                </div>
                {l.status === 'substitute_assigned'
                  ? <div style={{ color: '#27500A', fontSize: 11, marginTop: 3 }}>✓ Substitute assigned</div>
                  : <div style={{ color: '#BA7517', fontSize: 11, marginTop: 3 }}>⏳ Waiting for substitute</div>}
              </div>
              <span style={s.badge(l.status)}>{STATUS_LABEL[l.status] || l.status}</span>
              {l.status === 'substitute_assigned' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => approveLeave(l._id)} style={s.btn('blue')}>Approve</button>
                  <button onClick={() => rejectLeave(l._id)}  style={s.btn('red')}>Reject</button>
                </div>
              )}
            </div>
          ))
        }
      </div>

      {/* Substitute assignments to confirm */}
      <div style={s.card}>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
          Substitute assignments to confirm ({acceptedSubs.length})
        </h3>
        {acceptedSubs.length === 0
          ? <p style={{ color: '#999', fontSize: 13 }}>No assignments to confirm.</p>
          : acceptedSubs.map(r => (
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
              <button onClick={() => approveSub(r._id)} style={s.btn('blue')}>Confirm</button>
            </div>
          ))
        }
      </div>
    </div>
  );
}
