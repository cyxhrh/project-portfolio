import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webDarkTheme } from '@fluentui/react-components';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={webDarkTheme}>
      <App />
    </FluentProvider>
  </StrictMode>,
);
