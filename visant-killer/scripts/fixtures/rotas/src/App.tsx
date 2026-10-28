/*
 * Fixture do leitor de rotas do `killer-scan --init-report`. Contrato (ver
 * runSelfTest): 3 rotas com tela, 1 redirecionamento, a rota de layout sem
 * path e a rota comentada fora.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import { PremiumGate } from './components/PremiumGate';
import { Pricing } from './pages/Pricing';

const Canvas = lazy(() => import('./pages/Canvas').then((m) => ({ default: m.Canvas })));

/* página definida no próprio roteador: o arquivo é o App */
function HomeRoute() {
  return null;
}

// <Route path="/comentada" element={<Pricing />} />
export function App({ Layout }: { Layout: React.ComponentType }) {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route
        path="/canvas/:id"
        element={
          <PremiumGate toolName="Canvas">
            <Canvas />
          </PremiumGate>
        }
      />
      <Route path="/old" element={<Navigate to="/pricing" replace />} />
      <Route element={<Layout />} />
    </Routes>
  );
}
