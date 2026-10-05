import type { StudentProfile } from './profile';
export type ProfileMessage =
  | { type: 'ready' | 'loading' | 'cleared' }
  | { type: 'error'; message: string }
  | { type: 'result'; profile: StudentProfile; fetchedAt: number };
export const profileChannelName = (id: string) => `linways-profile-${id}`;
