import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ConversationPage from "./pages/ConversationPage";
import Settings from "./pages/Settings";
import MainLayout from "./components/layout/MainLayout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="conversations/:id" element={<ConversationPage />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
