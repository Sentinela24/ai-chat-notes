import type { ChatRole, ErrorCode, StopReason } from '@acn/shared';

export type MessageStatus = 'streaming' | 'done' | 'stopped' | 'error';

export interface MessageError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

export interface Message {
  id: string;
  role: ChatRole;
  content: string;
  status: MessageStatus;
  createdAt: number;
  model?: string;
  stopReason?: StopReason;
  error?: MessageError;
}
