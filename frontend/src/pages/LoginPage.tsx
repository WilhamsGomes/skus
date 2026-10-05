import { Activity, Lock, User } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";
  if (isAuthenticated) return <Navigate to={from} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha no login");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-40 -left-40 size-[480px] rounded-full bg-brand/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 size-[480px] rounded-full bg-accent/10 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-brand text-white shadow-xl shadow-brand/30">
            <Activity className="size-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-wide text-ink">SKU ENRICHMENT</h1>
          <p className="mt-1 text-sm text-ink-muted">Painel de operação da integração</p>
        </div>

        <form onSubmit={submit} className="panel space-y-4 p-6">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">Usuário</span>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                className="input pl-9"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">Senha</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                className="input pl-9"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          {error && (
            <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full" loading={submitting}>
            Entrar
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-faint">
          Acesso único definido por DASHBOARD_USERNAME / DASHBOARD_PASSWORD no backend.
        </p>
      </div>
    </div>
  );
}
