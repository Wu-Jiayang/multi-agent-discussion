import assert from "node:assert/strict";
import test from "node:test";
import { roomPresentationResults, roomToolOutput, storedRoomPresentations } from "../src/plugin/tool-output.mjs";

const author = { memberId: "a", displayName: "Agent 1", kind: "agent" };
const row = { author, messageId: "m1", roomSeq: 1, text: "建议采用甲", kind: "post", full: true, preview: false, label: "redundant", options: [], replyToMessageId: null };

test("a stored post keeps its timeline but puts receipt metadata outside the model text", () => {
  const output = roomToolOutput("room_post", {
    status: "stored", statusLabel: "已发送", messageId: "m1", roomSeq: 1, questionId: null,
    timeline: [row], checkDecision: "skipped", presentation: { presentationId: "p_1", messageIds: ["m1"], note: "internal" },
  });
  assert.deepEqual(JSON.parse(output.content), {
    status: "stored", statusLabel: "已发送", messageId: "m1", roomSeq: 1,
    timeline: [{ author, messageId: "m1", roomSeq: 1, text: "建议采用甲" }],
  });
  assert.deepEqual(output.metadata, { discussionPresentationId: "p_1" });
});

test("preview, links and question options survive projection without duplicate fields", () => {
  const output = roomToolOutput("room_unread", {
    items: [{ ...row, kind: "question", questionId: "q1", replyToMessageId: "m0", replyTo: { ...row, messageId: "m0", preview: true }, unread: true, options: ["甲", "乙"], mentions: [{ id: "b", display_name: "Agent 2" }] }],
    unreadMessageIds: ["m1"], nextCursor: null,
  });
  const data = JSON.parse(output.content);
  assert.deepEqual(data.items[0], {
    author, messageId: "m1", roomSeq: 1, text: "建议采用甲", kind: "question", questionId: "q1",
    replyTo: { author, messageId: "m0", roomSeq: 1, text: "建议采用甲", preview: true },
    unread: true, options: ["甲", "乙"], mentions: [{ memberId: "b", displayName: "Agent 2" }],
  });
  assert.equal(data.unreadMessageIds, undefined);
  assert.equal(data.nextCursor, undefined);
});

test("a stored receipt matches only the tool result actually available to the model", () => {
  const id = "call_1";
  const name = "room_context";
  const output = roomToolOutput(name, { items: [row], presentation: { presentationId: "p_1" } });
  const stored = [{ type: "assistant", content: [{ type: "tool", id, name, state: {
    status: "completed", content: [{ type: "text", text: output.content }], metadata: output.metadata,
  } }] }];
  const visible = text => [{ role: "tool", content: [{ type: "tool-result", id, name, result: { type: "text", value: text } }] }];
  const keys = roomPresentationResults(visible(output.content)).map(result => result.key);
  assert.equal(storedRoomPresentations(stored, new Set(keys)).get(keys[0]), "p_1");
  assert.equal(storedRoomPresentations(stored, new Set(roomPresentationResults(visible("truncated")).map(result => result.key))).size, 0);
});
