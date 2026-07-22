import { Star } from "lucide-react";

export const openReviewDialog = () => {
  window.dispatchEvent(new CustomEvent("open-review-dialog"));
};

export default function ReviewButton() {
  return (
    <button
      type="button"
      onClick={openReviewDialog}
      aria-label="Nos avalie"
      className="fixed bottom-6 left-[168px] sm:left-[176px] z-50 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-yellow-400 text-yellow-950 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
    >
      <Star size={20} className="fill-current" />
      <span className="text-sm font-semibold hidden sm:inline">Nos avalie</span>
    </button>
  );
}
