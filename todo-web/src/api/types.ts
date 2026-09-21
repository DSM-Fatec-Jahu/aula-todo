export type TaskStatus = 'TODO' | 'DOING' | 'DONE';
export type SharePermission = 'READ' | 'EDIT';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Session {
  accessToken: string;
  user: User;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  taskCount: number;
  doneCount: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  isImage: boolean;
  downloadUrl: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  attachments: Attachment[];
}

export interface Board {
  project: { id: string; name: string; description: string | null };
  tasks: Task[];
}

export interface PublicBoard extends Board {
  permission: SharePermission;
}

export interface UploadSlot {
  attachmentId: string;
  upload: { url: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string };
}

export interface ShareLink {
  id: string;
  permission: SharePermission;
  label: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  active: boolean;
}

export interface CreatedShareLink extends ShareLink {
  token: string;
}

export interface ActivityItem {
  id: string;
  actorType: 'user' | 'anonymous';
  actorLabel: string | null;
  action: string;
  meta: Record<string, unknown>;
  createdAt: string;
}
