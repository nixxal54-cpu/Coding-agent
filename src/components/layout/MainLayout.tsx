import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Toaster } from "react-hot-toast";

export default function MainLayout() {
  return (
    <div className="flex bg-bg-base text-text-primary h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden h-full">
        <Outlet />
      </main>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: "#1c2128",
            color: "#e6edf3",
            border: "1px solid #30363d",
          },
        }}
      />
    </div>
  );
}
