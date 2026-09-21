import { useEffect, useState } from 'react';
import { projectsApi } from '../api/endpoints.ts';
import type { ActivityItem } from '../api/types.ts';
import { describeActivity, formatDate } from './format.ts';

export function ActivityPanel({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    projectsApi
      .activity(projectId)
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  }, [projectId, refreshKey]);

  return (
    <div className="panel">
      <h2>Histórico (MongoDB)</h2>
      {error && <p className="error">{error}</p>}
      {items === null && !error && <p className="muted">Carregando…</p>}
      <ul className="list">
        {items?.length === 0 && <li className="muted">Sem atividade ainda.</li>}
        {items?.map((item) => (
          <li key={item.id}>
            <span>{describeActivity(item)}</span>
            <time className="muted">{formatDate(item.createdAt)}</time>
          </li>
        ))}
      </ul>
    </div>
  );
}
