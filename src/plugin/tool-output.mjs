import { createHash } from "node:crypto";

const presentationTools = new Set(["room_post", "room_ask", "room_unread", "room_history", "room_context"]);

function compactMessage(row) {
  const { messageId, roomSeq, author, text } = row;
  const message = { messageId, roomSeq, author, text };
  if (row.isOwn) message.isOwn = true;
  if (row.kind && row.kind !== "post") message.kind = row.kind;
  if (row.mentions?.length) message.mentions = row.mentions.map(member => ({ memberId: member.id, displayName: member.display_name }));
  if (row.mentionAll) message.mentionAll = true;
  if (row.options?.length) message.options = row.options;
  if (row.questionId) message.questionId = row.questionId;
  if (row.questionStatus) message.questionStatus = row.questionStatus;
  if (row.answerMessageId) message.answerMessageId = row.answerMessageId;
  if (row.unread) message.unread = true;
  if (row.preview) message.preview = true;
  if (row.replyTo) {
    message.replyTo = row.replyTo.unavailable
      ? { messageId: row.replyTo.messageId, unavailable: true }
      : compactMessage(row.replyTo);
  }
  return message;
}

export function roomToolOutput(name, result) {
  if (!presentationTools.has(name)) return { content: JSON.stringify(result) };
  const { checkDecision, presentation, ...visible } = result;
  if (visible.timeline) visible.timeline = visible.timeline.map(compactMessage);
  if (visible.items) {
    visible.items = visible.items.map(item => item.author && typeof item.text === "string" ? compactMessage(item) : item);
  }
  if (visible.messageId === null) delete visible.messageId;
  if (visible.roomSeq === null) delete visible.roomSeq;
  if (visible.questionId === null) delete visible.questionId;
  if (visible.mentionHint === null) delete visible.mentionHint;
  for (const key of ["nextCursor", "previousCursor", "omittedBefore"]) {
    if (visible[key] === null) delete visible[key];
  }
  if (visible.unreadMessageIds && visible.items) delete visible.unreadMessageIds;
  if (visible.unread) {
    const { unreadCount, unreadMentionCount, unreadMentions, mentionCursor } = visible.unread;
    visible.unread = { unreadCount, unreadMentionCount };
    if (unreadMentions?.length) visible.unread.unreadMentions = unreadMentions;
    if (mentionCursor) visible.unread.mentionCursor = mentionCursor;
  }
  return {
    content: JSON.stringify(visible),
    ...(presentation?.presentationId ? { metadata: { discussionPresentationId: presentation.presentationId } } : {}),
  };
}

export function roomResultKey(id, name, text) {
  return createHash("sha256").update(JSON.stringify([id, name, text])).digest("hex");
}

export function roomPresentationResults(messages) {
  const results = [];
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type !== "tool-result" || !presentationTools.has(part.name)) continue;
      const result = part.result;
      const text = result?.type === "text" ? result.value
        : result?.type === "content" && result.value?.length === 1 ? result.value[0].text
        : null;
      if (typeof text === "string") results.push({ key: roomResultKey(part.id, part.name, text), text });
    }
  }
  return results;
}

export function storedRoomPresentations(messages, keys) {
  const found = new Map();
  for (const message of messages) {
    if (message.type !== "assistant") continue;
    for (const part of message.content) {
      if (part.type !== "tool" || part.state.status !== "completed" || !presentationTools.has(part.name)) continue;
      const text = part.state.content[0]?.text;
      const id = part.state.metadata?.discussionPresentationId;
      if (typeof id !== "string" || typeof text !== "string") continue;
      const key = roomResultKey(part.id, part.name, text);
      if (keys.has(key)) found.set(key, id);
    }
  }
  return found;
}
