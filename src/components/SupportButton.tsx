import { MessageCircle } from "lucide-react";

interface SupportButtonProps {
  phoneNumber: string; // formato internacional sem +, ex: 5511999999999
  message?: string;
}

const DEFAULT_MESSAGE =
  "Olá! Sou cliente do Analytical X e preciso de suporte. Pode me ajudar?";

export default function SupportButton({
  phoneNumber,
  message = DEFAULT_MESSAGE,
}: SupportButtonProps) {
  const encodedMessage = encodeURIComponent(message);
  // wa.me é a rota oficial e leve do WhatsApp. Como link <a target="_blank">,
  // o navegador abre uma aba top-level (fora do sandbox do preview),
  // evitando o ERR_BLOCKED_BY_RESPONSE do web.whatsapp.com.
  const href = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Suporte via WhatsApp"
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-[#25D366] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 group no-underline"
    >
      <MessageCircle size={22} className="fill-current" />
      <span className="text-sm font-semibold hidden sm:inline">Suporte</span>
    </a>
  );
}
