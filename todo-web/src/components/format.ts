import type { ActivityItem, TaskStatus } from '../api/types.ts';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'A fazer',
  DOING: 'Em andamento',
  DONE: 'Concluída',
};

export const STATUS_ORDER: TaskStatus[] = ['TODO', 'DOING', 'DONE'];

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const ACTION_LABEL: Record<string, string> = {
  'project.created': 'criou o projeto',
  'project.updated': 'atualizou o projeto',
  'project.deleted': 'excluiu o projeto',
  'task.created': 'criou a tarefa',
  'task.updated': 'atualizou a tarefa',
  'task.deleted': 'excluiu a tarefa',
  'attachment.requested': 'iniciou um envio de arquivo',
  'attachment.added': 'anexou o arquivo',
  'attachment.removed': 'removeu o arquivo',
  'share.created': 'criou um link de compartilhamento',
  'share.revoked': 'revogou um link de compartilhamento',
};

export function describeActivity(item: ActivityItem) {
  const who = item.actorType === 'anonymous' ? `Visitante (${item.actorLabel ?? 'link'})` : (item.actorLabel ?? 'Usuário');
  const what = ACTION_LABEL[item.action] ?? item.action;
  const detail = item.meta.title ?? item.meta.fileName ?? item.meta.label;
  const change =
    item.meta.statusFrom && item.meta.statusTo
      ? ` (${STATUS_LABEL[item.meta.statusFrom as TaskStatus]} → ${STATUS_LABEL[item.meta.statusTo as TaskStatus]})`
      : '';
  return `${who} ${what}${detail ? ` "${String(detail)}"` : ''}${change}`;
}
