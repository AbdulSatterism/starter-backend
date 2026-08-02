import { enqueueNotification } from '../queues/queueManager';

export const sendNotifications = async (data: Record<string, unknown>) => {
  return enqueueNotification(data);
};
