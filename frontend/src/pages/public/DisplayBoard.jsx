import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '../../api/public';
import { translations } from '../../locales/translations';
import { playAirportChime, getAudioContext } from '../../utils/airportChime';

const fallbackServiceDescriptions = {
  sena: 'Conciliation-mediation of labor issues, disputes, and worker grievances.',
  aep: 'Employment permit processing for foreign nationals.',
  tupad: 'Emergency community employment assistance for displaced workers.',
  livelihood: 'Grants and enterprise development support for self-employment.',
  dilp: 'Grants and enterprise development support for self-employment.',
  spes: 'Youth employment assistance during academic breaks.',
  '1020': 'Registration of establishments under OSH standards.',
  cshp: 'Construction safety and health program evaluation & approval.',
  inspection: 'Compliance verification for general labor standards.',
  child: 'Working child permit processing under child labor laws.',
  contractor: 'Contractor & subcontractor registration under D.O. 174.',
};

function getFallbackDesc(serviceName) {
  if (!serviceName) return '';
  const s = serviceName.toLowerCase();
  for (const [key, desc] of Object.entries(fallbackServiceDescriptions)) {
    if (s.includes(key)) return desc;
  }
  return 'Frontline public service, inquiry assistance, and document processing.';
}

export default function DisplayBoard() {
  const { officeId } = useParams();
  const [lang, setLang] = useState('en');
  const t = translations[lang];

  const [displayData, setDisplayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const prevServingRef = useRef([]);

  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    if (nextState) {
      // Resume audio context on user gesture and play sample airport chime
      getAudioContext();
      playAirportChime();
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchDisplay() {
      try {
        const data = await publicApi.getDisplayBoard(officeId);
        if (isMounted) {
          // Check if new queue number called or re-called to chime
          if (soundEnabled && prevServingRef.current.length > 0) {
            const prevKeys = prevServingRef.current.map(s => `${s.queue_no}-${s.called_at || ''}`);
            const hasNew = data.serving?.some(s => !prevKeys.includes(`${s.queue_no}-${s.called_at || ''}`));
            if (hasNew) {
              playAirportChime();
            }
          }
          prevServingRef.current = data.serving || [];
          setDisplayData(data);
          setError('');
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Error fetching display data.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchDisplay();
    const interval = setInterval(fetchDisplay, 5000); // 5s polling mandated by §1

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [officeId, soundEnabled]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ fontSize: '2rem' }}>Loading Display Board...</h1>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0f1d',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-ui)',
      padding: '1.5rem 2rem',
    }}>
      {/* Top Banner */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        paddingBottom: '1.25rem',
        marginBottom: '2rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <img
            src="/dolelogo.png"
            alt="DOLE Official Seal"
            style={{ width: '76px', height: '76px', objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}
          />
          <div>
            <div style={{
              fontSize: '1rem',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--dole-gold)',
            }}>
              Republic of the Philippines · DOLE
            </div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
              {displayData?.office?.name}
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleToggleSound}
            className="btn btn-outline btn-sm"
            style={{
              color: '#ffffff',
              borderColor: soundEnabled ? 'var(--dole-gold)' : 'rgba(255,255,255,0.2)',
              backgroundColor: soundEnabled ? 'rgba(217, 119, 6, 0.25)' : 'transparent',
              fontWeight: 600,
            }}
            title={soundEnabled ? 'Click to mute airport chime' : 'Click to enable airport announcement chime'}
          >
            {soundEnabled ? '🔔 Airport Chime ON' : '🔕 Airport Chime OFF'}
          </button>
          {soundEnabled && (
            <button
              onClick={() => {
                getAudioContext();
                playAirportChime();
              }}
              className="btn btn-outline btn-sm"
              style={{
                color: 'var(--dole-gold)',
                borderColor: 'rgba(217, 119, 6, 0.5)',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
              }}
              title="Test airport chime on speakers"
            >
              ▶ Test Chime
            </button>
          )}
          <button
            onClick={() => setLang(lang === 'en' ? 'fil' : 'en')}
            className="btn btn-outline btn-sm"
            style={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            🌐 {lang === 'en' ? 'Filipino' : 'English'}
          </button>
          <button
            onClick={toggleFullScreen}
            className="btn btn-outline btn-sm"
            style={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            ⛶ Fullscreen
          </button>
        </div>
      </header>

      {/* Main Grid: Serving Counters & Next Queue */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '2.2fr 1fr',
        gap: '2rem',
      }}>
        {/* Left Side: NOW SERVING */}
        <section style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--dole-gold)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'pulse 1.5s infinite' }} />
            {t.display_title}
          </div>

          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: displayData?.serving?.length > 2 ? 'repeat(2, 1fr)' : '1fr',
            gap: '1.25rem',
          }}>
            {displayData?.serving?.length > 0 ? (
              displayData.serving.map((item, idx) => (
                <div key={idx} style={{
                  backgroundColor: '#161e31',
                  borderRadius: '16px',
                  border: '2px solid rgba(3, 5, 186, 0.6)',
                  padding: '1.75rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  <div style={{
                    fontSize: '1.35rem',
                    fontWeight: 800,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    {item.counter}
                  </div>
                  <div className="mono" style={{
                    fontSize: displayData?.serving?.length > 2 ? '4.25rem' : '5.25rem',
                    fontWeight: 900,
                    color: 'var(--dole-gold)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                    margin: '0.35rem 0',
                    textShadow: '0 0 30px rgba(255, 198, 3, 0.35)',
                  }}>
                    {item.queue_no}
                  </div>

                  {item.service_name && (
                    <div style={{
                      marginTop: '0.65rem',
                      textAlign: 'center',
                      maxWidth: '92%',
                      padding: '0.6rem 1rem',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}>
                      <div style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: '#f8fafc',
                        letterSpacing: '-0.01em',
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#3b82f6',
                          flexShrink: 0,
                        }} />
                        <span>{item.service_name}</span>
                      </div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#94a3b8',
                        lineHeight: 1.35,
                        fontWeight: 400,
                      }}>
                        {item.service_description || getFallbackDesc(item.service_name)}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{
                gridColumn: '1 / -1',
                backgroundColor: '#161e31',
                borderRadius: '16px',
                border: '1px dashed rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: '1.5rem',
                fontWeight: 600,
              }}>
                {t.no_active_serving}
              </div>
            )}
          </div>
        </section>

        {/* Right Side: NEXT IN LINE */}
        <section style={{
          backgroundColor: '#111827',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#93c5fd',
            marginBottom: '1rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '0.75rem',
          }}>
            {t.next_numbers}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
            {displayData?.next?.length > 0 ? (
              displayData.next.map((num, idx) => (
                <div key={idx} style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '10px',
                  padding: '1rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderLeft: num.startsWith('P-') ? '5px solid var(--dole-gold)' : '5px solid #3b82f6',
                }}>
                  <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 600 }}>
                    #{idx + 1}
                  </span>
                  <span className="mono" style={{ fontSize: '2rem', fontWeight: 800, color: num.startsWith('P-') ? 'var(--dole-gold)' : '#ffffff' }}>
                    {num}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: '#64748b', marginTop: '2rem', fontSize: '1.1rem' }}>
                {t.waiting_empty}
              </div>
            )}
          </div>
        </section>
      </div>

      <footer style={{
        marginTop: '1.5rem',
        paddingTop: '1rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.85rem',
        color: '#64748b',
      }}>
        <span>DOLE Client Transaction Monitoring System (CTMS)</span>
        <span>Display updates automatically every 5 seconds</span>
      </footer>
    </div>
  );
}
