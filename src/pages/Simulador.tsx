import { CalculadoraFinanciamento } from "@/components/financiamento/CalculadoraFinanciamento";
import { Calculator } from "lucide-react";

export default function Simulador() {
  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Simulador de Financiamento</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Calcule parcelas, juros e custo total pelos sistemas SAC e Price.
          </p>
        </div>
      </div>

      <CalculadoraFinanciamento />
    </div>
  );
}
