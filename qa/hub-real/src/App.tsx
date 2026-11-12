import {lazy,Suspense,useEffect,useState} from "react";
const OrdinaryApp=lazy(()=>import("./OrdinaryApp"));
const QaIdentityEntry=lazy(()=>import("./pages/QaIdentityEntry"));
const qaPath=(path:string)=>path==="/qa-tools"||path==="/qa-auth";
// Each document chooses one auth tree. Crossing trees requires a fresh document,
// never mounting ordinary AuthProvider alongside a QA credential.
export default function App(){
 const [initialQa]=useState(()=>qaPath(location.pathname));
 const [blocked,setBlocked]=useState(false);
 useEffect(()=>{const changed=()=>{if(initialQa||qaPath(location.pathname))setBlocked(true);};
 window.addEventListener("popstate",changed);return()=>window.removeEventListener("popstate",changed);},[initialQa]);
 if(blocked)return <p>Execucao encerrada por navegacao. Nao reinicie o teste.</p>;
 return <Suspense fallback={<p>Carregando...</p>}>{initialQa?<QaIdentityEntry/>:<OrdinaryApp/>}</Suspense>;
}
