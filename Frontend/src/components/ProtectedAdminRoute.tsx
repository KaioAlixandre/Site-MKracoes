import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './Loading';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return <Loading fullScreen text="Verificando permissões..." />;
  }

  // Se não estiver logado, redirecionar para login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se não for admin ou master, redirecionar para login
  if (user.funcao !== 'admin' && user.funcao !== 'master') {
    return <Navigate to="/login" replace />;
  }

  // Se passou todas as verificações, renderizar o conteúdo
  return <>{children}</>;
};

export default ProtectedAdminRoute;

