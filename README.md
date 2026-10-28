# Stream Chat Demo · Vue 3 — AI 对话交互的最小实现

在线:https://gluneko.github.io/Gluneko/me/chat-vue/ ｜ React 版:https://github.com/Gluneko/stream-chat-demo

一个只关心"AI 对话这类产品最难的交互层"的演示:流式输出怎么不丢不重、断线和刷新怎么恢复、停止怎么不留半截、工具调用怎么让人确认、高频帧怎么不卡。协议、状态机、冲刷器、传输层都是手写的,与 React 版共用同一份代码;UI 层用 Vue 3 `<script setup>` + Pinia,Markdown 用 markdown-it。

## 能演示什么

| 场景 | 怎么触发 | 看什么 |
|---|---|---|
| 流式输出 | 发任意问题 | 打字机、状态芯片 `生成中`、`seq` 递增 |
| 工具调用 + 人在回路 | 问"帮我查一下杭州天气" | 面板里改参数 → 确认执行 / 跳过 → 执行中 → 结果 |
| 断线续传 | 生成中点"模拟断网",再"恢复网络" | `重连中`、退避重连、恢复后 `重复 1`(服务端故意多补一帧,客户端去重) |
| 刷新恢复 | 生成中直接刷新页面 | 已输出的内容还在,从 `lastSeq` 续接,不重跑 |
| 两级停止 | 点"停止" | 先服务端 stop 保存现场,再本地 abort,状态 `已停止` |
| 随机断流 | 把"随机断流"调到 50% | 连接反复被掐,内容依然连续,`缺口 0` |
| 真实模型 | 传输切到 OpenAI 兼容,"配置接口"填 baseURL / key | 真实流式;上游不支持续传,重连走 `isAll` 快照对齐的降级路径 |

## 结构

```
src/protocol/types.ts            帧协议:text / tool_call / tool_status / citation / done / error,每帧 uniqueId + seq
src/protocol/machine.ts          applyFrame:去重、缺口检测、isAll 对齐、状态流转(纯函数,有单测);backoff
src/stream/scheduler.ts          rAF 固定节奏冲刷:数据节奏与渲染节奏解耦,缓冲不丢帧只合并
src/transport/*                  Transport 接口 + 页内 mock 服务端(续传补发、工具暂停、localStorage 持久化、网络模拟)+ OpenAI 兼容流式
src/stores/chat.ts               Pinia store:会话与消息、按 id 替换单条消息、deep watch 持久化
src/composables/useStreamController.ts  控制器:send / stop / regenerate / resume / confirmTool / 刷新恢复 / 退避重连 / 传输切换
src/markdown.ts                  markdown-it:html:false 保证 v-html 安全、fence 自定义渲染、[n] 引用角标 inline 规则
src/components/*.vue             消息列表(watch + nextTick 跟随到底)、Markdown(事件委托)、工具面板、顶栏(Teleport 弹层)
```

## Vue 3 上的几个取舍

- **响应式边界**:`MockServer`、`OpenAICompat` 带定时器和回调,用 `markRaw` 排除在代理之外;`transport` 只需要"换了一个"是响应式的,用 `shallowRef`。连接句柄放普通 `Map`,不进 store。
- **状态更新粒度**:每帧把若干 frame reduce 成一条新消息对象,按索引替换 `messages[i]`;模板按 `message.id` 做 key,重渲染范围就是这一条。
- **终态判断不依赖 store**:`done` 帧可能还在冲刷器缓冲里,`onClose` 时 store 里的 status 未必已更新,所以在帧流上单独记 `terminal` 标记(和 React 版处理 dispatch 异步的问题同源)。
- **Markdown 安全**:markdown-it 关闭 `html`,模型输出里的标签一律转义,`v-html` 才敢用;复制按钮与引用角标走根节点事件委托,不往 v-html 内部绑事件。
- **懒加载**:Markdown 组件(markdown-it + highlight.js,约 60KB gzip)用 `defineAsyncComponent`,首屏不为它付费。
- **Teleport**:BYOK 配置弹层挂到 body,脱离顶栏的层叠上下文,逻辑仍留在顶栏组件里。

## 本地跑

```bash
pnpm install
pnpm test     # 协议状态机单测
pnpm dev      # http://localhost:3301/Gluneko/me/chat-vue/
pnpm build
```
