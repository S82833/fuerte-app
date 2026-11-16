import {useCallback, useEffect, useRef, useState} from 'react';
import {RefreshCw} from 'lucide-react';
import './refresh.css';

const PULL_DISTANCE = 110;

export function RefreshControl({onRefresh, disabled}: {onRefresh: () => Promise<void>, disabled: boolean}) {
  const [distance, setDistance] = useState(0);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const locked = useRef(false);
  const options = useRef({onRefresh, disabled});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {options.current = {onRefresh, disabled};}, [onRefresh, disabled]);

  const update = useCallback(async () => {
    if (locked.current || options.current.disabled || document.querySelector('.guided-tour-card')) return;
    locked.current = true;
    clearTimeout(timer.current);
    setDistance(0); setRunning(true); setStatus('Actualizando…');
    try {
      await options.current.onRefresh();
      if (mounted.current) setStatus('Información actualizada.');
    } catch {
      if (mounted.current) setStatus('No se pudo actualizar. Revisa tu conexión e inténtalo otra vez.');
    } finally {
      locked.current = false;
      if (mounted.current) {
        setRunning(false);
        timer.current = setTimeout(() => setStatus(''), 6000);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let start: {x: number, y: number} | null = null;
    let pull = 0;
    const cancel = () => {start = null; pull = 0; setDistance(0);};
    const begin = (event: TouchEvent) => {
      cancel();
      if (event.touches.length !== 1 || window.scrollY > 1 || locked.current || options.current.disabled || document.querySelector('.guided-tour-card')) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],nav')) return;
      // A nested scrollable region must keep its own normal touch behavior.
      for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
        if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return;
      }
      start = {x: event.touches[0].clientX, y: event.touches[0].clientY};
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1 || options.current.disabled || window.scrollY > 1) {cancel(); return;}
      const y = event.touches[0].clientY - start.y;
      const x = Math.abs(event.touches[0].clientX - start.x);
      if (y < 0 || x > Math.max(12, y)) {cancel(); return;}
      // Cancel native overscroll only for a downward pull that started at the top.
      if (event.cancelable) event.preventDefault();
      pull = y;
      setDistance(Math.min(y, PULL_DISTANCE));
    };
    const end = () => {
      const shouldRefresh = start !== null && pull >= PULL_DISTANCE;
      cancel();
      if (shouldRefresh) void update();
    };
    document.documentElement.classList.add('fuerte-refresh-enabled');
    document.addEventListener('touchstart', begin, {passive: true});
    document.addEventListener('touchmove', move, {passive: false});
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', cancel);

    // Measure the real bar, including the device safe area and enlarged text.
    const nav = document.querySelector<HTMLElement>('.bottom-nav');
    const shell = nav?.closest<HTMLElement>('.app-shell');
    const measure = () => shell?.style.setProperty('--caregiver-nav-height', `${nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().height : 0}px`);
    const observer = new ResizeObserver(measure);
    if (nav) observer.observe(nav);
    measure();
    window.addEventListener('resize', measure);
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      document.documentElement.classList.remove('fuerte-refresh-enabled');
      document.removeEventListener('touchstart', begin);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', cancel);
    };
  }, [update]);

  const message = distance > 0 ? distance >= PULL_DISTANCE ? 'Suelta para actualizar' : 'Desliza hacia abajo para actualizar' : status;
  return <>
    <button type="button" className="icon-button refresh-button" aria-label="Actualizar información" title="Actualizar información" disabled={disabled || running} onClick={() => void update()}><RefreshCw size={20} className={running ? 'refresh-spinning' : ''}/></button>
    <output aria-live="polite" className={`refresh-status${message ? ' is-visible' : ''}`}><RefreshCw size={18} aria-hidden="true" className={running ? 'refresh-spinning' : ''}/><span>{message}</span></output>
  </>;
}
