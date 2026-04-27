import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Zap } from "lucide-react";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./components/AuthPage.tsx";
import { useAuth } from "./hooks/useAuth.ts";

const queryClient = new QueryClient();

const AuthGate = () => {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex flex-col h-screen bg-indigo-950 items-center justify-center gap-4">
        <div className="bg-indigo-500 p-3 rounded-2xl shadow-inner animate-pulse">
          <Zap size={32} className="text-white" fill="white" />
        </div>
        <p className="text-indigo-300 text-xs font-black uppercase tracking-[0.3em]">LifeOS…</p>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthGate />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
