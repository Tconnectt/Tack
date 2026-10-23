import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { DashboardPage } from "./pages/DashboardPage";
import { EquipmentDetailPage } from "./pages/EquipmentDetailPage";
import { EditEquipmentPage, NewEquipmentPage } from "./pages/EquipmentFormPage";
import { EquipmentListPage } from "./pages/EquipmentListPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="equipment" element={<EquipmentListPage />} />
        <Route path="equipment/new" element={<NewEquipmentPage />} />
        <Route path="equipment/:id" element={<EquipmentDetailPage />} />
        <Route path="equipment/:id/edit" element={<EditEquipmentPage />} />
        <Route
          path="*"
          element={
            <p className="py-10 text-center text-slate-700">
              That page does not exist.
            </p>
          }
        />
      </Route>
    </Routes>
  );
}
