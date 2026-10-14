import { createApp } from 'vue';
async function start(){
 const variant=new URLSearchParams(location.search).get('variant');
 if(!variant || variant==='demo' || /^G(?:[1-9]|10)$/i.test(variant)){
  const [{default:App}]=await Promise.all([import('./demo/DemoApp.vue'),import('./demo/demo.css')]);
  createApp(App).mount('#app');
 }else if(variant==='original'){
  const [{default:App}]=await Promise.all([import('./App.vue'),import('./style.css')]);
  createApp(App).mount('#app');
 }else if(!variant||/^(?:L|M)?\d+$/i.test(variant)){
  const [{default:App}]=await Promise.all([import('./prototypes/lenses/LensStudy.vue'),import('./prototypes/lenses/lenses.css')]);
  createApp(App).mount('#app');
 }else if(/^T\d+$/i.test(variant)){
  const [{default:App}]=await Promise.all([import('./prototypes/timelines/TimelineStudy.vue'),import('./prototypes/timelines/timelines.css')]);
  createApp(App).mount('#app');
 }else{
  const [{default:App}]=await Promise.all([import('./prototypes/PrototypeApp.vue'),import('./prototypes/prototypes.css')]);
  createApp(App).mount('#app');
 }
}
start();
