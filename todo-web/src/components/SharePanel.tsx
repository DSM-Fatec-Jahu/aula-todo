import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { sharesApi } from '../api/endpoints.ts';
import type { CreatedShareLink, ShareLink, SharePermission } from '../api/types.ts';
import { formatDate } from './format.ts';

export function SharePanel({ projectId }: { projectId: string }) {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [created, setCreated] = useState<CreatedShareLink | null>(null);
  const [permission, setPermission] = useState<SharePermission>('READ');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState('7');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => sharesApi.list(projectId).then(setShares), [projectId]);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const link = await sharesApi.create(projectId, {
        permission,
        label: label.trim() || undefined,
        expiresInDays: days ? Number(days) : undefined,
      });
      setCreated(link);
      setCopied(false);
      setLabel('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const revoke = async (shareId: string) => {
    await sharesApi.revoke(projectId, shareId);
    await load();
  };

  const url = created ? `${window.location.origin}/s/${created.token}` : '';

  return (
    <div className="panel">
      <h2>Compartilhar (acesso anônimo)</h2>
      <form className="inline-form wrap" onSubmit={create}>
        <select value={permission} onChange={(event) => setPermission(event.target.value as SharePermission)} aria-label="Permissão">
          <option value="READ">Somente leitura</option>
          <option value="EDIT">Pode editar tarefas</option>
        </select>
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Nome do link (opcional)" maxLength={80} />
        <select value={days} onChange={(event) => setDays(event.target.value)} aria-label="Validade">
          <option value="1">Expira em 1 dia</option>
          <option value="7">Expira em 7 dias</option>
          <option value="30">Expira em 30 dias</option>
          <option value="">Sem expiração</option>
        </select>
        <button type="submit">Gerar link</button>
      </form>

      {error && <p className="error">{error}</p>}

      {created && (
        <div className="notice">
          <p>
            <strong>Copie agora:</strong> o link completo é exibido uma única vez.
          </p>
          <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} aria-label="Link de compartilhamento" />
          <button
            type="button"
            className="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(() => setCopied(true));
            }}
          >
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      )}

      <ul className="list">
        {shares.length === 0 && <li className="muted">Nenhum link criado.</li>}
        {shares.map((share) => (
          <li key={share.id}>
            <span>
              {share.label ?? 'Sem nome'} · {share.permission === 'EDIT' ? 'edição' : 'leitura'} · criado em {formatDate(share.createdAt)}
              {share.expiresAt && ` · expira em ${formatDate(share.expiresAt)}`}
            </span>
            {share.active ? (
              <button type="button" className="link danger" onClick={() => void revoke(share.id)}>
                Revogar
              </button>
            ) : (
              <span className="badge">{share.revokedAt ? 'revogado' : 'expirado'}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
