/**
 * 会话与消息:Pinia store + localStorage。
 * 刷新后消息状态还在,未完成的消息由控制器(useStreamController)续接。
 * 消息数组是深层响应式的;流式更新只替换单条消息对象,模板里按 message.id 做 key,重渲染范围就是这一条。
 */
import { defineStore } from 'pinia';
import { watch } from 'vue';
import type { Message, Session } from '../protocol/types';
import { now, uid } from '../protocol/types';

const LS_KEY = 'chat-demo-vue:sessions';
export type Patch = Partial<Message> | ((m: Message) => Message);

export const newSession = (): Session => ({ id: uid('s_'), title: '新对话', createdAt: now(), messages: [] });

export const mkMessage = (role: Message['role'], content = ''): Message => ({
  id: uid('m_'), role, content, status: role === 'user' ? 'complete' : 'idle', lastSeq: 0, tools: [], citations: [], createdAt: now(),
  stats: { frames: 0, dup: 0, gaps: 0, reconnects: 0 },
});

function load(): { sessions: Session[]; activeId: string } {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null') as { sessions: Session[]; activeId: string } | null;
    if (s && s.sessions.length) return s;
  } catch { /* ignore */ }
  const s = newSession(); return { sessions: [s], activeId: s.id };
}

export const useChatStore = defineStore('chat', {
  state: load,
  getters: {
    active(state): Session { return state.sessions.find(s => s.id === state.activeId) ?? state.sessions[0]; },
  },
  actions: {
    newSession() { const s = newSession(); this.sessions.unshift(s); this.activeId = s.id; },
    select(id: string) { this.activeId = id; },
    remove(id: string) {
      this.sessions = this.sessions.filter(s => s.id !== id);
      if (!this.sessions.length) this.sessions.push(newSession());
      if (this.activeId === id) this.activeId = this.sessions[0].id;
    },
    find(sessionId: string, messageId: string): Message | undefined {
      return this.sessions.find(s => s.id === sessionId)?.messages.find(m => m.id === messageId);
    },
    addMessages(sessionId: string, messages: Message[]) {
      const s = this.sessions.find(x => x.id === sessionId); if (!s) return;
      if (!s.messages.length) s.title = messages[0]?.content.slice(0, 24) || s.title;
      s.messages.push(...messages);
    },
    update(sessionId: string, messageId: string, patch: Patch) {
      const s = this.sessions.find(x => x.id === sessionId); if (!s) return;
      const i = s.messages.findIndex(m => m.id === messageId); if (i < 0) return;
      const m = s.messages[i];
      s.messages[i] = typeof patch === 'function' ? patch(m) : { ...m, ...patch };
    },
    truncateAfter(sessionId: string, messageId: string) {
      const s = this.sessions.find(x => x.id === sessionId); if (!s) return;
      const i = s.messages.findIndex(m => m.id === messageId); if (i >= 0) s.messages.splice(i);
    },
    /** 持久化:deep watch 整个 state,流式期间每帧都会写一次 localStorage,量很小,与 React 版的 useEffect(save) 等价 */
    persist() {
      watch(() => this.$state, s => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ } }, { deep: true });
    },
  },
});
