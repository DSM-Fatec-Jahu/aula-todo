import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router';
import { authApi } from '../api/endpoints.ts';
import { useAuth } from '../auth/AuthContext.tsx';

export function LoginPage() {
  const { user, signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session =
        mode === 'login'
          ? await authApi.login({ email, password })
          : await authApi.register({ name, email, password });
      signIn(session);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <h1>Todo Cloud</h1>
      <p className="muted">App de demonstração da aula de computação em nuvem.</p>

      <form onSubmit={submit} className="stack">
        {mode === 'register' && (
          <label>
            Nome
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} autoComplete="name" />
          </label>
        )}
        <label>
          E-mail
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={mode === 'register' ? 8 : 1}
            maxLength={72}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>

      <button
        type="button"
        className="link"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError('');
        }}
      >
        {mode === 'login' ? 'Não tenho conta' : 'Já tenho conta'}
      </button>
    </main>
  );
}
