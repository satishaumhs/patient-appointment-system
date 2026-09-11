import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../context/AuthContext";
import { MenuIcon } from "./icons";

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center h-14 px-4 lg:px-6 bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 -ml-1.5 rounded-md text-gray-600 hover:bg-gray-100"
              aria-label="Open menu"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <Logo imgClassName="w-8 h-8" textClassName="text-sm font-semibold text-gray-900" />
          </div>
          {user?.role === "doctor" && (
            <div className="ml-auto">
              <NotificationBell />
            </div>
          )}
        </header>

        <main className="flex-1 px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
