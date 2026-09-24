import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../../api/public';
import Header from '../../components/Header';
import { translations } from '../../locales/translations';

export default function CheckIn() {
  const { officeId } = useParams();
  const navigate = useNavigate();

  const [lang, setLang] = useState('en');
  const t = translations[lang];

  const [officeData, setOfficeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [serviceId, setServiceId] = useState('');
  const [clientName, setClientName] = useState('');
  const [isPriority, setIsPriority] = useState(false);

  useEffect(() => {
    async function fetchOffice() {
      try {
        setLoading(true);
        setError('');
        const data = await publicApi.getOfficeDetail(officeId);
        setOfficeData(data);
      } catch (err) {
        setError(err.message || 'Office not found or currently unavailable.');
      } finally {
        setLoading(false);
      }
    }
    if (officeId) {
      fetchOffice();
    }
  }, [officeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!serviceId) {
      setError('Please select a service to proceed.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await publicApi.checkin({
        office: Number(officeId),
        service: Number(serviceId),
        client_name: clientName,
        is_priority: isPriority,
      });

      // Redirect to client live ticket
      navigate(`/t/${res.ticket_token}`);
    } catch (err) {
      setError(err.message || 'Check-in failed. Please try again or ask DOLE staff for assistance.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Loading DOLE office information...</p>
      </div>
    );
  }

  if (error && !officeData) {
    return (
      <div style={{ minHeight: '100vh', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: '480px', textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: 'var(--dole-red)', marginBottom: '0.5rem' }}>Office Unavailable</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={() => window.location.reload()} className="btn btn-outline">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        lang={lang}
        setLang={setLang}
        title={officeData?.office?.name}
        subtitle="Department of Labor and Employment"
      />

      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem',
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <img
              src="/dolelogo.png"
              alt="DOLE Logo"
              className="dole-logo-img"
              style={{ width: '64px', height: '64px', margin: '0 auto 0.75rem', display: 'block' }}
            />
            <span className="badge badge-serving" style={{ marginBottom: '0.5rem' }}>
              🏛️ {officeData?.office?.code} Check-in
            </span>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {t.checkin_title}
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {t.checkin_subtitle}
            </p>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'var(--dole-red-light)',
              border: '1px solid #fecaca',
              color: 'var(--dole-red)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.9rem',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label>{t.office_label}</label>
              <input
                type="text"
                disabled
                value={officeData?.office?.name || ''}
                style={{ backgroundColor: '#f8fafc', color: '#475569', cursor: 'not-allowed' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="service-select">{t.service_label} *</label>
              <select
                id="service-select"
                required
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                <option value="">{t.select_service}</option>
                {officeData?.services?.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="client-name">{t.name_label}</label>
              <input
                id="client-name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={t.name_placeholder}
              />
            </div>

            <div style={{
              backgroundColor: isPriority ? 'var(--dole-gold-light)' : '#f8fafc',
              border: isPriority ? '1px solid #fde68a' : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1.75rem',
              transition: 'all 0.2s ease',
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={isPriority}
                  onChange={(e) => setIsPriority(e.target.checked)}
                  style={{ width: '22px', height: '22px', minHeight: 'unset', marginTop: '2px', accentColor: 'var(--dole-gold-dark)' }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {t.priority_label}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {t.priority_subtext}
                  </div>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-lg w-full"
            >
              {submitting ? t.submitting : t.get_ticket_btn}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
