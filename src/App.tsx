// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Auth from './components/Auth';
import Dashboard from './pages/Dashboard';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';

function App() {
  const { message, type, showToast, hideToast } = useToast();

  return (
    <Router>
      <div className="App">
        {/* Toast sẽ luôn hiển thị trên tất cả các trang */}
        {message && <Toast message={message} type={type} onClose={hideToast} />}
        
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<Auth showToast={showToast} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;