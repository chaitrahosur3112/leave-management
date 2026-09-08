import { useCallback, useEffect, useState } from 'react';
import API from '../api';
import { useNavigate } from 'react-router-dom';

const TYPES = [['casual', 'Casual'], ['sick', 'Sick'], ['emergency', 'Emergency'], ['paternity/maternity', 'Paternity / Maternity']];
const ACTIVE = ['coverage_pending', 'substitute_confirmed', 'submitted', 'hod_approved'];
const covered = r => ['accepted', 'hod_approved', 'principal_approved'].includes(r.status) && r.substituteTeacher;
const date = d => d ? String(d).slice(0, 10) : '';
const style = { maxWidth: 900, margin: '24px auto', padding: 16, fontFamily: 'sans-serif' };
const card = { border: '1px solid #ddd', borderRadius: 10, padding: 16, marginBottom: 12 };
const input = { display: 'block', width: '100%', boxSizing: 'border-box', padding: 9, margin: '5px 0 12px' };
const error = e => e.response?.data?.message || e.message || 'Request failed';

export default function WorkflowDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || 'teacher';
  const [leaves, setLeaves] = useState([]);
  const [requests, setRequests] = useState([]);
  const [balance, setBalance] = useState(null);
  const [form, setForm] = useState({ startDate: '', endDate: '', leaveType: 'casual' });
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const admin = role !== 'teacher';
    const [l, s] = await Promise.all([API.get(admin ? '/leaves/all' : '/leaves/my'), API.get(admin ? '/substitutes/all' : '/substitutes/my')]);
    setLeaves(l.data); setRequests(s.data);
    if (!admin) setBalance((await API.get('/leaves/balance')).data);
  }, [role]);
  useEffect(() => { load().catch(e => setMessage(error(e))); }, [load]);
  async function act(fn) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await fn(); await load(); setMessage('Saved successfully.'); }
    catch (e) { setMessage(error(e)); }
    finally { setBusy(false); }
  }
  function reasonFor(id) { return reasons[id] || ''; }
  function setReason(id, value) { setReasons(old => ({ ...old, [id]: value })); }
  const submit = e => { e.preventDefault(); act(async () => {
    const r = await API.post('/substitutes/request', form);
    setMessage(`${r.data.createdCount} periods requested.`);
  }); };
  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); };
  return <main style={style}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><h1>Leave Management</h1><button onClick={logout}>Sign out</button></header>
    <p>{user.name} · {role.toUpperCase()}</p>
    {message && <p role="status" style={{ padding: 12, background: '#f3f4f6', borderRadius: 6 }}>{message}</p>}
    {role === 'teacher' && <>
      {balance && <section style={card}><h2>Leave balance</h2><p>First half: {balance.firstHalfTotal - balance.firstHalfUsed} remaining · Second half: {balance.secondHalfTotal - balance.secondHalfUsed} remaining · Privileged: {balance.privilegedLeaves}</p></section>}
      <section style={card}><h2>Request substitute coverage</h2><form onSubmit={submit}>
        <label>Start date<input style={input} type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}/></label>
        <label>End date<input style={input} type="date" required min={form.startDate} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}/></label>
        <label>Leave type<select style={input} value={form.leaveType} onChange={e => setForm({ ...form, leaveType: e.target.value })}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button disabled={busy || !form.startDate || !form.endDate || form.endDate < form.startDate}>Request coverage</button>
      </form></section>
      <section><h2>My leave applications</h2>{leaves.length === 0 && <p>No leave applications yet.</p>}
        {leaves.map(l => { const rs = l.substituteRequests || []; const count = rs.filter(covered).length; return <article key={l._id} style={card}>
          <strong>{date(l.startDate)} to {date(l.endDate)} · {l.leaveType}</strong><p>Status: {l.status} · Coverage: {count}/{rs.length} periods</p>
          {rs.map(r => <p key={r._id} style={{ fontSize: 13 }}>{date(r.date)} · Period {r.periodNumber} · {r.subject} · {r.className} — {r.substituteTeacher?.name || (r.substituteTeacher ? 'Assigned' : 'Awaiting substitute')}</p>)}
          {l.status === 'substitute_confirmed' && <div><label>Reason<textarea style={input} value={reasonFor(l._id)} onChange={e => setReason(l._id, e.target.value)}/></label><button disabled={busy || !reasonFor(l._id).trim()} onClick={() => act(() => API.patch(`/leaves/${l._id}/details`, { reason: reasonFor(l._id) }))}>Submit leave application</button></div>}
          {l.status === 'rejected' && <p>Rejection reason: {l.rejectionReason || 'Not provided'}</p>}
        </article>; })}
      </section>
      <section><h2>Substitute requests for me</h2>{requests.length === 0 && <p>No open requests.</p>}
        {requests.map(r => <article key={r._id} style={card}><strong>{r.absentTeacher?.name} · {date(r.date)} · Period {r.periodNumber}</strong><p>{r.subject} · {r.className} · {r.startTime}–{r.endTime}</p><p>Leave: {date(r.leave?.startDate)} to {date(r.leave?.endDate)} · {r.leave?.leaveType}</p><button disabled={busy} onClick={() => act(() => API.patch(`/substitutes/${r._id}/accept`))}>Accept</button>{' '}<button disabled={busy} onClick={() => act(() => API.patch(`/substitutes/${r._id}/decline`))}>Decline</button></article>)}
      </section>
    </>}
    {role !== 'teacher' && <section><h2>Leave review</h2>{leaves.filter(l => l.status === (role === 'hod' ? 'submitted' : 'hod_approved')).map(l => <article key={l._id} style={card}>
      <strong>{l.teacher?.name} · {date(l.startDate)} to {date(l.endDate)}</strong><p>{l.leaveType} · {l.reason}</p><p>Coverage: {(l.substituteRequests || []).filter(covered).length}/{l.substituteRequests?.length || 0}</p>
      {(l.substituteRequests || []).map(r => <p key={r._id} style={{ fontSize: 13 }}>{date(r.date)} · Period {r.periodNumber} · {r.substituteTeacher?.name || 'Unassigned'}</p>)}
      <button disabled={busy} onClick={() => act(() => API.patch(`/leaves/${l._id}/${role === 'hod' ? 'hod-approve' : 'principal-approve'}`))}>Approve</button>{' '}
      <button disabled={busy} onClick={() => { const reason = window.prompt('Reason for rejection'); if (reason?.trim()) act(() => API.patch(`/leaves/${l._id}/reject`, { reason })); }}>Reject</button>
    </article>)}<h2>All leave statuses</h2>{leaves.map(l => <p key={l._id}>{l.teacher?.name} · {date(l.startDate)}–{date(l.endDate)} · {l.status}</p>)}
    <h2>Substitute assignments</h2>{requests.filter(r => r.status === (role === 'hod' ? 'accepted' : 'hod_approved')).map(r => <article key={r._id} style={card}><p>{r.substituteTeacher?.name} covers {r.absentTeacher?.name} · {date(r.date)} · Period {r.periodNumber}</p><button disabled={busy} onClick={() => act(() => API.patch(`/substitutes/${r._id}/${role === 'hod' ? 'hod-approve' : 'principal-approve'}`))}>Confirm assignment</button></article>)}
    </section>}
  </main>;
}
