export interface Actor {
  type: 'user' | 'anonymous';
  id: string;
  label?: string;
}
