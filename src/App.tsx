import { Navigate, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home.tsx";
import { Pokedex } from "./pages/Pokedex.tsx";
import { Admin } from "./pages/Admin.tsx";

export function App() {
  return (
    <Routes>
      <Route path="/home" element={<Home />} />
      <Route path="/pokedex" element={<Pokedex />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
