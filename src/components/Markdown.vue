<script setup lang="ts">
/**
 * 流式 Markdown:content 每帧变化,整段重新解析(markdown-it 解析几 KB 文本不到 1ms,比 DOM diff 便宜);
 * html 走 computed 缓存,父组件无关更新不会触发重解析。
 * 代码块复制、引用角标点击都走根节点的事件委托,不用给 v-html 里的元素绑事件。
 */
import { computed } from 'vue';
import { renderMarkdown } from '../markdown';

const props = defineProps<{ content: string }>();
const emit = defineEmits<{ cite: [n: number] }>();
const html = computed(() => renderMarkdown(props.content));

function onClick(e: MouseEvent) {
  const el = e.target as HTMLElement;
  const cite = el.closest<HTMLElement>('sup.cite');
  if (cite) { emit('cite', Number(cite.dataset.n)); return; }
  const btn = el.closest<HTMLButtonElement>('button.copy');
  if (btn) {
    const text = btn.closest('.code')?.querySelector('pre')?.textContent ?? '';
    navigator.clipboard?.writeText(text);
    btn.textContent = '已复制'; setTimeout(() => { btn.textContent = '复制'; }, 1200);
  }
}
</script>

<template>
  <div class="md" v-html="html" @click="onClick" />
</template>
