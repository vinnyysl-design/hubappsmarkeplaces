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
  const handleClick = () => {
    const encodedMessage = encodeURIComponent(message);
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(
      navigator.userAgent
    );
    const url = isMobile
      ? `whatsapp://send?phone=${phoneNumber}&text=${encodedMessage}`
      : `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Suporte via WhatsApp"
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-[#25D366] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 group"
    >
      <MessageCircle size={22} className="fill-current" />
      <span className="text-sm font-semibold hidden sm:inline">Suporte</span>
    </button>
  );
}
