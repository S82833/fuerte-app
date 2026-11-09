import {useEffect, useState} from 'react';
import {Download, Smartphone, WifiOff} from 'lucide-react';
import './pwa.css';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
};

export function PwaSupport() {
  const [standalone, setStandalone] = useState(false);
  const [online, setOnline] = useState(true);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)');
    const detectMode = () => setStandalone(mode.matches || Boolean((navigator as Navigator & {standalone?: boolean}).standalone));
    const detectNetwork = () => setOnline(navigator.onLine);
    const offer = (event: Event) => {event.preventDefault(); setInstall(event as InstallEvent);};
    const installed = () => {setInstall(null); setStandalone(true);};
    detectMode(); detectNetwork();
    mode.addEventListener('change', detectMode);
    window.addEventListener('online', detectNetwork);
    window.addEventListener('offline', detectNetwork);
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', installed);
    return () => {
      mode.removeEventListener('change', detectMode);
      window.removeEventListener('online', detectNetwork);
      window.removeEventListener('offline', detectNetwork);
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  async function installApp() {
    if (!install) return;
    setBusy(true); setNotice('');
    try {
      await install.prompt();
      const choice = await install.userChoice;
      if (choice.outcome === 'accepted') setNotice('Sigue los pasos de tu teléfono para terminar la instalación.');
    } catch {
      setNotice('Abre «Cómo instalarla» para usar el menú de tu navegador.');
    } finally {setInstall(null); setBusy(false);}
  }

  return <>
    {!online && <output className="pwa-network"><WifiOff size={19} aria-hidden="true"/>Sin conexión. Conéctate para guardar registros y usar el chat.</output>}
    {!standalone && <section className="pwa-install" aria-label="Instalar Fuerte">
      <div className="pwa-install-heading"><Smartphone size={22} aria-hidden="true"/><div><h2>Fuerte en tu pantalla de inicio</h2><p>Ábrela como una app en tu teléfono.</p></div></div>
      {install && <button type="button" className="action secondary pwa-install-button" disabled={busy} onClick={() => void installApp()}><Download size={18} aria-hidden="true"/>{busy ? 'Abriendo…' : 'Instalar Fuerte'}</button>}
      <details><summary>Cómo instalarla</summary><ul>
        <li><strong>iPhone:</strong> abre Fuerte en Safari, toca Compartir y elige «Añadir a pantalla de inicio». Si aparece «Abrir como app web», déjalo activado.</li>
        <li><strong>Android:</strong> abre Fuerte en Chrome y elige «Instalar aplicación» o «Añadir a pantalla de inicio» en su menú.</li>
      </ul></details>
      {notice && <output className="pwa-install-notice">{notice}</output>}
    </section>}
  </>;
}

export function registerProductWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // Registration never delays account access or form submission.
  const register = () => {void navigator.serviceWorker.register('/fuerte-sw.js', {scope: '/', updateViaCache: 'none'}).catch(() => {});};
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, {once: true});
}
