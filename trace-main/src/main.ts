import { createApp } from 'vue';
import DemoApp from './demo/DemoApp.vue';
import './demo/demo.css';

// The working app is the only entry point. Old study links must not load mock UI.
const url = new URL(location.href);
if (url.searchParams.has('variant')) {
  url.searchParams.delete('variant');
  history.replaceState(null, '', url);
}

createApp(DemoApp).mount('#app');
