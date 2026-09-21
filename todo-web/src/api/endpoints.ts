import { ApiError, request } from './client.ts';
import type {
  ActivityItem,
  Attachment,
  Board,
  CreatedShareLink,
  ProjectSummary,
  PublicBoard,
  Session,
  ShareLink,
  SharePermission,
  Task,
  TaskStatus,
  UploadSlot,
  User,
} from './types.ts';

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    request<Session>('/auth/register', { method: 'POST', body: data, auth: false }),
  login: (data: { email: string; password: string }) =>
    request<Session>('/auth/login', { method: 'POST', body: data, auth: false }),
  me: () => request<User>('/auth/me'),
};

export const projectsApi = {
  list: () => request<ProjectSummary[]>('/projects'),
  create: (data: { name: string; description?: string }) =>
    request<ProjectSummary>('/projects', { method: 'POST', body: data }),
  board: (id: string) => request<Board>(`/projects/${id}`),
  remove: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  activity: (id: string) => request<ActivityItem[]>(`/projects/${id}/activity`),
};

export const tasksApi = {
  create: (projectId: string, data: { title: string; description?: string }) =>
    request<Task>(`/projects/${projectId}/tasks`, { method: 'POST', body: data }),
  update: (projectId: string, taskId: string, data: { title?: string; status?: TaskStatus }) =>
    request<Task>(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: data }),
  remove: (projectId: string, taskId: string) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),
};

export const attachmentsApi = {
  // 1) pede a signed URL  2) envia o arquivo direto ao Cloud Storage  3) confirma para a API
  async upload(projectId: string, taskId: string, file: File): Promise<Attachment> {
    const base = `/projects/${projectId}/tasks/${taskId}/attachments`;
    const slot = await request<UploadSlot>(base, {
      method: 'POST',
      body: { fileName: file.name, contentType: file.type, sizeBytes: file.size },
    });

    const put = await fetch(slot.upload.url, {
      method: slot.upload.method,
      headers: slot.upload.headers,
      body: file,
    });
    if (!put.ok) throw new ApiError(put.status, 'Falha ao enviar o arquivo para o storage');

    return request<Attachment>(`${base}/${slot.attachmentId}/confirm`, { method: 'POST' });
  },
  remove: (projectId: string, taskId: string, attachmentId: string) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),
};

export const sharesApi = {
  list: (projectId: string) => request<ShareLink[]>(`/projects/${projectId}/shares`),
  create: (
    projectId: string,
    data: { permission: SharePermission; label?: string; expiresInDays?: number },
  ) => request<CreatedShareLink>(`/projects/${projectId}/shares`, { method: 'POST', body: data }),
  revoke: (projectId: string, shareId: string) =>
    request<void>(`/projects/${projectId}/shares/${shareId}`, { method: 'DELETE' }),
};

export const publicApi = {
  view: (token: string) => request<PublicBoard>(`/public/shares/${token}`, { auth: false }),
  createTask: (token: string, data: { title: string }) =>
    request<Task>(`/public/shares/${token}/tasks`, { method: 'POST', body: data, auth: false }),
  updateTask: (token: string, taskId: string, data: { status: TaskStatus }) =>
    request<Task>(`/public/shares/${token}/tasks/${taskId}`, {
      method: 'PATCH',
      body: data,
      auth: false,
    }),
};
