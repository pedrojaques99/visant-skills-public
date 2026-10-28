/*
 * Fixture of the `killer-scan --init-report` route reader. Contract (see
 * runSelfTest): 3 routes with a screen, 1 redirect, the layout route without a
 * path and the commented-out route left out.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import { PremiumGate } from './components/PremiumGate';
import { Pricing } from './pages/Pricing';

const Canvas = lazy(() => import('./pages/Canvas').then((m) => ({ default: m.Canvas })));

/* page defined in the router itself: the file is App */
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
