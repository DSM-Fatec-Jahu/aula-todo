import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { attachmentsApi, projectsApi, tasksApi } from '../api/endpoints.ts';
import type { Board, Task, TaskStatus } from '../api/types.ts';
import { ActivityPanel } from '../components/ActivityPanel.tsx';
import { SharePanel } from '../components/SharePanel.tsx';
import { TaskBoard } from '../components/TaskBoard.tsx';

type Panel = 'share' | 'activity' | null;

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const [board, setBoard] = useState<Board | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  const load = useCallback(
    () =>
      projectsApi.board(projectId).then((data) => {
        setBoard(data);
        setVersion((current) => current + 1);
      }),
    [projectId],
  );

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  // Executa a acao, recarrega o quadro e mostra o erro (se houver) sem quebrar a tela.
  const act = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (error && !board) {
    return (
      <main>
        <p className="error">{error}</p>
        <Link to="/">Voltar</Link>
      </main>
    );
  }
  if (!board) return <main><p className="muted">Carregando…</p></main>;

  return (
    <main>
      <p>
        <Link to="/">← Projetos</Link>
      </p>
      <header className="page-header">
        <div>
          <h1>{board.project.name}</h1>
          {board.project.description && <p className="muted">{board.project.description}</p>}
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => setPanel(panel === 'share' ? null : 'share')}>
            Compartilhar
          </button>
          <button type="button" className="secondary" onClick={() => setPanel(panel === 'activity' ? null : 'activity')}>
            Histórico
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {panel === 'share' && <SharePanel projectId={projectId} />}
      {panel === 'activity' && <ActivityPanel projectId={projectId} refreshKey={version} />}

      <TaskBoard
        tasks={board.tasks}
        canEdit
        onCreate={(title) => act(() => tasksApi.create(projectId, { title }))}
        onStatusChange={(task: Task, status: TaskStatus) => act(() => tasksApi.update(projectId, task.id, { status }))}
        onDelete={(task) => act(() => tasksApi.remove(projectId, task.id))}
        onUpload={(task, file) => act(() => attachmentsApi.upload(projectId, task.id, file))}
        onDeleteAttachment={(task, attachmentId) => act(() => attachmentsApi.remove(projectId, task.id, attachmentId))}
      />
    </main>
  );
}
