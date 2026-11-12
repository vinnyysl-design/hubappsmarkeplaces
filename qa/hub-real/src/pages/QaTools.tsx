import { Navigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import QaToolAccess from "@/components/QaToolAccess";
import { closeQaTools } from "@/lib/qa-tool-shutdown";
import { QA_HUB, QA_OWNER } from "@/lib/qa-tool-bridge";
export default function QaTools() {
 const { user, logout } = useAuth();
 const [ending,setEnding]=useState(false);
 if(import.meta.env.VITE_DEPLOYMENT_STAGE!=="staging"||location.origin!==QA_HUB||user?.id!==QA_OWNER)return <Navigate to="/" replace/>;
 return <main className="p-4">
  <h1>Verificação QA conjunta: Ads e Vision</h1>
  <p>Abra ambas as ferramentas nesta página antes de encerrar. Não navegue entre páginas, atualize a aba ou execute análises. Encerrar uma ferramenta torna esta execução terminal.</p>
  <h2>AdsEngine</h2><QaToolAccess app="adsengine"/>
  <h2>Vision X</h2><QaToolAccess app="vision-x"/>
  <button disabled={ending} onClick={()=>{setEnding(true);void closeQaTools().finally(()=>logout());}}>Encerrar ambas e sair do Hub</button>
 </main>;
}
