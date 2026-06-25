import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Graficos } from './pages/Graficos';
import { EstadoEstaciones } from './pages/EstadoEstaciones';
import { Mapa } from './pages/Mapa';
import { RegistrarEstacion } from './pages/RegistrarEstacion';
import { ReporteCiudadano } from './pages/ReporteCiudadano';
import { ImportarEstaciones } from './pages/ImportarEstaciones';

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🌫️</span>
          <div>
            <strong>Calidad del Aire</strong>
            <small>ODS 11.6.2 · Material particulado (PM2.5/PM10)</small>
          </div>
        </div>
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/graficos">Gráficos</NavLink>
          <NavLink to="/estado">Estado</NavLink>
          <NavLink to="/mapa">Mapa</NavLink>
          <NavLink to="/estaciones">Registrar estación</NavLink>
          <NavLink to="/importar">Importar (OpenAQ)</NavLink>
          <NavLink to="/reportes">Reporte ciudadano</NavLink>
          <a href="/api/docs" target="_blank" rel="noreferrer">
            API (Swagger) ↗
          </a>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/graficos" element={<Graficos />} />
          <Route path="/estado" element={<EstadoEstaciones />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/estaciones" element={<RegistrarEstacion />} />
          <Route path="/importar" element={<ImportarEstaciones />} />
          <Route path="/reportes" element={<ReporteCiudadano />} />
        </Routes>
      </main>
    </div>
  );
}
