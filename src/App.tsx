import { Navigate, Route, Routes } from "react-router-dom";
import { Pokedex } from "./pages/Pokedex.tsx";
import { Admin } from "./pages/Admin.tsx";

export function App() {
  return (
    <Routes>
      <Route path="/pokedex" element={<Pokedex />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/pokedex" replace />} />
    </Routes>
  );
}
