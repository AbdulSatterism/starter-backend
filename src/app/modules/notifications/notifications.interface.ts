import { Model } from 'mongoose';

export interface TNotification {
  patientName: string;
  message: string;
  receiver?: string;
  receiverGroupId?: string;
  senderGroupId?: string;
  invitationId?: string;
  type?: 'ADMIN' | 'USER';
  userId?: string;
  read?: boolean;
}
export type Notification = Model<TNotification>;
