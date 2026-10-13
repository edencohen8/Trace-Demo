import { defineComponent, h } from 'vue';
import { describeCitation } from './citations.ts';

export default defineComponent({
  name: 'CitationLink',
  props: { badge: { type: String, required: true } },
  emits: { open: (badge: string) => Boolean(badge) },
  setup(props, { emit }) {
    return () => {
      const citation = describeCitation(props.badge);
      return h('button', { type: 'button', class: 'citation citation-link', dir: 'rtl',
        title: `${citation.description}\n${props.badge}`, 'aria-label': `פתיחת ${citation.description}`,
        'data-evidence': props.badge, onClick: () => emit('open', props.badge) },
      [citation.short, ' · ', h('bdi', { dir: 'ltr' }, citation.line)]);
    };
  },
});
