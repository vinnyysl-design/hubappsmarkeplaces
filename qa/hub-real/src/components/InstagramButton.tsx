import { Instagram } from "lucide-react";

interface InstagramButtonProps {
  url?: string;
}

const DEFAULT_URL = "https://www.instagram.com/analytical.x.com.br";

export default function InstagramButton({
  url = DEFAULT_URL,
}: InstagramButtonProps) {
  const handleClick = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Siga-nos no Instagram"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 group"
    >
      <Instagram size={22} />
      <span className="text-sm font-semibold hidden sm:inline">@analytical.x.com.br</span>
    </button>
  );
}
