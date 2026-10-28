<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
import type { Message } from '../protocol/types';
import ToolPanel from './ToolPanel.vue';

// Markdown 组件带 markdown-it + highlight.js,异步加载:首屏不为它付费,第一条回复到达时才拉
const Markdown = defineAsyncComponent(() => import('./Markdown.vue'));

const STATUS_LABEL: Record<Message['status'], string> = {
  idle: '待发送', connecting: '连接中', streaming: '生成中', tool_calling: '工具执行中', awaiting_confirm: '等待确认', reconnecting: '重连中', complete: '完成', error: '出错', aborted: '已停止',
};

const props = defineProps<{ msg: Message; isLast: boolean }>();
const emit = defineEmits<{ stop: []; regenerate: []; resume: []; confirmTool: [callId: string, decision: 'run' | 'skip', args?: Record<string, unknown>] }>();

const openCite = ref<number | null>(null);
const busy = computed(() => ['connecting', 'streaming', 'tool_calling', 'awaiting_confirm', 'reconnecting'].includes(props.msg.status));
const toggleCite = (n: number) => { openCite.value = openCite.value === n ? null : n; };
const copy = () => navigator.clipboard?.writeText(props.msg.content);
</script>

<template>
  <div v-if="msg.role === 'user'" class="row user"><div class="bubble">{{ msg.content }}</div></div>
  <div v-else :class="['row', 'assistant', `status-${msg.status}`]">
    <div class="meta">
      <span :class="['chip', msg.status]">{{ STATUS_LABEL[msg.status] }}</span>
      <span class="muted">seq {{ msg.lastSeq }} · 帧 {{ msg.stats.frames }} · 重复 {{ msg.stats.dup }} · 缺口 {{ msg.stats.gaps }} · 重连 {{ msg.stats.reconnects }}</span>
      <span v-if="msg.uniqueId" class="muted mono">{{ msg.uniqueId }}</span>
    </div>
    <ToolPanel v-for="t in msg.tools" :key="t.callId" :tool="t" @confirm="(d, a) => emit('confirmTool', t.callId, d, a)" />
    <Markdown v-if="msg.content" :content="msg.content" @cite="toggleCite" />
    <div v-else-if="busy" class="thinking"><span /><span /><span /></div>
    <span v-if="msg.status === 'streaming'" class="caret" />
    <div v-if="msg.status === 'reconnecting'" class="notice">连接中断,正在带 lastSeq={{ msg.lastSeq }} 重连… <span v-if="msg.error" class="muted">({{ msg.error }})</span></div>
    <div v-if="msg.status === 'error'" class="notice err">{{ msg.error }} <button @click="emit('resume')">从断点续接</button> <button @click="emit('regenerate')">重新生成</button></div>
    <div v-if="msg.citations.length" class="cites">
      <div v-for="c in msg.citations" :key="c.n" :class="['cite-item', { on: openCite === c.n }]" @click="toggleCite(c.n)">[{{ c.n }}] {{ c.title }} <span class="muted">· {{ c.source }}</span></div>
    </div>
    <div class="actions">
      <button v-if="busy" @click="emit('stop')">停止</button>
      <button v-if="!busy && isLast" @click="emit('regenerate')">重新生成</button>
      <button v-if="!busy" @click="copy">复制</button>
    </div>
  </div>
</template>
