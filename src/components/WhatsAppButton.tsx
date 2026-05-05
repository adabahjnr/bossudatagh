import { MessageCircle } from "lucide-react";
import { useStore } from "@/lib/store";

export function WhatsAppButton() {
  const { state } = useStore();
  const { whatsappNumber, whatsappChannelLink } = state.settings;
  const href = whatsappChannelLink || `https://wa.me/${whatsappNumber}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-success text-success-foreground shadow-elegant transition-smooth hover:scale-110"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}