import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import Header from './components/Header';
import Footer from './components/Footer';
import AdminOrderNotification from './components/AdminOrderNotification';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Cadastrar from './pages/Cadastrar';
import Produtos from './pages/Produtos';
import Carrinho from './pages/Carrinho';
import Sobre from './pages/Sobre';
import Contato from './pages/Contato';
import Perfil from './pages/Perfil';
import Pedidos from './pages/Pedidos';
import PainelAdmin from './pages/admin/PainelAdmin'; 
import AddAddress from './pages/AddAddress';
import AddPhone from './pages/AddPhone';
import Checkout from './pages/Checkout';
import EsqueciSenha from './pages/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import ProdutoDetalhes from './pages/ProdutoDetalhes';

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname === '/' || location.pathname === '/admin';

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdminRoute && <Header />}
      {!isAdminRoute && <AdminOrderNotification />}
      <main className="flex-1 pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={
            <ProtectedAdminRoute>
              <PainelAdmin />
            </ProtectedAdminRoute>
          } />
          <Route path="/home" element={<Home />} />
          <Route path="/loja" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Cadastrar />} />
          <Route path="/forgot-password" element={<EsqueciSenha />} />
          <Route path="/reset-password" element={<RedefinirSenha />} />
          <Route path="/products" element={<Produtos />} />
          <Route path="/products/:id" element={<ProdutoDetalhes />} />
          <Route path="/cart" element={<Carrinho />} />
          <Route path="/about" element={<Sobre />} />
          <Route path="/contact" element={<Contato />} />
          <Route path="/profile" element={<Perfil />} />
          <Route path="/orders" element={<Pedidos />} />
          <Route path="/admin" element={
            <ProtectedAdminRoute>
              <PainelAdmin />
            </ProtectedAdminRoute>
          } /> 
          <Route path="/add-address" element={<AddAddress />} />
          <Route path="/add-phone" element={<AddPhone />} />
          <Route path="/checkout" element={<Checkout />} />
          {/* Rotas adicionais serão adicionadas aqui */}
        </Routes>
      </main>
      {!isAdminRoute && <Footer />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <AppContent />
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
