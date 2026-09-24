import React, { useState, useEffect, useCallback } from 'react';
import { staffApi } from '../../api/staff';
import { publicApi } from '../../api/public';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import Modal from '../../components/Modal';
import PrintSlip from '../../components/PrintSlip';

export default function StaffQueue() {
  const { user } = useAuth();

  const [selectedOffice, setSelectedOffice] = useState(() => localStorage.getItem('ctms_staff_office') || '');
  const [selectedCounter, setSelectedCounter] = useState(() => localStorage.getItem('ctms_staff_counter') || '');

  const [queueData, setQueueData] = useState({ waiting: [], serving: [], counters: [], office: null });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Walk-in modal state
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [officeServices, setOfficeServices] = useState([]);
  const [walkinService, setWalkinService] = useState('');
  const [walkinName, setWalkinName] = useState('');
  const [walkinPriority, setWalkinPriority] = useState(false);

  // Slip modal state
  const [printedTx, setPrintedTx] = useState(null);

  // Auto-select first office if none chosen
  useEffect(() => {
    if (!selectedOffice && user?.assigned_offices?.length > 0) {
      const firstId = String(user.assigned_offices[0].id);
      setSelectedOffice(firstId);
      localStorage.setItem('ctms_staff_office', firstId);
    }
  }, [user, selectedOffice]);

  // Persist selections
  const handleOfficeChange = (e) => {
    const val = e.target.value;
    setSelectedOffice(val);
    localStorage.setItem('ctms_staff_office', val);
    setSelectedCounter('');
    localStorage.removeItem('ctms_staff_counter');
  };

  const handleCounterChange = (e) => {
    const val = e.target.value;
    setSelectedCounter(val);
    localStorage.setItem('ctms_staff_counter', val);
  };

  // Fetch queue data
  const fetchQueue = useCallback(async () => {
    if (!selectedOffice) return;
    try {
      const data = await staffApi.getQueue(selectedOffice, selectedCounter);
      setQueueData(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Error loading queue.');
    } finally {
      setLoading(false);
    }
  }, [selectedOffice, selectedCounter]);

  // Polling every 3 seconds (mandated by §1 hard requirements)
  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Fetch office services for walkin registration
  useEffect(() => {
    if (showWalkinModal && selectedOffice) {
      publicApi.getOfficeDetail(selectedOffice)
        .then(res => setOfficeServices(res.services || []))
        .catch(() => {});
    }
  }, [showWalkinModal, selectedOffice]);

  // Actions
  const handleCallNext = async () => {
    if (!selectedOffice || !selectedCounter) {
      setError('Please select both your Office and Window Counter to call next client.');
      return;
    }
    try {
      setActionLoading(true);
      setError('');
      const called = await staffApi.callNext(selectedOffice, selectedCounter);
      if (!called) {
        setError('No waiting clients currently in the queue.');
      } else {
        await fetchQueue();
      }
    } catch (err) {
      setError(err.message || 'Failed to call next client.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (txId, action, payload = {}) => {
    try {
      setActionLoading(true);
      setError('');
      await staffApi.transactionAction(txId, action, payload);
      await fetchQueue();
    } catch (err) {
      setError(err.message || `Failed to perform ${action}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWalkinSubmit = async (e) => {
    e.preventDefault();
    if (!walkinService) return;
    try {
      setActionLoading(true);
      setError('');
      const newTx = await staffApi.createWalkin({
        office: Number(selectedOffice),
        service: Number(walkinService),
        client_name: walkinName,
        is_priority: walkinPriority,
      });
      setShowWalkinModal(false);
      setWalkinName('');
      setWalkinService('');
      setWalkinPriority(false);
      setPrintedTx(newTx);
      await fetchQueue();
    } catch (err) {
      setError(err.message || 'Failed to register walk-in.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {/* Top Control Bar: Office & Counter Selectors + Call Next + Walkin */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem' }}>Assigned Office</label>
                <select
                  value={selectedOffice}
                  onChange={handleOfficeChange}
                  style={{ minWidth: '240px', minHeight: '44px' }}
                >
                  {user?.assigned_offices?.map(off => (
                    <option key={off.id} value={off.id}>{off.name} ({off.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem' }}>Your Counter / Window</label>
                <select
                  value={selectedCounter}
                  onChange={handleCounterChange}
                  style={{ minWidth: '200px', minHeight: '44px' }}
                >
                  <option value="">-- All Counters --</option>
                  {queueData.counters?.map(cnt => (
                    <option key={cnt.id} value={cnt.id}>{cnt.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => setShowWalkinModal(true)}
                className="btn btn-outline"
                style={{ minHeight: '46px' }}
              >
                ➕ Walk-in Registration
              </button>

              <button
                onClick={handleCallNext}
                disabled={actionLoading || !selectedCounter}
                className="btn btn-primary btn-lg"
                style={{ minHeight: '46px', fontWeight: 800, padding: '0.75rem 1.75rem' }}
              >
                📢 Call Next Client
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--dole-red-light)',
            border: '1px solid #fecaca',
            color: 'var(--dole-red)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {/* 2-Column Split: Currently Serving vs Waiting Queue */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: '1.5rem',
        }}>
          {/* Currently Serving Column */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                🔔 Now Serving ({queueData.serving?.length || 0})
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {queueData.serving?.length > 0 ? (
                queueData.serving.map(tx => (
                  <div key={tx.id} className="card" style={{
                    borderLeft: '6px solid var(--dole-blue)',
                    padding: '1.25rem',
                  }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
                      <div className="flex items-center gap-2">
                        <span className="mono" style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--dole-blue)' }}>
                          {tx.queue_no}
                        </span>
                        {tx.is_priority && (
                          <span className="badge badge-priority">Priority</span>
                        )}
                        <span className="badge badge-serving">
                          {tx.counter_name || 'Window'}
                        </span>
                      </div>
                      <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {tx.transaction_no}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                      <strong>Service:</strong> {tx.service_name}
                      {tx.client_name && (
                        <div><strong>Client:</strong> {tx.client_name}</div>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Called at: {tx.called_at ? new Date(tx.called_at).toLocaleTimeString() : '--'}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      borderTop: 'var(--border-hairline)',
                      paddingTop: '0.75rem',
                    }}>
                      <button
                        onClick={() => handleAction(tx.id, 'done')}
                        disabled={actionLoading}
                        className="btn btn-success btn-sm"
                        style={{ fontWeight: 700 }}
                      >
                        ✓ Mark Done (Unlocks Survey)
                      </button>

                      <button
                        onClick={() => handleAction(tx.id, 'recall')}
                        disabled={actionLoading}
                        className="btn btn-outline btn-sm"
                      >
                        🔄 Recall
                      </button>

                      <button
                        onClick={() => handleAction(tx.id, 'requeue')}
                        disabled={actionLoading}
                        className="btn btn-outline btn-sm"
                      >
                        ↩ Return to Queue
                      </button>

                      <button
                        onClick={() => handleAction(tx.id, 'no-show')}
                        disabled={actionLoading}
                        className="btn btn-danger btn-sm"
                      >
                        ✕ No-Show
                      </button>

                      <button
                        onClick={() => handleAction(tx.id, 'cancel')}
                        disabled={actionLoading}
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--dole-red)' }}
                      >
                        Cancel
                      </button>

                      <button
                        onClick={() => setPrintedTx(tx)}
                        className="btn btn-outline btn-sm"
                      >
                        🖨️ Slip
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card text-center" style={{ padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>☕</div>
                  <p style={{ fontWeight: 600 }}>No clients currently being served.</p>
                  <p style={{ fontSize: '0.85rem' }}>Select your counter and click <strong>Call Next Client</strong> above.</p>
                </div>
              )}
            </div>
          </section>

          {/* Waiting Queue Column */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                ⏳ Waiting in Line ({queueData.waiting?.length || 0})
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {queueData.waiting?.length > 0 ? (
                queueData.waiting.map(tx => (
                  <div key={tx.id} className="card" style={{
                    padding: '1rem',
                    borderLeft: tx.is_priority ? '5px solid var(--dole-gold)' : '5px solid #cbd5e1',
                  }}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="mono" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                          {tx.queue_no}
                        </span>
                        {tx.is_priority && (
                          <span className="badge badge-priority">Priority</span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (!selectedCounter) {
                            setError('Please select a Counter first.');
                            return;
                          }
                          handleAction(tx.id, 'call', { counter: selectedCounter });
                        }}
                        disabled={actionLoading || !selectedCounter}
                        className="btn btn-primary btn-sm"
                        style={{ minHeight: '32px' }}
                      >
                        Call
                      </button>
                    </div>

                    <div style={{ fontSize: '0.85rem', marginTop: '0.4rem', color: 'var(--text-secondary)' }}>
                      <strong>{tx.service_name}</strong>
                      {tx.client_name && <div>Client: {tx.client_name}</div>}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Checked in: {new Date(tx.checked_in_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card text-center" style={{ padding: '2.5rem 1.5rem', color: 'var(--text-muted)' }}>
                  <p style={{ fontWeight: 600 }}>Queue is clear!</p>
                  <p style={{ fontSize: '0.85rem' }}>No clients waiting in line right now.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Walk-in Register Modal */}
      <Modal
        isOpen={showWalkinModal}
        onClose={() => setShowWalkinModal(false)}
        title="Walk-in Client Registration"
      >
        <form onSubmit={handleWalkinSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label>Select Service *</label>
            <select
              required
              value={walkinService}
              onChange={(e) => setWalkinService(e.target.value)}
            >
              <option value="">-- Select Service --</option>
              {officeServices.map(svc => (
                <option key={svc.id} value={svc.id}>{svc.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label>Client Name (Optional)</label>
            <input
              type="text"
              value={walkinName}
              onChange={(e) => setWalkinName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={walkinPriority}
                onChange={(e) => setWalkinPriority(e.target.checked)}
                style={{ width: '20px', height: '20px', minHeight: 'unset' }}
              />
              <span style={{ fontWeight: 600 }}>Priority Lane (Senior / PWD / Pregnant)</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setShowWalkinModal(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="btn btn-primary"
            >
              Issue Ticket & Slip
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Slip Modal */}
      <Modal
        isOpen={!!printedTx}
        onClose={() => setPrintedTx(null)}
        title="Queue Slip"
      >
        <PrintSlip transaction={printedTx} onClose={() => setPrintedTx(null)} />
      </Modal>
    </div>
  );
}
