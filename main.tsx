import './index.css';
import { createRoot } from 'react-dom/client';
import K8sTypeScriptIaCGenerator from './app';

const root = createRoot(document.getElementById('root')!);
root.render(<K8sTypeScriptIaCGenerator />);