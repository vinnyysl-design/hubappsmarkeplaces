import { qaShutdown } from "@/lib/qa-tool-shutdown";

import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";

import { createHubBridge, QA_APPS, QA_GATE, qaAllowed, qaUserRequest, type QaApp } from "@/lib/qa-tool-bridge";



export default function QaToolAccess({ app }: { app: QaApp }) {

  const { user, session, accessState, status: accountStatus, administrativeBlocked, financialBlocked } = useAuth();

  const [opened, setOpened] = useState(false);

  const [status, setStatus] = useState("QA V3 desativado. Nenhuma conexão será iniciada.");

  const popup = useRef<Window | null>(null);

  const openedSession = useRef<string | null>(null);

  const current = useRef({ user, session, accessState, accountStatus, administrativeBlocked, financialBlocked });

  current.current = { user, session, accessState, accountStatus, administrativeBlocked, financialBlocked };

  const allowed = () => !qaShutdown.terminal() && qaAllowed(QA_GATE, location.origin, current.current.user?.id) && current.current.accessState === "ready" && current.current.accountStatus === "ativo" && current.current.administrativeBlocked === false && current.current.financialBlocked === false &&

    !!current.current.session?.access_token && (current.current.session.expires_at ?? 0) * 1000 > Date.now() + 65000;

  useEffect(() => {

    if (!opened) return;

    if (!allowed() || openedSession.current !== session?.access_token || !popup.current || popup.current.closed) {
      // A popup may exist before its effect registers a shutdown callback.
      // Expiry or identity changes during that gap must close it as well.
      qaShutdown.terminalize();
      void qaShutdown.closeAll();
      try { popup.current?.close(); } catch { /* Closing a detached peer is best effort. */ }
      popup.current = null;
      openedSession.current = null;
      setOpened(false);
      setStatus("Acesso QA encerrado antes da autorização. Não reinicie esta sessão.");
      return;
    }

    let active = true, attempted = false;

    const controller = new AbortController();

    const peer = popup.current!;

    const originalSession = session?.access_token;

    const isCurrent = () => active && !peer.closed && allowed() && current.current.session?.access_token === originalSession;

    const bridge = createHubBridge({ app, peer, active: isCurrent,

      authorize: async body => {

        if (!isCurrent()) throw new Error("UNAVAILABLE");

        attempted = true;

        return qaUserRequest(app, "authorize", body, originalSession!, controller.signal);

      },

      post: (message, origin) => peer.postMessage(message, origin),
      terminated: () => { void qaShutdown.closeAll(); },

      failed: () => { setStatus("Acesso QA indisponível. Não houve repetição automática."); void qaShutdown.closeAll(); },

    });

    const receive = (event: MessageEvent) => { void bridge.receive(event).then(sent => { if (sent && isCurrent()) setStatus("Código QA encaminhado. Validação na ferramenta ainda pendente."); }); };

    window.addEventListener("message", receive);

    const timer = window.setTimeout(() => { void qaShutdown.closeAll(); }, Math.max(0, Math.min(QA_GATE.windowEnd - 65000, (session?.expires_at ?? 0) * 1000 - 65000) - Date.now()));

    let finishing: Promise<boolean> | null = null;

    const finish = (): Promise<boolean> => {

      if (finishing) return finishing;

      qaShutdown.terminalize(); active = false; openedSession.current = null;

      controller.abort(); bridge.close(); clearTimeout(timer); clearInterval(closedPoll); try { peer.close(); } catch { /* local closure may be unavailable */ } popup.current = null; window.removeEventListener("message", receive);

      setOpened(false);

      setStatus("Acesso QA encerrado. Não abra outro ciclo nesta sessão.");

      finishing = qaShutdown.track((async () => {

        if (!attempted || !originalSession) return true;

        let verified = false;

        try {

          const result = await qaUserRequest(app, "revoke", {}, originalSession, new AbortController().signal, 10000);

          verified = (result as { revocationVerified?: boolean })?.revocationVerified === true;

        } catch { /* Logout must proceed even if remote revocation is uncertain. */ }

        setStatus(verified ? "Acesso QA encerrado; revogação confirmada. Esta sessão QA é terminal."

          : "Acesso local encerrado; revogação remota não confirmada. Não reabra nem repita automaticamente.");

        return verified;

      })());

      return finishing;

    };

    const closedPoll = window.setInterval(() => { if (peer.closed) void qaShutdown.closeAll(); }, 250);

    const unregister = qaShutdown.register(finish);

    window.addEventListener("pagehide", finish);

    return () => { window.removeEventListener("pagehide", finish); unregister(); void finish(); };

  }, [opened, app, user?.id, session?.access_token, session?.expires_at, accessState, accountStatus, administrativeBlocked, financialBlocked]);

  const available = allowed();

  return <section aria-label="Integração QA V3" className="p-4">

    <p role="status">{status}</p>

    {!opened && <button disabled={!available} onClick={() => { if (allowed()) { let peer: Window | null = null; try { peer = window.open(`${QA_APPS[app].origin}/`, "_blank"); } catch { /* fail closed */ }

      if (!peer || peer.closed) { qaShutdown.terminalize(); void qaShutdown.closeAll(); setStatus("Popup bloqueado. Nenhuma tentativa automática; execução QA encerrada."); return; }

      popup.current = peer; openedSession.current = session!.access_token; setStatus("Aguardando solicitação da ferramenta QA."); setOpened(true); } }}>Abrir ferramenta QA</button>}

    {opened && <button onClick={() => { void qaShutdown.closeAll(); }}>Encerrar acesso QA</button>}

    {opened && available && <p>Ferramenta aberta em janela QA separada. Não navegue nem recarregue esta página.</p>}

  </section>;

}



