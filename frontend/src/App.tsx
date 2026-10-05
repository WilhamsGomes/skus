import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import { LoadingState } from "./components/ui/States";
import { LoginPage } from "./pages/LoginPage";

const OverviewPage = lazy(() => import("./pages/OverviewPage").then((m) => ({ default: m.OverviewPage })));
const RunsPage = lazy(() => import("./pages/RunsPage").then((m) => ({ default: m.RunsPage })));
const RunDetailPage = lazy(() => import("./pages/RunDetailPage").then((m) => ({ default: m.RunDetailPage })));
const ItemsPage = lazy(() => import("./pages/ItemsPage").then((m) => ({ default: m.ItemsPage })));
const QueuesPage = lazy(() => import("./pages/QueuesPage").then((m) => ({ default: m.QueuesPage })));
const CachePage = lazy(() => import("./pages/CachePage").then((m) => ({ default: m.CachePage })));
const DeliveriesPage = lazy(() => import("./pages/DeliveriesPage").then((m) => ({ default: m.DeliveriesPage })));
const RegistrationPage = lazy(() =>
  import("./pages/RegistrationPage").then((m) => ({ default: m.RegistrationPage })),
);

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Lazy page={<OverviewPage />} />} />
        <Route path="runs" element={<Lazy page={<RunsPage />} />} />
        <Route path="runs/:runId" element={<Lazy page={<RunDetailPage />} />} />
        <Route path="items" element={<Lazy page={<ItemsPage />} />} />
        <Route path="queues" element={<Lazy page={<QueuesPage />} />} />
        <Route path="cache" element={<Lazy page={<CachePage />} />} />
        <Route path="deliveries" element={<Lazy page={<DeliveriesPage />} />} />
        <Route path="registration" element={<Lazy page={<RegistrationPage />} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Lazy({ page }: { page: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{page}</Suspense>;
}
