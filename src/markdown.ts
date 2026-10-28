/**
 * Markdown 渲染(markdown-it):
 *  - html: false,模型输出里的原始 HTML 一律转义,渲染结果才能安全地交给 v-html
 *  - 代码块:只注册常用语言,避免 highlight.js 全量包把包体撑大;输出带语言标签和复制按钮的结构
 *  - 引用角标:inline 规则把 [n] 变成 <sup class="cite" data-n>,点击由组件做事件委托
 */
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';

for (const [name, lang] of Object.entries({ javascript, js: javascript, typescript, ts: typescript, json, bash, sh: bash, python, py: python })) hljs.registerLanguage(name, lang);

const md = new MarkdownIt({ html: false, linkify: false, breaks: false });

// 引用角标 [n]
md.inline.ruler.push('cite', (state, silent) => {
  if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */) return false;
  const m = /^\[(\d+)\]/.exec(state.src.slice(state.pos)); if (!m) return false;
  if (!silent) { const t = state.push('cite', 'sup', 0); t.content = m[1]; }
  state.pos += m[0].length; return true;
});
md.renderer.rules.cite = (tokens, i) => `<sup class="cite" data-n="${tokens[i].content}">[${tokens[i].content}]</sup>`;

// 代码块
md.renderer.rules.fence = (tokens, i) => {
  const t = tokens[i]; const lang = (t.info || '').trim().split(/\s+/)[0];
  const code = lang && hljs.getLanguage(lang) ? hljs.highlight(t.content, { language: lang, ignoreIllegals: true }).value : md.utils.escapeHtml(t.content);
  return `<div class="code"><div class="code-head"><span>${md.utils.escapeHtml(lang || 'text')}</span><button type="button" class="copy">复制</button></div><pre><code class="hljs${lang ? ` language-${md.utils.escapeHtml(lang)}` : ''}">${code}</code></pre></div>`;
};

export const renderMarkdown = (src: string) => md.render(src);
