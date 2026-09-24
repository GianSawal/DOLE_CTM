import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function StaffLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await login(username, password);
      navigate('/staff/queue');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-ground)',
    }}>
      <div className="dole-tricolor-bar" />
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}>
        <div className="card" style={{
          width: '100%',
          maxWidth: '440px',
          padding: '2.5rem 2.25rem',
          boxShadow: 'var(--shadow-lg)',
          borderTop: '5px solid var(--dole-blue)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <img
              src="/dolelogo.png"
              alt="DOLE Official Seal"
              className="dole-logo-img"
              style={{ width: '84px', height: '84px', margin: '0 auto 1rem', display: 'block' }}
            />
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--dole-blue)',
            }}>
              Republic of the Philippines
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Department of Labor and Employment
            </div>
            <h1 style={{ fontSize: '1.45rem', color: 'var(--text-primary)', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
              CTMS Staff Portal
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Queue & Transaction Management System
            </p>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'var(--dole-red-light)',
              border: '1px solid #ffccd0',
              color: 'var(--dole-red)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="staff-username">DOLE Staff Username</label>
              <input
                id="staff-username"
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. staff or admin"
              />
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label htmlFor="staff-password">Password</label>
              <input
                id="staff-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg w-full"
            >
              {loading ? 'Authenticating...' : 'Sign In to Queue System'}
            </button>
          </form>

          <div style={{
            marginTop: '1.75rem',
            paddingTop: '1.25rem',
            borderTop: 'var(--border-hairline)',
            textAlign: 'center',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}>
            Shared database authentication with DOLE CSM.<br />
            Sign in with your assigned field office credentials.
          </div>
        </div>
      </div>
    </div>
  );
}
