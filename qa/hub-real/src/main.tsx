import { createRoot } from 'react-dom/client';
import { readDeploymentConfig } from './lib/deployment-config';
import './index.css';
import { installStagingIsolation } from './lib/staging-isolation';
const host = document.getElementById('root')!;
try {
  readDeploymentConfig(import.meta.env);
  installStagingIsolation(import.meta.env);
  void import('./App').then(({default: App}) => createRoot(host).render(<App />))
    .catch(() => { host.textContent='Não foi possível iniciar o aplicativo. Confira a configuração aprovada do ambiente.'; });
} catch { host.textContent='Aplicativo aguardando configuração aprovada do ambiente.'; }
