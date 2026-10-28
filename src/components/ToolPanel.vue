<script setup lang="ts">
/** 工具调用面板:planned 时可编辑参数、确认 / 跳过;之后显示执行状态与结果 */
import { ref } from 'vue';
import type { ToolCall } from '../protocol/types';

const props = defineProps<{ tool: ToolCall }>();
const emit = defineEmits<{ confirm: [decision: 'run' | 'skip', args?: Record<string, unknown>] }>();
const LABEL = { planned: '待确认', executing: '执行中', done: '完成', failed: '失败', skipped: '已跳过' } as const;

const text = ref(JSON.stringify(props.tool.args, null, 2));
const err = ref('');
const run = () => { try { emit('confirm', 'run', JSON.parse(text.value)); } catch { err.value = '参数不是合法 JSON'; } };
</script>

<template>
  <div :class="['tool', tool.status]">
    <div class="tool-head"><b>工具调用</b> <code>{{ tool.name }}</code> <span :class="['chip', tool.status]">{{ LABEL[tool.status] }}</span></div>
    <div class="muted">{{ tool.reason }}</div>
    <template v-if="tool.status === 'planned'">
      <textarea v-model="text" rows="4" spellcheck="false" @input="err = ''" />
      <div v-if="err" class="notice err">{{ err }}</div>
      <div class="actions"><button class="primary" @click="run">确认执行</button><button @click="emit('confirm', 'skip')">跳过</button></div>
    </template>
    <pre v-else class="tool-args">{{ JSON.stringify(tool.args) }}</pre>
    <div v-if="tool.result" class="tool-result">结果:{{ tool.result }}</div>
  </div>
</template>
