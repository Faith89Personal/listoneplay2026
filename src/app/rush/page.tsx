import RushListView from "@/components/RushListView";
import LoginGate from "@/components/LoginGate";

export const metadata = {
  title: "Rush mattina · Listone Play 2026",
};

export default function RushPage() {
  return (
    <LoginGate>
      <RushListView />
    </LoginGate>
  );
}
