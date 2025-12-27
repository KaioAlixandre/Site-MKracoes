import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Menu, X, LogOut, Home, Package, Info, Mail, UserCircle, ShoppingBag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

// Componente NavLink customizado
interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, children, icon }) => (
  <Link
    to={to}
    className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-700 hover:text-purple-600 hover:bg-purple-50 transition-all duration-200 group font-medium"
  >
    <span className="text-gray-500 group-hover:text-purple-600 transition-colors duration-200">
      {icon}
    </span>
    <span>{children}</span>
  </Link>
);

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useAuth();
  const { items } = useCart();
  const navigate = useNavigate();

  const cartItemsCount = items.reduce((total, item) => total + item.quantity, 0);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/home');
    setIsUserMenuOpen(false);
  };

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-white/95 backdrop-blur-md shadow-lg' 
        : 'bg-white shadow-md'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group md:flex-row">
            <div className="relative w-12 h-12 flex items-center justify-center transition-all duration-300 group-hover:scale-105">
              <img 
                src="/logo.jpg" 
                alt="Açaí DiCasa" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xl font-black text-gray-900 group-hover:text-purple-600 transition-colors duration-300">
                AçaíDíCasa
              </span>
            </div>
          </Link>

          {/* Logo Text Centered for Mobile */}
          <div className="md:hidden absolute left-1/2 transform -translate-x-1/2">
            <div className="flex flex-col items-center">
              <span className="text-xl font-black text-gray-900">
                AçaíDíCasa
              </span>
              <span className="text-xs text-purple-600 font-medium -mt-1">
                Sabor Autêntico
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            <NavLink to="/" icon={<Home size={18} />}>
              Início
            </NavLink>
            <NavLink to="/products" icon={<Package size={18} />}>
              Produtos
            </NavLink>
            <NavLink to="/about" icon={<Info size={18} />}>
              Sobre
            </NavLink>
            <NavLink to="/contact" icon={<Mail size={18} />}>
              Contato
            </NavLink>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Cart */}
            <Link
              to="/cart"
              className="relative group p-3 bg-gray-50 hover:bg-purple-50 rounded-xl transition-all duration-200 hover:shadow-md"
            >
              <ShoppingCart size={20} className="text-gray-600 group-hover:text-purple-600 transition-colors duration-200" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
                  {cartItemsCount}
                </span>
              )}
            </Link>

            {/* User Menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-3 p-2 px-4 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-xl transition-all duration-200 hover:shadow-md group"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-md">
                    <UserCircle size={16} className="text-white" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold text-gray-800 group-hover:text-purple-700 transition-colors">
                      {user.nomeUsuario}
                    </span>
                    <span className="text-xs text-gray-500">
                      {user.funcao === 'admin' ? 'Administrador' : 'Cliente'}
                    </span>
                  </div>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-800">{user.nomeUsuario}</p>
                      <p className="text-xs text-gray-500">{user.telefone}</p>
                    </div>
                    
                    <Link
                      to="/profile"
                      className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-all duration-200"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <User size={16} />
                      <span>Meu Perfil</span>
                    </Link>
                    
                    <Link
                      to="/orders"
                      className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-all duration-200"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <ShoppingBag size={16} />
                      <span>Meus Pedidos</span>
                    </Link>
                    
                    {user.funcao === 'admin' && (
                      <Link
                        to="/admin"
                        className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-all duration-200"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Package size={16} />
                        <span>Dashboard Admin</span>
                      </Link>
                    )}
                    
                    <hr className="my-2" />
                    
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all duration-200"
                    >
                      <LogOut size={16} />
                      <span>Sair</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="px-4 py-2 text-gray-700 hover:text-purple-600 font-medium transition-colors duration-200"
                >
                  Entrar
                </Link>
                <Link
                  to="/register"
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Cadastrar
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-3">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 bg-purple-50 hover:bg-purple-100 rounded-xl transition-all duration-200"
            >
              {isMenuOpen ? 
                <X size={20} className="text-purple-600" /> : 
                <Menu size={20} className="text-purple-600" />
              }
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden animate-in slide-in-from-top-2 duration-200">
            <div className="mx-4 mb-4 p-4 bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-100">
              {/* Navigation Links */}
              <div className="space-y-2">
                <MobileNavLink to="/" icon={<Home size={18} />} onClick={() => setIsMenuOpen(false)}>
                  Início
                </MobileNavLink>
                <MobileNavLink to="/products" icon={<Package size={18} />} onClick={() => setIsMenuOpen(false)}>
                  Produtos
                </MobileNavLink>
                <MobileNavLink to="/about" icon={<Info size={18} />} onClick={() => setIsMenuOpen(false)}>
                  Sobre
                </MobileNavLink>
                <MobileNavLink to="/contact" icon={<Mail size={18} />} onClick={() => setIsMenuOpen(false)}>
                  Contato
                </MobileNavLink>
              </div>
              
              {/* Divider */}
              <hr className="my-4 border-gray-200" />
              
              {user ? (
                <div className="space-y-2">
                  {/* User Info */}
                  <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-md">
                      <UserCircle size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{user.nomeUsuario}</p>
                      <p className="text-xs text-gray-500">
                        {user.funcao === 'admin' ? 'Administrador' : 'Cliente'}
                      </p>
                    </div>
                  </div>
                  
                  <MobileNavLink to="/profile" icon={<User size={18} />} onClick={() => setIsMenuOpen(false)}>
                    Meu Perfil
                  </MobileNavLink>
                  <MobileNavLink to="/orders" icon={<ShoppingBag size={18} />} onClick={() => setIsMenuOpen(false)}>
                    Meus Pedidos
                  </MobileNavLink>
                  
                  {user.funcao === 'admin' && (
                    <MobileNavLink to="/admin" icon={<Package size={18} />} onClick={() => setIsMenuOpen(false)}>
                      Dashboard Admin
                    </MobileNavLink>
                  )}
                  
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center space-x-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
                  >
                    <LogOut size={18} />
                    <span className="font-medium">Sair</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    to="/login"
                    className="flex items-center justify-center w-full px-4 py-3 text-gray-700 hover:text-purple-600 font-medium transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/register"
                    className="flex items-center justify-center w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Cadastrar
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

// Componente para links do menu mobile
interface MobileNavLinkProps {
  to: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}

const MobileNavLink: React.FC<MobileNavLinkProps> = ({ to, children, icon, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all duration-200 font-medium"
  >
    <span className="text-gray-500">{icon}</span>
    <span>{children}</span>
  </Link>
);

export default Header;
