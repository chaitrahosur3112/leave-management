import { useState } from 'react';
import API from '../api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ApplyLeave() {

  const [form, setForm] = useState({
    startDate: "",
    endDate: "",
    reason: "",
    leaveType: "casual",
  });

  const [msg, setMsg] = useState("");
  const [leaves, setLeaves] = useState([]);
  const [view, setView] = useState("apply");

  const navigate = useNavigate();

  const applyLeave = async () => {
    try {
      if (!form.startDate || !form.endDate || !form.reason) {
        setMsg('Please fill all fields');
        return;
      }

      const response = await API.post('/leaves', {
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
        leaveType: form.leaveType || 'casual',
      });

      setMsg('Leave applied successfully!');

      const updated = await API.get('/leaves/my');
      setLeaves(updated.data);

      setView('dashboard');

    } catch (err) {
      const errMsg = err.response?.data?.message || 'Something went wrong';
      setMsg('Error: ' + errMsg);
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/leaves', form);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Error');
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '60px auto', padding: 24, border: '1px solid #ddd', borderRadius: 10 }}>
      <h2>Apply for Leave</h2>

      <form onSubmit={handleSubmit}> {/* ✅ FIXED */}
        <label>Start Date</label>
        <input type="date" value={form.startDate}
          onChange={e => setForm({ ...form, startDate: e.target.value })}
          style={{ width: '100%', padding: 8, marginBottom: 12 }} />

        <label>End Date</label>
        <input type="date" value={form.endDate}
          onChange={e => setForm({ ...form, endDate: e.target.value })}
          style={{ width: '100%', padding: 8, marginBottom: 12 }} />

        <label>Leave Type</label>
        <select value={form.leaveType}
          onChange={e => setForm({ ...form, leaveType: e.target.value })}
          style={{ width: '100%', padding: 8, marginBottom: 12 }}>
          <option value="casual">Casual</option>
          <option value="sick">Sick</option>
          <option value="emergency">Emergency</option>
        </select>

        <label>Reason</label>
        <textarea value={form.reason}
          onChange={e => setForm({ ...form, reason: e.target.value })}
          style={{ width: '100%', padding: 8, marginBottom: 16 }} rows={3} />

        <button type="submit"
          style={{ width: '100%', padding: 10, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6 }}>
          Submit Leave
        </button>
      </form>

      <button onClick={() => navigate('/')}
        style={{ width: '100%', marginTop: 8, padding: 10 }}>
        Cancel
      </button>
    </div>
  );
}