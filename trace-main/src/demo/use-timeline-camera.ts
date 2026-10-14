import { onUnmounted, ref } from 'vue';
import { interpolateWindow } from './evidence-focus.ts';
import type { TimeWindow } from './time-window.ts';

export function useTimelineCamera(options: {
  read: () => TimeWindow;
  recording: () => TimeWindow;
  write: (window: TimeWindow) => void;
  settled: () => void;
}) {
  const moving = ref(false);
  let frame = 0;
  function cancel() { cancelAnimationFrame(frame); moving.value = false; }
  function move(to: TimeWindow) {
    cancel();
    const from = options.read(); const recording = options.recording();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !Number.isFinite(from.start)
      || (from.start === to.start && from.end === to.end)) {
      options.write(to); options.settled(); return;
    }
    const started = performance.now(); moving.value = true;
    function tick(now: number) {
      const progress = Math.min(1, (now - started) / 560);
      options.write(interpolateWindow(from, to, progress, recording));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { moving.value = false; options.settled(); }
    }
    frame = requestAnimationFrame(tick);
  }
  onUnmounted(cancel);
  return { moving, move, cancel };
}
