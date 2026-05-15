import PlayedListView from "@/components/PlayedListView";
import LoginGate from "@/components/LoginGate";

export const metadata = {
  title: "Giocati · Listone Play 2026",
};

export default function PlayedPage() {
  return (
    <LoginGate>
      <PlayedListView />
    </LoginGate>
  );
}
