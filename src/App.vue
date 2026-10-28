<script setup lang="ts">
import { computed, markRaw, ref, shallowRef, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from './stores/chat';
import { MockServer } from './transport/mockServer';
import { OpenAICompat, type OpenAIConfig } from './transport/openaiCompat';
import type { NetworkConfig, Transport } from './transport/types';
import { useStreamController } from './composables/useStreamController';
import NetworkBar from './components/NetworkBar.vue';
import MessageList from './components/MessageList.vue';
import Composer from './components/Composer.vue';

// 单例:它就是"服务端",状态在 localStorage 里,刷新不丢。markRaw:带定时器和回调的对象不该被深层代理
const mock = markRaw(new MockServer());
const LS_OA = 'chat-demo-vue:openai';

const store = useChatStore();
store.persist();
const { sessions, activeId, active: session } = storeToRefs(store);

const mode = ref<'mock' | 'openai'>('mock');
const network = ref<NetworkConfig>({ offline: false, latencyMs: 60, dropRate: 0 });
const openai = ref<OpenAIConfig>((() => { try { return JSON.parse(localStorage.getItem(LS_OA) || 'null') || { baseURL: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' }; } catch { return { baseURL: '', apiKey: '', model: '' }; } })());
watch(openai, v => { try { localStorage.setItem(LS_OA, JSON.stringify(v)); } catch { /* ignore */ } }, { deep: true });
watch(network, v => { mock.network = { ...v }; }, { immediate: true, deep: true });

// 传输对象只需要"换了一个"这件事是响应式的,内部不需要:shallowRef + markRaw
const transport = shallowRef<Transport>(mock);
watch([mode, openai], ([m, cfg]) => { transport.value = m === 'mock' ? mock : markRaw(new OpenAICompat({ ...cfg })); }, { deep: true });

const ctl = useStreamController(transport);
const last = computed(() => session.value.messages[session.value.messages.length - 1]);
const busy = computed(() => !!last.value && last.value.role === 'assistant' && ['connecting', 'streaming', 'tool_calling', 'awaiting_confirm', 'reconnecting'].includes(last.value.status));
</script>

<template>
  <div class="app">
    <NetworkBar v-model:mode="mode" v-model:network="network" v-model:openai="openai" />
    <div class="body">
      <aside class="side">
        <button class="primary wide" @click="store.newSession()">+ 新对话</button>
        <div v-for="s in sessions" :key="s.id" :class="['sess', { on: s.id === activeId }]" @click="store.select(s.id)">
          <span>{{ s.title }}</span><button class="x" @click.stop="store.remove(s.id)">×</button>
        </div>
        <div class="legend">
          <div><b>状态机</b></div>
          <div>idle → connecting → streaming ⇄ tool_calling / awaiting_confirm → complete</div>
          <div>任一步断连 → reconnecting(退避,带 lastSeq)</div>
          <div>停止 → aborted(先服务端 stop 再本地 abort)</div>
          <div style="margin-top: 8px"><b>Vue 3</b></div>
          <div>Pinia store · composable 控制器 · shallowRef / markRaw 隔离非 UI 对象 · defineAsyncComponent 懒加载 Markdown · Teleport 弹层</div>
        </div>
      </aside>
      <main class="main">
        <MessageList :messages="session.messages"
          @stop="id => ctl.stop(session.id, id)"
          @regenerate="id => ctl.regenerate(session.id, id)"
          @resume="id => ctl.resume(session.id, id)"
          @confirm-tool="(id, callId, d, a) => ctl.confirmTool(session.id, id, callId, d, a)" />
        <Composer :disabled="busy || (mode === 'openai' && !openai.apiKey)" :busy="busy" @send="t => ctl.send(session.id, t)" @stop="last && ctl.stop(session.id, last.id)" />
      </main>
    </div>
  </div>
</template>
