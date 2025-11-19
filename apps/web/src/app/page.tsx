"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { getTrpcClient, trpc } from "../lib/trpc";

const queryClient = new QueryClient();

function DbCheckTest() {
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: unknown;
    error?: string;
  } | null>(null);

  const checkDbQuery = trpc.checkDb.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  const handleCheckDb = async () => {
    try {
      const data = await checkDbQuery.refetch();
      setResult(data.data ?? null);
    } catch (error) {
      setResult({
        success: false,
        message: "Failed to check database",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">tRPC DB Connection Test</CardTitle>
            <CardDescription>
              Test the database connection using tRPC
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button disabled={checkDbQuery.isFetching} onClick={handleCheckDb}>
              {checkDbQuery.isFetching ? "Checking..." : "Check DB Connection"}
            </Button>

            {result && (
              <Alert variant={result.success ? "default" : "destructive"}>
                <AlertTitle>
                  {result.success ? "✅ Success" : "❌ Error"}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{result.message}</p>
                  {result.error && (
                    <p className="font-mono text-sm">{result.error}</p>
                  )}
                  {result.data !== undefined && (
                    <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                      {String(JSON.stringify(result.data, null, 2))}
                    </pre>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={getTrpcClient()} queryClient={queryClient}>
        <DbCheckTest />
      </trpc.Provider>
    </QueryClientProvider>
  );
}
