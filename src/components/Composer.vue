<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ disabled: boolean; busy: boolean }>();
const emit = defineEmits<{ send: [text: string]; stop: [] }>();
const text = ref('');
const submit = () => { const t = text.value.trim(); if (!t || props.disabled) return; emit('send', t); text.value = ''; };
// Enter 发送,Shift+Enter 换行;输入法合成中的 Enter 不发送
const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); } };
</script>

<template>
  <div class="composer">
    <textarea v-model="text" rows="2" placeholder="输入问题,Enter 发送,Shift+Enter 换行" @keydown="onKey" />
    <button v-if="busy" class="danger" @click="emit('stop')">停止</button>
    <button v-else class="primary" :disabled="disabled || !text.trim()" @click="submit">发送</button>
  </div>
</template>
