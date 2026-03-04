import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "@/components/Header";
import Index from "./pages/Index";
import CatalogPage from "./pages/CatalogPage";
import ResultPage from "./pages/ResultPage";
import ReconstructionUploadPage from "./pages/ReconstructionUploadPage";
import ReconstructionStatusPage from "./pages/ReconstructionStatusPage";
import ReconstructionViewerPage from "./pages/ReconstructionViewerPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/try-it" element={<ReconstructionUploadPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/reconstruction/new" element={<ReconstructionUploadPage />} />
          <Route path="/reconstruction/:projectId" element={<ReconstructionStatusPage />} />
          <Route path="/reconstruction/:projectId/view" element={<ReconstructionViewerPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
