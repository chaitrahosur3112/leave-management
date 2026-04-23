import { useEffect, useState, useCallback } from 'react';
import API from '../api'
// ── API helper — uses proxy (package.json "proxy": "http://localhost:5000") ──
const BASE = '/api';

// ── Helpers ────────────────────────────────────────────────────────
const cap   = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const fmtD  = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const dayOf = dt => new Date(dt+'T12:00:00').toLocaleDateString('en-US',{weekday:'long'});
const nDays = (s,e) => Math.max(1,Math.ceil((new Date(e)-new Date(s))/86400000)+1);

const STATUS = {
  pending:             {label:'Pending',             bg:'#FAEEDA',color:'#633806'},
  substitute_assigned: {label:'Substitute assigned', bg:'#DBEAFE',color:'#1E40AF'},
  hod_approved:        {label:'HOD approved',        bg:'#EDE9FE',color:'#4C1D95'},
  principal_approved:  {label:'Fully approved',      bg:'#D1FAE5',color:'#065F46'},
  rejected:            {label:'Rejected',             bg:'#FEE2E2',color:'#7F1D1D'},
};

// ── Mini components ────────────────────────────────────────────────
const Badge = ({s}) => {
  const st = STATUS[s]||{label:s,bg:'#f0f0f0',color:'#444'};
  return <span style={{padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,
    background:st.bg,color:st.color,whiteSpace:'nowrap'}}>{st.label}</span>;
};

const Btn = ({children,onClick,variant='outline',disabled,full}) => {
  const map = {
    primary:{bg:'#4F46E5',color:'#fff',   border:'none'},
    green:  {bg:'#D1FAE5',color:'#065F46',border:'1px solid #6EE7B7'},
    red:    {bg:'#FEE2E2',color:'#7F1D1D',border:'1px solid #FCA5A5'},
    blue:   {bg:'#DBEAFE',color:'#1E40AF',border:'1px solid #93C5FD'},
    outline:{bg:'#fff',   color:'#374151',border:'1px solid #E5E7EB'},
  };
  const v=map[variant]||map.outline;
  return <button onClick={onClick} disabled={disabled} style={{
    padding:variant==='primary'?'10px 18px':'7px 14px',
    borderRadius:8,cursor:disabled?'not-allowed':'pointer',
    fontSize:13,fontWeight:700,opacity:disabled?0.6:1,
    background:v.bg,color:v.color,border:v.border,
    width:full?'100%':'auto',transition:'opacity .15s',
  }}>{children}</button>;
};

const Card=({children,style})=>(
  <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:12,padding:20,...style}}>
    {children}
  </div>
);
const Empty=({text})=>(
  <p style={{textAlign:'center',color:'#9CA3AF',fontSize:13,padding:'28px 0',margin:0}}>{text}</p>
);
const PRow=({p})=>(
  <div style={{display:'flex',alignItems:'center',gap:10,background:'#F9FAFB',
    border:'1px solid #E5E7EB',borderRadius:8,padding:'9px 12px',marginBottom:6}}>
    <div style={{width:28,height:28,borderRadius:'50%',background:'#EDE9FE',color:'#4C1D95',
      display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:12,fontWeight:700,flexShrink:0}}>{p.periodNumber}</div>
    <div style={{flex:1,fontWeight:700,fontSize:13}}>{p.subject}</div>
    <div style={{fontSize:12,color:'#6B7280'}}>Class {p.className}</div>
    <div style={{fontSize:12,color:'#6B7280',background:'#fff',border:'1px solid #E5E7EB',
      padding:'2px 8px',borderRadius:6,whiteSpace:'nowrap'}}>
      {p.startTime}–{p.endTime}
    </div>
  </div>
);
const inp={width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid #D1D5DB',
  background:'#F9FAFB',fontSize:14,color:'#111',outline:'none',boxSizing:'border-box'};
