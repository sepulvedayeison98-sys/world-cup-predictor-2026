'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface SimulationResult {
  team_id: string;
  team_name?: string; // Se llenará al unir con la tabla de equipos
  team_code?: string;
  group_stage_advance_prob: number;
  round_of_16_prob: number;
  quarter_final_prob: number;
  semi_final_prob: number;
  final_prob: number;
  winner_prob: number;
}

export function SimulationResultsWidget() {
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchSimulationResults = async () => {
      setLoading(true);
      // Obtener los resultados de la última corrida de simulación
      const { data: latestRun, error: runError } = await supabase
        .from("simulation_results")
        .select("simulation_run_id")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (runError) {
        console.error("Error fetching latest simulation run:", runError);
        setLoading(false);
        return;
      }

      if (!latestRun) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("simulation_results")
        .select(`
          team_id,
          group_stage_advance_prob,
          round_of_16_prob,
          quarter_final_prob,
          semi_final_prob,
          final_prob,
          winner_prob,
          teams(name, code)
        `)
        .eq("simulation_run_id", latestRun.simulation_run_id)
        .order("winner_prob", { ascending: false });

      if (error) {
        console.error("Error fetching simulation results:", error);
      } else {
        setResults(data.map((r: any) => ({
          ...r,
          team_name: r.teams.name,
          team_code: r.teams.code,
        })));
      }
      setLoading(false);
    };

    fetchSimulationResults();

    // Opcional: Suscribirse a cambios en simulation_results para actualizar en tiempo real
    const channel = supabase
      .channel("simulation_results_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "simulation_results" },
        (payload) => {
          console.log("New simulation results available:", payload);
          fetchSimulationResults(); // Re-fetch all results when new simulation is inserted
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Probabilidades del Torneo</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Cargando resultados de simulación...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Probabilidades del Torneo (Simulación Monte Carlo)</CardTitle>
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <p>No hay resultados de simulación disponibles.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipo</TableHead>
                <TableHead>Avanzar Fase Grupos</TableHead>
                <TableHead>Octavos</TableHead>
                <TableHead>Cuartos</TableHead>
                <TableHead>Semis</TableHead>
                <TableHead>Final</TableHead>
                <TableHead>Campeón</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.team_id}>
                  <TableCell className="font-medium">{result.team_name} ({result.team_code})</TableCell>
                  <TableCell>{(result.group_stage_advance_prob * 100).toFixed(1)}%</TableCell>
                  <TableCell>{(result.round_of_16_prob * 100).toFixed(1)}%</TableCell>
                  <TableCell>{(result.quarter_final_prob * 100).toFixed(1)}%</TableCell>
                  <TableCell>{(result.semi_final_prob * 100).toFixed(1)}%</TableCell>
                  <TableCell>{(result.final_prob * 100).toFixed(1)}%</TableCell>
                  <TableCell className="font-bold">{(result.winner_prob * 100).toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
