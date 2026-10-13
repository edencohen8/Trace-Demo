import { defineComponent, h, type VNodeChild } from 'vue';
import { marked, type Token, type Tokens } from 'marked';
import { splitCitations } from './client.ts';
import CitationLink from './CitationLink.ts';

function textNodes(text: string, open: (badge: string) => void): VNodeChild[] {
  return splitCitations(text).map((part) => part.citation
    ? h(CitationLink, { badge: part.text, onOpen: open })
    : part.text);
}

// Tokenize Markdown, then create Vue nodes. Model output is never executed as HTML.
function renderTokens(tokens: Token[], open: (badge: string) => void): VNodeChild[] {
  return tokens.flatMap((token): VNodeChild[] => {
    const children = () => renderTokens('tokens' in token ? token.tokens ?? [] : [], open);
    switch (token.type) {
      case 'space': case 'def': return [];
      case 'paragraph': return [h('p', children())];
      case 'heading': return [h('h4', children())];
      case 'strong': return [h('strong', children())];
      case 'em': return [h('em', children())];
      case 'del': return [h('del', children())];
      case 'br': return [h('br')];
      case 'hr': return [h('hr')];
      case 'blockquote': return [h('blockquote', children())];
      case 'codespan': return [h('code', { dir: 'ltr' }, textNodes(String(token.text), open))];
      case 'code': return [h('pre', { dir: 'ltr' }, [h('code', String(token.text))])];
      case 'list': {
        const list = token as Tokens.List;
        return [h(list.ordered ? 'ol' : 'ul', list.ordered ? { start: list.start } : {},
          list.items.map((item) => h('li', renderTokens(item.tokens, open))))];
      }
      case 'table': {
        const table = token as Tokens.Table;
        const rows = table.rows.map((row) => h('tr', row.map((cell) => h('td', renderTokens(cell.tokens, open)))));
        return [h('div', { class: 'message-table' }, [h('table', [
          h('thead', [h('tr', table.header.map((cell) => h('th', renderTokens(cell.tokens, open))))]),
          h('tbody', rows),
        ])])];
      }
      // Keep link text, but do not load images or activate model-authored URLs.
      case 'link': case 'image': return children();
      case 'text': case 'escape': return 'tokens' in token && token.tokens ? children() : textNodes(String(token.text), open);
      case 'html': return [String(token.text)];
      default: return [String(token.raw ?? '')];
    }
  });
}

export default defineComponent({
  name: 'MessageBody',
  props: { text: { type: String, required: true } },
  emits: { citation: (badge: string) => Boolean(badge) },
  setup(props, { emit }) {
    return () => h('div', { class: 'message-text markdown-message', dir: /[\u0590-\u05ff]/.test(props.text) ? 'rtl' : 'auto' },
      renderTokens(marked.lexer(props.text, { gfm: true, breaks: true }), (badge) => emit('citation', badge)));
  },
});
