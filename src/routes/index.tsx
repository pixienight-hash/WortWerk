import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import WortwerkApp from "@/components/WortwerkApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wortwerk — Γερμανικό λεξιλόγιο" },
      { name: "description", content: "Μάθε γερμανικές λέξεις και γραμματική με επανάληψη σε διαστήματα." },
      { property: "og:title", content: "Wortwerk — Γερμανικό λεξιλόγιο" },
      { property: "og:description", content: "Μάθε γερμανικές λέξεις και γραμματική με επανάληψη σε διαστήματα." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClientOnly fallback={null}><WortwerkApp /></ClientOnly>,
});
