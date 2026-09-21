import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { publicApi } from '../api/endpoints.ts';
import type { PublicBoard, Task, TaskStatus } from '../api/types.ts';
import { TaskBoard } from '../components/TaskBoard.tsx';

export function SharedPage() {
  const { token = '' } = useParams();
  const [board, setBoard] = useState<PublicBoard | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => publicApi.view(token).then(setBoard), [token]);

  useEffect(() => {
    load().catch(() => setError('Este link é inválido, expirou ou foi revogado.'));
  }, [load]);

  const act = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (error && !board) return <main><p className="error">{error}</p></main>;
  if (!board) return <main><p className="muted">Carregando…</p></main>;

  const canEdit = board.permission === 'EDIT';

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="badge">Projeto compartilhado · {canEdit ? 'pode editar tarefas' : 'somente leitura'}</p>
          <h1>{board.project.name}</h1>
          {board.project.description && <p className="muted">{board.project.description}</p>}
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <TaskBoard
        tasks={board.tasks}
        canEdit={canEdit}
        onCreate={(title) => act(() => publicApi.createTask(token, { title }))}
        onStatusChange={(task: Task, status: TaskStatus) => act(() => publicApi.updateTask(token, task.id, { status }))}
      />
    </main>
  );
}
