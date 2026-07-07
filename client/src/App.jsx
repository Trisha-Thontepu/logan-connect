import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import BusinessProfile from './pages/BusinessProfile';

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/negocio/:slug" element={<BusinessProfile />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="container">
          <span>Logan Connect — built for the businesses that built the neighborhood.</span>
        </div>
      </footer>
    </BrowserRouter>
  );
}