const Lbl=({text})=>(
  <label style={{display:'block',fontSize:11,fontWeight:700,color:'#6B7280',
    textTransform:'uppercase',letterSpacing:'.05em',marginBottom:5}}>{text}</label>
);

// ── AUTH WALL ──────────────────────────────────────────────────────
function LoginPrompt({onLogin}) {
  const [email,setEmail]   = useState('');
  const [pw,setPw]         = useState('');
  const [err,setErr]       = useState('');
  const [busy,setBusy]     = useState(false);

  async function doLogin() {
    if (!email||!pw) {setErr('Enter email and password');return;}
    setBusy(true); setErr('');
    try {
      const res  = await fetch('/api/auth/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:email.trim().toLowerCase(),password:pw}),
      });
      const data = await res.json();
      if (!res.ok) {setErr(data.message||'Login failed');setBusy(false);return;}
      localStorage.setItem('token', data.token);
      localStorage.setItem('user',  JSON.stringify(data.user));
      onLogin(data.user);
    } catch {
      setErr('Cannot reach backend. Run: cd backend && node server.js');
    } finally {setBusy(false);}
  }

  return (
    <div style={{maxWidth:400,margin:'80px auto',fontFamily:'-apple-system,sans-serif'}}>
      <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:16,padding:32}}>
        <h2 style={{fontSize:20,fontWeight:800,margin:'0 0 6px'}}>Leave Management</h2>
        <p style={{fontSize:13,color:'#6B7280',margin:'0 0 24px'}}>Sign in to continue</p>

        {err && (
          <div style={{background:'#FEE2E2',color:'#7F1D1D',border:'1px solid #FCA5A5',
            borderRadius:8,padding:'10px 14px',fontSize:13,fontWeight:500,marginBottom:16}}>
            {err}
          </div>
        )}

        <div style={{marginBottom:14}}>
          <Lbl text="Email" />
          <input type="email" style={inp} placeholder="ravi@school.com"
            value={email} onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&doLogin()} />
        </div>
        <div style={{marginBottom:20}}>
          <Lbl text="Password" />
          <input type="password" style={inp} placeholder="123456"
            value={pw} onChange={e=>setPw(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&doLogin()} />
        </div>
        <Btn variant="primary" onClick={doLogin} disabled={busy} full>
          {busy?'Signing in…':'Sign in'}
        </Btn>

        <div style={{marginTop:20,background:'#F9FAFB',border:'1px solid #E5E7EB',
          borderRadius:8,padding:'12px 14px',fontSize:12,color:'#6B7280'}}>
          <div style={{fontWeight:700,color:'#374151',marginBottom:6}}>Test accounts:</div>
          {[
            ['ravi@school.com',     '123456','Teacher'],
            ['hod@school.com',      '123456','HOD'],
            ['principal@school.com','123456','Principal'],
          ].map(([e,p,r])=>(
            <div key={e} style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{color:'#4F46E5',cursor:'pointer'}} onClick={()=>{setEmail(e);setPw(p);}}>
                {e}
              </span>
              <span style={{color:'#9CA3AF'}}>{r}</span>
            </div>
          ))}
          <div style={{marginTop:8,fontSize:11,color:'#9CA3AF'}}>Click an email to autofill</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
