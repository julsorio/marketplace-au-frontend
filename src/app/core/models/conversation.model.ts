export interface ConversationResponse {
  id: string;
  listingId: string;
  participants: string[];
  lastMessageText: string | null;
  lastMessageSentAt: string | null;
  unreadCount: number;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  sentAt: string;
  read: boolean;
}

export interface SendMessageRequest {
  listingId: string;
  recipientId: string;
  text: string;
}
