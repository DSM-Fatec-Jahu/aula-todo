import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './auth/AuthContext.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { ProjectPage } from './pages/ProjectPage.tsx';
import { ProjectsPage } from './pages/ProjectsPage.tsx';
import { SharedPage } from './pages/SharedPage.tsx';

function PrivateLayout() {
  const { user, loading, signOut } = useAuth();
  if (loading) return <main><p className="muted">Carregando…</p></main>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <nav className="topbar">
        <Link to="/" className="brand">
          Todo Cloud
        </Link>
        <span className="muted">{user.name}</span>
        <button type="button" className="link" onClick={signOut}>
          Sair
        </button>
      </nav>
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/s/:token" element={<SharedPage />} />
          <Route element={<PrivateLayout />}>
            <Route index element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
