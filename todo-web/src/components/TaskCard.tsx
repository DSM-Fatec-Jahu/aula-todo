import { useRef, useState } from 'react';
import type { Task, TaskStatus } from '../api/types.ts';
import { formatBytes, STATUS_LABEL, STATUS_ORDER } from './format.ts';

interface TaskCardProps {
  task: Task;
  canEdit: boolean;
  onStatusChange: (task: Task, status: TaskStatus) => Promise<void>;
  onDelete?: (task: Task) => Promise<void>;
  onUpload?: (task: Task, file: File) => Promise<void>;
  onDeleteAttachment?: (task: Task, attachmentId: string) => Promise<void>;
}

export function TaskCard({ task, canEdit, onStatusChange, onDelete, onUpload, onDeleteAttachment }: TaskCardProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const images = task.attachments.filter((attachment) => attachment.isImage);
  const files = task.attachments.filter((attachment) => !attachment.isImage);

  return (
    <article className="card" aria-busy={busy}>
      <h3>{task.title}</h3>
      {task.description && <p className="muted">{task.description}</p>}

      {images.length > 0 && (
        <div className="thumbs">
          {images.map((image) => (
            <figure key={image.id}>
              <a href={image.downloadUrl} target="_blank" rel="noreferrer">
                <img src={image.downloadUrl} alt={image.fileName} loading="lazy" />
              </a>
              {onDeleteAttachment && (
                <button
                  type="button"
                  className="link danger"
                  onClick={() => run(() => onDeleteAttachment(task, image.id))}
                >
                  remover
                </button>
              )}
            </figure>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className="files">
          {files.map((file) => (
            <li key={file.id}>
              <a href={file.downloadUrl} target="_blank" rel="noreferrer">
                {file.fileName}
              </a>{' '}
              <span className="muted">({formatBytes(file.sizeBytes)})</span>
              {onDeleteAttachment && (
                <button
                  type="button"
                  className="link danger"
                  onClick={() => run(() => onDeleteAttachment(task, file.id))}
                >
                  remover
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="card-actions">
          <select
            value={task.status}
            disabled={busy}
            aria-label={`Status da tarefa ${task.title}`}
            onChange={(event) => run(() => onStatusChange(task, event.target.value as TaskStatus))}
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>

          {onUpload && (
            <>
              <input
                ref={fileInput}
                type="file"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void run(() => onUpload(task, file));
                }}
              />
              <button type="button" className="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
                Anexar
              </button>
            </>
          )}
          {onDelete && (
            <button type="button" className="link danger" disabled={busy} onClick={() => run(() => onDelete(task))}>
              Excluir
            </button>
          )}
        </div>
      )}
    </article>
  );
}
