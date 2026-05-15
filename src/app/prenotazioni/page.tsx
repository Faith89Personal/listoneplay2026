import CalendarView from "@/components/CalendarView";
import LoginGate from "@/components/LoginGate";

export const metadata = {
  title: "Le mie prenotazioni · Listone Play 2026",
};

export default function ReservationsPage() {
  return (
    <LoginGate>
      <CalendarView />
    </LoginGate>
  );
}
