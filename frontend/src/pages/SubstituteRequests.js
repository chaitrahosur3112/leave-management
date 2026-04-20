import { useEffect, useState } from 'react';
import API from '../api';
import toast from 'react-hot-toast';

export default function SubstituteRequests() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    API.get('/substitutes/my').then(r => setRequests(r.data));
  }, []);

  const accept = async (id) => {
    try {
      await API.patch(`/substitutes/${id}/accept`);
      toast.success('Accepted! HOD will review.');
      setRequests(requests.filter(r => r._id !== id));
    } catch (err) { toast.error('Error'); }
  };

  const reject = async (id) => {
    try {
      await API.patch(`/substitutes/${id}/reject`);
      toast.success('Declined');
      setRequests(requests.filter(r => r._id !== id));
    } catch (err) { toast.error('Error'); }
  };

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 20 }}>
      <h2>Substitute Period Requests</h2>
      {requests.length === 0 && <p>No pending requests for you.</p>}
      {requests.map(r => (
        <div key={r._id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <p><strong>Absent Teacher:</strong> {r.absentTeacher?.name}</p>
          <p><strong>Date:</strong> {new Date(r.date).toLocaleDateString()}</p>
          <p><strong>Period {r.period?.periodNumber}:</strong> {r.period?.startTime} - {r.period?.endTime}</p>
          <p><strong>Subject:</strong> {r.period?.subject} | <strong>Class:</strong> {r.period?.className}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button onClick={() => accept(r._id)}
              style={{ padding: '8px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6 }}>
              Accept
            </button>
            <button onClick={() => reject(r._id)}
              style={{ padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6 }}>
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}