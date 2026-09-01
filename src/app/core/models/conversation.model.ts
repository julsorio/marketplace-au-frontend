/**
 * Conversación entre dos usuarios sobre un anuncio concreto. `lastMessageText` y
 * `lastMessageSentAt` son null si aún no se ha enviado ningún mensaje.
 */
export interface ConversationResponse {
  id: string;
  listingId: string;
  participants: string[];
  lastMessageText: string | null;
  lastMessageSentAt: string | null;
  unreadCount: number;
}

/** Un mensaje individual dentro de una conversación. */
export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  sentAt: string;
  read: boolean;
}

/**
 * Cuerpo para enviar un mensaje. Si no existe todavía una conversación entre el
 * remitente y `recipientId` para ese `listingId`, el backend la crea; si ya existe,
 * el mensaje se añade a esa misma conversación.
 */
export interface SendMessageRequest {
  listingId: string;
  recipientId: string;
  text: string;
}
