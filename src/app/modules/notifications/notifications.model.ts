import { model, Schema } from 'mongoose';
import { TNotification } from './notifications.interface';

const notificationSchema = new Schema<TNotification>(
  {
    message: {
      type: String,
    },
    patientName: {
      type: String,
    },
    receiver: {
      type: String,
    },
    receiverGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
    },
    senderGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
    },
    invitationId: {
      type: Schema.Types.ObjectId,
      ref: 'Invitation',
    },
    type: {
      type: String,
      enum: ['ADMIN', 'USER'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const Notification = model<TNotification>(
  'Notification',
  notificationSchema,
);
