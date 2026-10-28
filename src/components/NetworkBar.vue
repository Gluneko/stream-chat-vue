<script setup lang="ts">
/** 顶栏:传输选择、网络模拟开关;BYOK 配置放在 Teleport 到 body 的弹层里 */
import { ref } from 'vue';
import type { NetworkConfig } from '../transport/types';
import type { OpenAIConfig } from '../transport/openaiCompat';

const mode = defineModel<'mock' | 'openai'>('mode', { required: true });
const network = defineModel<NetworkConfig>('network', { required: true });
const openai = defineModel<OpenAIConfig>('openai', { required: true });
const showConfig = ref(false);
</script>

<template>
  <div class="bar">
    <strong>Stream Chat <span class="muted">· Vue 3</span></strong>
    <label>传输
      <select v-model="mode">
        <option value="mock">页内 mock 服务端(支持续传 / 工具调用)</option>
        <option value="openai">OpenAI 兼容接口(BYOK,真实流式)</option>
      </select>
    </label>
    <template v-if="mode === 'mock'">
      <button :class="{ danger: network.offline }" @click="network = { ...network, offline: !network.offline }">{{ network.offline ? '恢复网络' : '模拟断网' }}</button>
      <label>延迟 <input type="range" min="10" max="400" step="10" :value="network.latencyMs" @input="network = { ...network, latencyMs: Number(($event.target as HTMLInputElement).value) }" /> {{ network.latencyMs }}ms/帧</label>
      <label>随机断流 <input type="range" min="0" max="1" step="0.1" :value="network.dropRate" @input="network = { ...network, dropRate: Number(($event.target as HTMLInputElement).value) }" /> {{ network.dropRate ? `${Math.round(network.dropRate * 100)}%` : '关' }}</label>
    </template>
    <template v-else>
      <span class="muted mono">{{ openai.model || '未配置' }} @ {{ openai.baseURL || '-' }}</span>
      <button @click="showConfig = true">配置接口</button>
    </template>
    <a class="muted" href="https://gluneko.github.io/Gluneko/me/" style="margin-left: auto">← 主页</a>
    <a class="muted" href="https://gluneko.github.io/Gluneko/me/chat/">React 版</a>

    <!-- Teleport:弹层挂到 body,脱离顶栏的层叠上下文与 overflow,逻辑仍留在这个组件里 -->
    <Teleport to="body">
      <div v-if="showConfig" class="modal-mask" @click.self="showConfig = false">
        <div class="modal">
          <h3>OpenAI 兼容接口</h3>
          <p class="muted">Key 只存在本机 localStorage,请求直接从浏览器发到你填的 baseURL。</p>
          <label>baseURL <input :value="openai.baseURL" placeholder="https://api.openai.com/v1" @input="openai = { ...openai, baseURL: ($event.target as HTMLInputElement).value }" /></label>
          <label>API Key <input type="password" :value="openai.apiKey" @input="openai = { ...openai, apiKey: ($event.target as HTMLInputElement).value }" /></label>
          <label>model <input :value="openai.model" placeholder="gpt-4o-mini" @input="openai = { ...openai, model: ($event.target as HTMLInputElement).value }" /></label>
          <div class="actions"><button class="primary" @click="showConfig = false">完成</button></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
