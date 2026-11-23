import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { DiaryProvider, useDiary } from './context/DiaryContext';
import { ClosedBookAccess } from './components/ClosedBookAccess';
import { BookReader } from './components/BookReader';
import { EditorDashboard } from './components/EditorDashboard';

function ProtectedRoutes() {
  const { session, authLoading } = useDiary();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0b0c10] text-[#e8e6e3] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-serif-title text-lg tracking-widest text-[#c5a059]">
            ASH&apos;S PERSONAL DIARY
          </p>
          <p className="text-xs text-[#8e929b]">Checking vault seal…</p>
        </div>
      </div>
    );
  }

  if (!session.authenticated) {
    return (
      <Routes>
        <Route path="*" element={<ClosedBookAccess />} />
      </Routes>
    );
  }

  const isEditor = session.role === 'EDITOR';

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={isEditor ? '/editor' : '/reader'} replace />}
      />
      <Route path="/reader" element={<BookReader />} />
      <Route path="/preview" element={<BookReader />} />
      <Route
        path="/editor"
        element={isEditor ? <EditorDashboard /> : <Navigate to="/reader" replace />}
      />
      <Route
        path="/admin"
        element={isEditor ? <EditorDashboard /> : <Navigate to="/reader" replace />}
      />
      <Route
        path="*"
        element={<Navigate to={isEditor ? '/editor' : '/reader'} replace />}
      />
    </Routes>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <DiaryProvider>
            <BrowserRouter>
              <ProtectedRoutes />
            </BrowserRouter>
          </DiaryProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
