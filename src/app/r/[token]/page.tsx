import JoinReservationView from "@/components/JoinReservationView";

export const metadata = {
  title: "Unisciti · Listone Play 2026",
};

export default async function JoinReservationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <JoinReservationView token={token} />;
}
