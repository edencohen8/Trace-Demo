import { defineComponent, h, inject } from 'vue';
import { describeCitation } from './citations.ts';
import { citationInteraction } from './use-evidence-focus.ts';

export default defineComponent({
  name: 'CitationLink',
  props: { badge: { type: String, required: true } },
  emits: { open: (badge: string) => Boolean(badge) },
  setup(props, { emit }) {
    const interaction = inject(citationInteraction, undefined);
    return () => {
      const citation = describeCitation(props.badge);
      return h('button', { type: 'button', class: ['citation citation-link', { 'is-linked': interaction?.active.value.has(props.badge), 'is-previewed': interaction?.hovered.value === props.badge }], dir: 'rtl',
        title: `${citation.description}\n${props.badge}`, 'aria-label': `פתיחת ${citation.description}`,
        'data-evidence': props.badge, onPointerenter: () => interaction?.preview(props.badge),
        onPointerleave: () => interaction?.leave(props.badge), onFocus: () => interaction?.preview(props.badge),
        onBlur: () => interaction?.leave(props.badge), onClick: () => emit('open', props.badge) },
      [citation.short, ' · ', h('bdi', { dir: 'ltr' }, citation.line)]);
    };
  },
});
