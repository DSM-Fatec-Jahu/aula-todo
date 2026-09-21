import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Task, TaskStatus } from '../api/types.ts';
import { STATUS_LABEL, STATUS_ORDER } from './format.ts';
import { TaskCard } from './TaskCard.tsx';

interface TaskBoardProps {
  tasks: Task[];
  canEdit: boolean;
  onCreate: (title: string) => Promise<void>;
  onStatusChange: (task: Task, status: TaskStatus) => Promise<void>;
  onDelete?: (task: Task) => Promise<void>;
  onUpload?: (task: Task, file: File) => Promise<void>;
  onDeleteAttachment?: (task: Task, attachmentId: string) => Promise<void>;
}

export function TaskBoard({ tasks, canEdit, onCreate, ...handlers }: TaskBoardProps) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate(title.trim());
      setTitle('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {canEdit && (
        <form className="inline-form" onSubmit={submit}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nova tarefa"
            maxLength={200}
            aria-label="Título da nova tarefa"
          />
          <button type="submit" disabled={saving || !title.trim()}>
            Adicionar
          </button>
        </form>
      )}

      <div className="columns">
        {STATUS_ORDER.map((status) => {
          const items = tasks.filter((task) => task.status === status);
          return (
            <section key={status} className="column">
              <h2>
                {STATUS_LABEL[status]} <span className="badge">{items.length}</span>
              </h2>
              {items.length === 0 && <p className="muted empty">Nenhuma tarefa</p>}
              {items.map((task) => (
                <TaskCard key={task.id} task={task} canEdit={canEdit} {...handlers} />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
