import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

const AppLayout = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 min-w-0 px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
