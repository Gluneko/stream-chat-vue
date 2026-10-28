<script setup lang="ts">
/**
 * 消息列表:跟随到底(用户往上翻时不打扰),长列表靠 content-visibility 跳过屏外渲染。
 * 滚动用 watch + nextTick:等 DOM 更新完再量 scrollHeight。
 */
import { nextTick, ref, watch } from 'vue';
import type { Message } from '../protocol/types';
import MessageView from './MessageView.vue';

const props = defineProps<{ messages: Message[] }>();
const emit = defineEmits<{ stop: [id: string]; regenerate: [id: string]; resume: [id: string]; confirmTool: [id: string, callId: string, decision: 'run' | 'skip', args?: Record<string, unknown>] }>();

const el = ref<HTMLDivElement>();
const stick = ref(true);
const toBottom = () => { if (el.value) el.value.scrollTop = el.value.scrollHeight; };
watch(() => { const last = props.messages[props.messages.length - 1]; return [last?.content, last?.status, props.messages.length]; }, async () => { if (stick.value) { await nextTick(); toBottom(); } });
const onScroll = () => { const e = el.value!; stick.value = e.scrollHeight - e.scrollTop - e.clientHeight < 40; };
</script>

<template>
  <div ref="el" class="list" @scroll="onScroll">
    <div v-if="messages.length === 0" class="empty">
      <h2>Stream Chat Demo · Vue 3</h2>
      <p>一个 AI 对话交互的最小实现:流式协议(seq / uniqueId / isAll)、断线续传、刷新恢复、两级停止、工具调用确认、Markdown 流式渲染。Vue 3 + Pinia 实现,协议与传输层与 React 版共用。</p>
      <p class="muted">试试输入:"SSE 断线续传怎么做"、"帮我查一下杭州天气"、"CRDT 为什么能收敛"。然后点右上角"模拟断网"或直接刷新页面。</p>
    </div>
    <div v-for="(m, i) in messages" :key="m.id" class="item">
      <MessageView :msg="m" :is-last="i === messages.length - 1"
        @stop="emit('stop', m.id)" @regenerate="emit('regenerate', m.id)" @resume="emit('resume', m.id)"
        @confirm-tool="(callId, d, a) => emit('confirmTool', m.id, callId, d, a)" />
    </div>
    <button v-if="!stick" class="to-bottom" @click="stick = true; toBottom()">回到底部 ↓</button>
  </div>
</template>
