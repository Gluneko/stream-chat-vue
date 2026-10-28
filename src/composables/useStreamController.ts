/**
 * 流式控制器(composable):把传输层、状态机、冲刷器串起来。
 *  - send:创建用户消息 + 助手消息,向服务端 create 一次生成,订阅
 *  - 帧 → 冲刷器(30fps 批量)→ applyFrame → store 更新
 *  - 连接关闭:end 正常结束;drop / offline / error 且消息未完成 → 指数退避重连,带最新 lastSeq
 *  - stop:两级停止,先服务端 stop 保存现场,再关本地连接,状态 aborted
 *  - 刷新恢复:挂载时扫描未完成的消息,按 uniqueId + lastSeq 续接(不重跑)
 *  - 传输切换:watch(transport) 时先关掉所有连接,再按新传输续接
 */
import { onMounted, onUnmounted, watch, type Ref } from 'vue';
import type { Frame, Message, MessageStatus } from '../protocol/types';
import { applyFrame, backoff } from '../protocol/machine';
import { createFlusher } from '../stream/scheduler';
import type { Transport } from '../transport/types';
import { mkMessage, useChatStore, type Patch } from '../stores/chat';

const UNFINISHED: MessageStatus[] = ['connecting', 'streaming', 'tool_calling', 'awaiting_confirm', 'reconnecting'];
type Active = { unsub: () => void; attempt: number; timer?: number; flusher: ReturnType<typeof createFlusher<Frame>> };

export function useStreamController(transport: Ref<Transport>, maxFps = 30) {
  const store = useChatStore();
  const active = new Map<string, Active>();   // 连接句柄不是 UI 状态,放普通 Map,不进响应式系统

  const patch = (sessionId: string, messageId: string, p: Patch) => store.update(sessionId, messageId, p);

  const close = (messageId: string) => {
    const a = active.get(messageId); if (!a) return;
    if (a.timer) clearTimeout(a.timer); a.flusher.stop(); a.unsub(); active.delete(messageId);
  };

  const open = (sessionId: string, messageId: string, attempt = 0) => {
    const msg = store.find(sessionId, messageId); if (!msg?.uniqueId) return;
    close(messageId);
    const flusher = createFlusher<Frame>(maxFps, frames => patch(sessionId, messageId, m => frames.reduce(applyFrame, m)));
    const entry: Active = { unsub: () => {}, attempt, flusher };
    active.set(messageId, entry);
    if (attempt === 0) patch(sessionId, messageId, m => ({ ...m, status: m.status === 'idle' ? 'connecting' : m.status }));
    // 终态帧是否已经到达:帧可能还在冲刷器缓冲里没应用到 store,所以单独记一个标记,不依赖 store 里的 status
    let terminal = false;
    entry.unsub = transport.value.subscribe({ uniqueId: msg.uniqueId, lastSeq: msg.lastSeq }, f => { if (f.type === 'done' || f.type === 'error') terminal = true; flusher.push(f); }, (reason, detail) => {
      flusher.flushNow();
      const cur = store.find(sessionId, messageId); if (!cur) return;
      const finished = terminal || !UNFINISHED.includes(cur.status);
      if (reason === 'end') {
        active.delete(messageId);
        if (!finished) patch(sessionId, messageId, m => (UNFINISHED.includes(m.status) ? { ...m, status: 'aborted' } : m));   // 服务端停止了但没发 done
        return;
      }
      if (reason === 'abort' || finished) { active.delete(messageId); return; }
      // 掉线 / 离线 / 出错:退避重连,带最新 lastSeq
      const next = entry.attempt + 1;
      if (next > 8) { active.delete(messageId); patch(sessionId, messageId, { status: 'error', error: `重连 ${next - 1} 次失败:${detail ?? reason}` }); return; }
      patch(sessionId, messageId, m => ({ ...m, status: 'reconnecting', error: detail, stats: { ...m.stats, reconnects: m.stats.reconnects + 1 } }));
      entry.timer = window.setTimeout(() => open(sessionId, messageId, next), backoff(entry.attempt));
    });
  };

  const send = (sessionId: string, prompt: string) => {
    const session = store.sessions.find(s => s.id === sessionId); if (!session) return;
    const history = session.messages.filter(m => m.status === 'complete').map(m => ({ role: m.role, content: m.content }));
    const user = mkMessage('user', prompt);
    const assistant = mkMessage('assistant'); assistant.status = 'connecting'; assistant.uniqueId = transport.value.create(prompt, history);
    store.addMessages(sessionId, [user, assistant]);
    open(sessionId, assistant.id);
  };

  const stop = (sessionId: string, messageId: string) => {
    const msg = store.find(sessionId, messageId); if (!msg?.uniqueId) return;
    transport.value.stop(msg.uniqueId);                                              // 第一级:服务端停止并保存现场
    close(messageId);                                                               // 第二级:本地断开
    patch(sessionId, messageId, m => (UNFINISHED.includes(m.status) ? { ...m, status: 'aborted' } : m));
  };

  /** 重新生成:删掉这条及之后,用同一个 prompt 再发 */
  const regenerate = (sessionId: string, messageId: string) => {
    const s = store.sessions.find(x => x.id === sessionId); if (!s) return;
    const i = s.messages.findIndex(m => m.id === messageId); const userMsg = s.messages.slice(0, i).reverse().find(m => m.role === 'user'); if (!userMsg) return;
    const prompt = userMsg.content;
    close(messageId);
    store.truncateAfter(sessionId, userMsg.id);
    send(sessionId, prompt);
  };

  /** 出错后的续接:不重跑,带 lastSeq 再订阅 */
  const resume = (sessionId: string, messageId: string) => { patch(sessionId, messageId, { status: 'reconnecting', error: undefined }); open(sessionId, messageId, 0); };

  const confirmTool = (sessionId: string, messageId: string, callId: string, decision: 'run' | 'skip', args?: Record<string, unknown>) => {
    const msg = store.find(sessionId, messageId); if (!msg?.uniqueId) return;
    patch(sessionId, messageId, m => ({ ...m, status: 'tool_calling', tools: m.tools.map(t => (t.callId === callId ? { ...t, args: args ?? t.args, status: decision === 'run' ? 'executing' : 'skipped' } : t)) }));
    transport.value.confirmTool(msg.uniqueId, callId, decision, args);
  };

  /** 刷新恢复:把所有未完成的消息续接上 */
  const recover = () => {
    for (const s of store.sessions) for (const m of s.messages) {
      if (m.role === 'assistant' && UNFINISHED.includes(m.status) && m.uniqueId && !active.has(m.id)) {
        if (transport.value.supportsResume) open(s.id, m.id, 0);
        else patch(s.id, m.id, { status: 'error', error: '当前传输不支持续传,请重新生成' });
      }
    }
  };
  const closeAll = () => { for (const id of [...active.keys()]) close(id); };

  onMounted(recover);
  watch(transport, () => { closeAll(); recover(); });
  onUnmounted(closeAll);

  return { send, stop, regenerate, resume, confirmTool, isActive: (id: string) => active.has(id) };
}