export default function TeacherLeaveDashboard() {
  const [user,    setUser]    = useState(null);
  const [ready,   setReady]   = useState(false);
  const [tab,     setTab]     = useState('dashboard');
  const [balance, setBalance] = useState(null);
  const [leaves,  setLeaves]  = useState([]);
  const [tt,      setTt]      = useState([]);
  const [subs,    setSubs]    = useState([]);
  const [allL,    setAllL]    = useState([]);
  const [allS,    setAllS]    = useState([]);
  const [form,    setForm]    = useState({startDate:'',endDate:'',reason:'',leaveType:'casual'});
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState({text:'',type:'ok'});

  const toast = useCallback((text,type='ok')=>{
    setMsg({text,type});
    setTimeout(()=>setMsg({text:'',type:'ok'}),5000);
  },[]);

  // ── Check existing session on mount ────────────────────────────
  useEffect(()=>{
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('token');
    if (stored && token) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.clear(); }
    }
    setReady(true);
  },[]);

  const loadTeacher = useCallback(async () => {
  console.log("LOAD TEACHER CALLED");

  try {
    const b = await API.get('/leaves/balance');
    const l = await API.get('/leaves/my');
    const t = await API.get('/timetable/my');
    const s = await API.get('/substitutes/my');

    console.log("RESPONSES:", b, l, t, s);

    setBalance(b.data);
    setLeaves(l.data);
    setTt(t.data);
    setSubs(s.data);

  } catch (e) {
    console.error("FULL ERROR:", e);

    if (e.response?.status === 401) {
      localStorage.clear();
      setUser(null);
    } else {
      toast(e.response?.data?.message || e.message, 'err');
    }
  }
}, [toast]);

  const loadAdmin = useCallback(async()=>{
    try {
      const [l, s] = await Promise.all([
      API.get('/leaves/all'),
      API.get('/substitutes/all'),
    ]);

      setAllL(l.data);
      setAllS(s.data);
    } catch(e){
      if (e.message==='AUTH_FAIL'||e.message==='NO_TOKEN') {
        localStorage.clear(); setUser(null);
      } else toast(e.message,'err');
    }
  },[toast]);

  useEffect(()=>{ if(user) loadTeacher(); },[user,loadTeacher]);
  useEffect(()=>{ if(user&&(tab==='hod'||tab==='principal')) loadAdmin(); },[tab,user,loadAdmin]);

  function logout() {
    localStorage.clear(); setUser(null); setBalance(null);
    setLeaves([]); setTt([]); setSubs([]); setAllL([]); setAllS([]);
    setTab('dashboard');
  }

  async function submitLeave() {
    const {startDate,endDate,reason,leaveType}=form;
    if (!startDate)     {toast('Please select a start date','err');return;}
    if (!endDate)       {toast('Please select an end date','err');return;}
    if (!reason.trim()) {toast('Please enter a reason','err');return;}
    if (new Date(endDate)<new Date(startDate)){toast('End date cannot be before start date','err');return;}
    setBusy(true);
    try {
      await API.post('/leaves', {startDate,endDate,reason: reason.trim(),leaveType});
      toast('Leave applied! Substitute requests sent.');
      setForm({startDate:'',endDate:'',reason:'',leaveType:'casual'});
      await loadTeacher();
      setTab('dashboard');
    } catch(e){toast(e.message||'Failed','err');}
    finally{setBusy(false);}
  }

  const doAccept  = async id=>{try{await API.patch(`/substitutes/${id}/accept`); toast('Accepted! HOD will review.'); setSubs(p=>p.filter(r=>r._id!==id));}catch(e){toast(e.message,'err');}};
  const doDecline = async id=>{try{await API.patch(`/substitutes/${id}/decline`);toast('Declined.');setSubs(p=>p.filter(r=>r._id!==id));}catch(e){toast(e.message,'err');}};
  const hodApprL  = async id=>{try{await API.patch(`/leaves/${id}/hod-approve`);       toast('HOD approved.');    setAllL(p=>p.map(l=>l._id===id?{...l,status:'hod_approved',hodApproval:true}:l));}catch(e){toast(e.message,'err');}};
  const hodRejectL= async id=>{try{await API.patch(`/leaves/${id}/reject`);             toast('Rejected.','err'); setAllL(p=>p.map(l=>l._id===id?{...l,status:'rejected'}:l));}catch(e){toast(e.message,'err');}};
  const hodApprS  = async id=>{try{await API.patch(`/substitutes/${id}/hod-approve`);   toast('Confirmed.');      setAllS(p=>p.map(r=>r._id===id?{...r,status:'hod_approved'}:r));}catch(e){toast(e.message,'err');}};
  const prApprL   = async id=>{try{await API.patch(`/leaves/${id}/principal-approve`);  toast('Fully approved. Balance deducted.'); setAllL(p=>p.map(l=>l._id===id?{...l,status:'principal_approved'}:l));}catch(e){toast(e.message,'err');}};
  const prRejectL = async id=>{try{await API.patch(`/eaves/${id}/reject`);             toast('Rejected.','err'); setAllL(p=>p.map(l=>l._id===id?{...l,status:'rejected'}:l));}catch(e){toast(e.message,'err');}};
  const prApprS   = async id=>{try{await API.patch(`/substitutes/${id}/principal-approve`);toast('Substitute approved.'); setAllS(p=>p.map(r=>r._id===id?{...r,status:'principal_approved'}:r));}catch(e){toast(e.message,'err');}};

  const coverDay = form.startDate ? tt.find(d=>d.dayOfWeek===dayOf(form.startDate)) : null;
  const rowS={display:'flex',alignItems:'flex-start',gap:12,padding:'12px 0',
    borderBottom:'1px solid #F3F4F6',flexWrap:'wrap'};

  // ── Not ready yet (checking localStorage) ─────────────────────
  if (!ready) return null;

  // ── Show login if no user ──────────────────────────────────────
  if (!user) return <LoginPrompt onLogin={u=>{setUser(u);}} />;

  // ── Main Dashboard ─────────────────────────────────────────────
  return (
    <div style={{maxWidth:920,margin:'0 auto',padding:'24px 16px',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',color:'#111'}}>

      {/* Toast */}
      {msg.text && (
        <div style={{padding:'12px 16px',borderRadius:10,marginBottom:16,
          fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:8,
          background:msg.type==='err'?'#FEE2E2':'#D1FAE5',
          color:msg.type==='err'?'#7F1D1D':'#065F46',
          border:`1px solid ${msg.type==='err'?'#FCA5A5':'#6EE7B7'}`,
        }}>
          <span style={{fontSize:16}}>{msg.type==='err'?'✕':'✓'}</span>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,margin:0}}>Leave Management</h1>
          <p style={{fontSize:13,color:'#6B7280',margin:'3px 0 0'}}>
            {user.name} &nbsp;·&nbsp;
            <span style={{textTransform:'capitalize',color:'#4F46E5',fontWeight:600}}>{user.role}</span>
          </p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {balance && (
            <div style={{background:'#EDE9FE',borderRadius:10,padding:'10px 18px',textAlign:'center'}}>
              <div style={{fontSize:28,fontWeight:800,color:'#4C1D95'}}>
                {(balance.firstHalfTotal-balance.firstHalfUsed)+(balance.secondHalfTotal-balance.secondHalfUsed)}
              </div>
              <div style={{fontSize:10,color:'#7C3AED',fontWeight:700,textTransform:'uppercase'}}>Leaves left</div>
            </div>
          )}
          <button onClick={logout} style={{padding:'8px 14px',borderRadius:8,border:'1px solid #E5E7EB',
            background:'#fff',color:'#374151',fontSize:13,fontWeight:600,cursor:'pointer'}}>
            Log out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:3,background:'#F3F4F6',borderRadius:10,
        padding:4,marginBottom:24,width:'fit-content',flexWrap:'wrap'}}>
        {[
          ['dashboard', 'Dashboard'],
          ['apply',     'Apply Leave'],
          ['substitutes',`Substitutes${subs.length?` (${subs.length})`:''}`],
          ['hod',       'HOD View'],
          ['principal', 'Principal View'],
        ].map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)} style={{
            padding:'9px 18px',borderRadius:8,border:'none',cursor:'pointer',
            fontSize:13,fontWeight:600,transition:'all .15s',
            background:tab===key?'#fff':'transparent',
            color:tab===key?'#4F46E5':'#6B7280',
            boxShadow:tab===key?'0 1px 4px rgba(0,0,0,.1)':'none',
          }}>{label}</button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab==='dashboard' && <>
        {balance ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
            {[
              {lbl:'Jan – Jun',val:balance.firstHalfTotal-balance.firstHalfUsed,
               sub:`${balance.firstHalfUsed} used of ${balance.firstHalfTotal}`,c:'#4F46E5'},
              {lbl:'Jul – Dec',val:balance.secondHalfTotal-balance.secondHalfUsed,
               sub:`${balance.secondHalfUsed} used of ${balance.secondHalfTotal}`,c:'#059669'},
              {lbl:'Total remaining',
               val:(balance.firstHalfTotal-balance.firstHalfUsed)+(balance.secondHalfTotal-balance.secondHalfUsed),
               sub:'of 15 this year',c:'#2563EB'},
            ].map((m,i)=>(
              <div key={i} style={{background:'#F9FAFB',borderRadius:10,padding:'16px 18px',
                borderLeft:`4px solid ${m.c}`}}>
                <div style={{fontSize:11,color:'#6B7280',textTransform:'uppercase',
                  letterSpacing:'.05em',marginBottom:6}}>{m.lbl}</div>
                <div style={{fontSize:32,fontWeight:800,color:'#111'}}>{m.val}</div>
                <div style={{fontSize:12,color:'#9CA3AF',marginTop:3}}>{m.sub}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{background:'#FEF3C7',border:'1px solid #FDE68A',borderRadius:10,
            padding:'14px 18px',marginBottom:20,fontSize:13,color:'#78350F',fontWeight:500}}>
            Loading balance… (make sure backend is running on port 5000)
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <Card>
            <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>Leave history</h3>
            {leaves.length===0 ? <Empty text="No leaves applied yet." />
              : leaves.map(l=>(
              <div key={l._id} style={rowS}>
                <div style={{flex:1,minWidth:140}}>
                  <div style={{fontWeight:700,fontSize:13}}>
                    {cap(l.leaveType)} leave
                    <span style={{fontWeight:400,color:'#6B7280',fontSize:12,marginLeft:6}}>
                      ({nDays(l.startDate,l.endDate)} day{nDays(l.startDate,l.endDate)>1?'s':''})
                    </span>
                  </div>
                  <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>
                    {fmtD(l.startDate)} → {fmtD(l.endDate)}
                  </div>
                  <div style={{fontSize:12,color:'#9CA3AF',marginTop:1}}>{l.reason}</div>
                </div>
                <Badge s={l.status} />
              </div>
            ))}
          </Card>
          <Card>
            <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>My timetable</h3>
            {tt.length===0 ? <Empty text="No timetable assigned yet." />
              : tt.map(day=>(
              <div key={day._id} style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:'#4F46E5',
                  textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>
                  {day.dayOfWeek}
                </div>
                {day.periods.map((p,i)=><PRow key={i} p={p} />)}
              </div>
            ))}
          </Card>
        </div>
      </>}

      {/* ── APPLY ── */}
      {tab==='apply' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start'}}>
          <Card>
            <h3 style={{fontSize:15,fontWeight:700,marginBottom:20}}>Apply for leave</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div style={{marginBottom:14}}>
                <Lbl text="Start date *" />
                <input type="date" style={inp} value={form.startDate}
                  onChange={e=>setForm({...form,startDate:e.target.value})} />
              </div>
              <div style={{marginBottom:14}}>
                <Lbl text="End date *" />
                <input type="date" style={inp} value={form.endDate}
                  onChange={e=>setForm({...form,endDate:e.target.value})} />
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <Lbl text="Leave type" />
              <select style={inp} value={form.leaveType}
                onChange={e=>setForm({...form,leaveType:e.target.value})}>
                <option value="casual">Casual</option>
                <option value="sick">Sick</option>
                <option value="emergency">Emergency</option>
                <option value="paternity/maternity">Patenity/Maternity</option>
              </select>
            </div>
            <div style={{marginBottom:20}}>
              <Lbl text="Reason *" />
              <textarea rows={4} style={{...inp,resize:'vertical'}}
                placeholder="Brief reason for your leave…"
                value={form.reason}
                onChange={e=>setForm({...form,reason:e.target.value})} />
            </div>
            <Btn variant="primary" onClick={submitLeave} disabled={busy} full>
              {busy?'Submitting…':'Submit leave application'}
            </Btn>
          </Card>
          <div style={{background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:12,padding:20}}>
            <h3 style={{fontSize:14,fontWeight:700,color:'#6B7280',marginBottom:14}}>Coverage preview</h3>
            {!form.startDate && (
              <p style={{fontSize:13,color:'#9CA3AF',textAlign:'center',padding:'20px 0'}}>
                Pick a start date to see which periods need coverage.
              </p>
            )}
            {form.startDate && !coverDay && (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:13,color:'#6B7280'}}>No periods on</div>
                <div style={{fontWeight:700,fontSize:15,marginTop:4}}>{dayOf(form.startDate)}</div>
                <div style={{fontSize:12,color:'#9CA3AF',marginTop:6}}>
                  You can still apply — no substitute requests needed.
                </div>
              </div>
            )}
            {coverDay && <>
              <div style={{fontSize:12,color:'#6B7280',marginBottom:12}}>
                Requests go to same-class teachers first. If all decline → sent to all free teachers.
              </div>
              {coverDay.periods.map((p,i)=><PRow key={i} p={p} />)}
            </>}
          </div>
        </div>
      )}

      {/* ── SUBSTITUTES ── */}
      {tab==='substitutes' && (
        <Card>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>Period coverage requests</h3>
          {subs.length===0 ? (
            <div style={{textAlign:'center',padding:'40px 0'}}>
              <div style={{fontSize:40,marginBottom:8}}>✓</div>
              <div style={{fontWeight:700}}>All clear!</div>
              <div style={{fontSize:13,color:'#9CA3AF',marginTop:4}}>No pending requests.</div>
            </div>
          ) : subs.map(r=>(
            <div key={r._id} style={{border:'1px solid #E5E7EB',borderRadius:10,
              padding:16,marginBottom:12,background:r.status==='open_all'?'#FFFBEB':'#fff'}}>
              <div style={{display:'flex',justifyContent:'space-between',
                alignItems:'flex-start',marginBottom:10}}>
                <div>
                  <div style={{fontWeight:700,fontSize:15}}>
                    Period {r.period?.periodNumber} — {r.period?.subject}
                  </div>
                  <div style={{fontSize:12,color:'#6B7280',marginTop:3}}>
                    Class {r.period?.className} · {r.period?.startTime}–{r.period?.endTime} · {fmtD(r.date)}
                  </div>
                </div>
                {r.status==='open_all' && (
                  <span style={{fontSize:11,fontWeight:700,background:'#FAEEDA',
                    color:'#633806',padding:'3px 10px',borderRadius:99,
                    border:'1px solid #FCD34D',whiteSpace:'nowrap'}}>Escalated</span>
                )}
              </div>
              <div style={{background:'#F9FAFB',border:'1px solid #E5E7EB',
                borderRadius:8,padding:'10px 14px',marginBottom:12}}>
                <div style={{fontSize:11,color:'#6B7280',marginBottom:3}}>ABSENT TEACHER</div>
                <div style={{fontWeight:700}}>{r.absentTeacher?.name}</div>
              </div>
              {r.status==='open_all' && (
                <div style={{fontSize:12,color:'#92400E',fontWeight:600,marginBottom:10}}>
                  ⚠ All same-class teachers declined — open to all free teachers
                </div>
              )}
              <div style={{display:'flex',gap:8}}>
                <Btn variant="green" onClick={()=>doAccept(r._id)}>✓ Accept</Btn>
                <Btn variant="red"   onClick={()=>doDecline(r._id)}>✕ Decline</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* ── HOD VIEW ── */}
      {tab==='hod' && <>
        <Card style={{marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>Leave applications</h3>
          {allL.filter(l=>['pending','substitute_assigned'].includes(l.status)).length===0
            ? <Empty text="No leaves pending." />
            : allL.filter(l=>['pending','substitute_assigned'].includes(l.status)).map(l=>(
            <div key={l._id} style={rowS}>
              <div style={{flex:1,minWidth:140}}>
                <div style={{fontWeight:700,fontSize:13}}>{l.teacher?.name} — {cap(l.leaveType)} leave</div>
                <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>
                  {fmtD(l.startDate)} → {fmtD(l.endDate)} · {l.reason}
                </div>
                <div style={{fontSize:11,marginTop:4,fontWeight:700,
                  color:l.status==='substitute_assigned'?'#065F46':'#92400E'}}>
                  {l.status==='substitute_assigned'?'✓ Substitute assigned':'⏳ Awaiting substitute'}
                </div>
              </div>
              <Badge s={l.status} />
              {l.status==='substitute_assigned' && (
                <div style={{display:'flex',gap:6}}>
                  <Btn variant="blue" onClick={()=>hodApprL(l._id)}>Approve</Btn>
                  <Btn variant="red"  onClick={()=>hodRejectL(l._id)}>Reject</Btn>
                </div>
              )}
            </div>
          ))}
        </Card>
        <Card>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>Substitute assignments to confirm</h3>
          {allS.filter(r=>r.status==='accepted').length===0
            ? <Empty text="No assignments to confirm." />
            : allS.filter(r=>r.status==='accepted').map(r=>(
            <div key={r._id} style={rowS}>
              <div style={{flex:1,minWidth:140}}>
                <div style={{fontWeight:700,fontSize:13}}>
                  {r.substituteTeacher?.name} covers {r.absentTeacher?.name}
                </div>
                <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>
                  Period {r.period?.periodNumber} · {r.period?.subject} · Class {r.period?.className}
                </div>
              </div>
              <Btn variant="blue" onClick={()=>hodApprS(r._id)}>Confirm</Btn>
            </div>
          ))}
        </Card>
      </>}

      {/* ── PRINCIPAL VIEW ── */}
      {tab==='principal' && <>
        <Card style={{marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>HOD-approved leaves — final approval</h3>
          {allL.filter(l=>l.status==='hod_approved').length===0
            ? <Empty text="No leaves awaiting final approval." />
            : allL.filter(l=>l.status==='hod_approved').map(l=>(
            <div key={l._id} style={rowS}>
              <div style={{flex:1,minWidth:140}}>
                <div style={{fontWeight:700,fontSize:13}}>{l.teacher?.name} — {cap(l.leaveType)} leave</div>
                <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>
                  {fmtD(l.startDate)} → {fmtD(l.endDate)} · {l.reason}
                </div>
                <div style={{fontSize:11,color:'#4F46E5',fontWeight:700,marginTop:3}}>✓ HOD approved</div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <Btn variant="green" onClick={()=>prApprL(l._id)}>Final approve</Btn>
                <Btn variant="red"   onClick={()=>prRejectL(l._id)}>Reject</Btn>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>HOD-confirmed substitutes — final approval</h3>
          {allS.filter(r=>r.status==='hod_approved').length===0
            ? <Empty text="No substitutes awaiting final approval." />
            : allS.filter(r=>r.status==='hod_approved').map(r=>(
            <div key={r._id} style={rowS}>
              <div style={{flex:1,minWidth:140}}>
                <div style={{fontWeight:700,fontSize:13}}>
                  {r.substituteTeacher?.name} covers {r.absentTeacher?.name}
                </div>
                <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>
                  Period {r.period?.periodNumber} · {r.period?.subject} · Class {r.period?.className}
                </div>
              </div>
              <Btn variant="green" onClick={()=>prApprS(r._id)}>Approve</Btn>
            </div>
          ))}
        </Card>
      </>}
    </div>
  );
}
