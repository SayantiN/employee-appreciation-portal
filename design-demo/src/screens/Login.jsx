import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';
import { Button, Callout, Field, TextInput } from '../components/ui.jsx';
import { ApiError, api } from '../api/client.js';
import './screens.scss';

/**
 * SPEC 6.1 — the brand panel is the one large colour field in the product.
 * Login is the only screen with nothing to read, so it can carry a saturated
 * block without competing with content.
 */
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [mode, setMode] = useState('login');   // 'login' | 'forgot'
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setProblem(null);
    setBusy(true);
    try {
      await login(email.trim(), password, remember);
      navigate('/', { replace: true });
    } catch (err) {
      // R-6.1.3 — the copy here is whatever the server said, and the server
      // says the same thing for an unknown address as for a wrong password.
      setProblem(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function forgot(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);            // identical response whether or not it exists
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <aside className="login__brand">
        <span className="login__mark" aria-hidden="true" />
        <h1 className="login__wordmark">Employee<br />Appreciation<br />Portal</h1>
        <p className="login__tagline">Recognise the people who made this month work.</p>
        <div className="login__rule" />
        <p className="login__fine">Internal use only. Authenticated access.</p>
      </aside>

      <main className="login__panel" id="main">
        <div className="login__form-wrap">
          {mode === 'login' ? (
            <form onSubmit={submit} noValidate>
              <h2 className="login__title">Sign in</h2>
              <p className="login__sub">Use your work email address.</p>

              {problem && (
                <div className="login__alert">
                  <Callout tone="clay">{problem}</Callout>
                </div>
              )}

              <Field label="Work email" htmlFor="email">
                <TextInput
                  id="email" type="email" autoComplete="username" required
                  placeholder="name@isgesolutions.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field label="Password" htmlFor="password">
                <div className="login__password">
                  <TextInput
                    id="password" type={show ? 'text' : 'password'}
                    autoComplete="current-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" className="login__reveal" onClick={() => setShow((v) => !v)}>
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
              </Field>

              <div className="login__row">
                <label className="login__remember">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Remember me on this device</span>
                </label>
                <button type="button" className="login__linkbtn" onClick={() => { setMode('forgot'); setProblem(null); }}>
                  Forgot password?
                </button>
              </div>

              <Button type="submit" variant="primary" size="lg" full disabled={busy}>
                {busy ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={forgot} noValidate>
              <h2 className="login__title">Reset your password</h2>
              <p className="login__sub">Enter your work email and we will send a reset link.</p>

              <Field label="Work email" htmlFor="femail">
                <TextInput id="femail" type="email" autoComplete="username" required
                           value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>

              {sent && (
                <div className="login__alert">
                  <Callout tone="sage">If that email is registered, a reset link has been sent.</Callout>
                </div>
              )}

              <Button type="submit" variant="primary" size="lg" full disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </Button>
              <div className="login__back">
                <button type="button" className="login__linkbtn" onClick={() => { setMode('login'); setSent(false); }}>
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
