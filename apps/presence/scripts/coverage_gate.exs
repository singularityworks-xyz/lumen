#!/usr/bin/env elixir

# Coverage Gate Script for Presence Service
# Enforces per-path minimum coverage thresholds

Mix.install([
  {:jason, "~> 1.4"}
])

defmodule CoverageGate do
  @moduledoc """
  Enforces per-path coverage minimums from LCOV output.
  """

  # Minimum coverage thresholds per path pattern
  @coverage_thresholds %{
    "lib/presence/token.ex" => 98,
    "lib/presence/tracker.ex" => 95,
    "lib/presence/metrics.ex" => 98,
    "lib/presence/redis_pubsub.ex" => 95,
    "lib/presence/tracer.ex" => 90,
    "lib/presence/telemetry.ex" => 90,
    "lib/presence/telemetry_metrics.ex" => 90,
    "lib/presence_web/controllers" => 95,
    "lib/presence_web/channels" => 90,
    "lib/presence_web/plugs" => 95,
    "default" => 98
  }

  def run(lcov_path) do
    unless File.exists?(lcov_path) do
      IO.puts(:stderr, "ERROR: LCOV file not found at #{lcov_path}")
      System.halt(1)
    end

    coverage_data = parse_lcov(lcov_path)
    results = check_coverage(coverage_data)

    print_results(results)

    if Enum.any?(results, fn {_path, result} -> result.status == :failed end) do
      System.halt(1)
    end
  end

  defp parse_lcov(path) do
    content = File.read!(path)

    content
    |> String.split("\n", trim: true)
    |> Enum.chunk_while(
      %{file: nil, lines: %{}},
      fn
        "SF:" <> file, acc ->
          {:cont, %{acc | file: file}}

        "DA:" <> data, acc ->
          [line_num, hits | _] = String.split(data, ",")
          line = String.to_integer(line_num)
          hit_count = String.to_integer(hits)
          {:cont, %{acc | lines: Map.put(acc.lines, line, hit_count)}}

        "end_of_record", acc ->
          {:cont, acc, %{file: nil, lines: {}}}

        _, acc ->
          {:cont, acc}
      end,
      fn acc -> {:cont, acc} end
    )
    |> Enum.reject(fn data -> data.file == nil end)
    |> Enum.into(%{}, fn data -> {data.file, data.lines} end)
  end

  defp check_coverage(coverage_data) do
    coverage_data
    |> Enum.map(fn {file, lines} ->
      total_lines = map_size(lines)
      covered_lines = Enum.count(lines, fn {_line, hits} -> hits > 0 end)

      coverage =
        if total_lines > 0 do
          Float.round(covered_lines / total_lines * 100, 2)
        else
          100.0
        end

      threshold = get_threshold(file)

      result = %{
        file: file,
        total_lines: total_lines,
        covered_lines: covered_lines,
        coverage: coverage,
        threshold: threshold,
        status: if(coverage >= threshold, do: :passed, else: :failed)
      }

      {file, result}
    end)
  end

  defp get_threshold(file) do
    Enum.find_value(@coverage_thresholds, @coverage_thresholds["default"], fn {pattern, threshold} ->
      if String.contains?(file, pattern), do: threshold, else: nil
    end)
  end

  defp print_results(results) do
    IO.puts("\n" <> String.duplicate("=", 80))
    IO.puts("COVERAGE REPORT")
    IO.puts(String.duplicate("=", 80))

    results
    |> Enum.sort_by(fn {_path, r} -> r.coverage end, :asc)
    |> Enum.each(fn {_path, result} ->
      status_icon = if result.status == :passed, do: "✓", else: "✗"
      status_color = if result.status == :passed, do: "\e[32m", else: "\e[31m"
      reset = "\e[0m"

      IO.puts(
        "#{status_color}#{status_icon}#{reset} #{result.file}: " <>
          "#{result.coverage}% (#{result.covered_lines}/#{result.total_lines} lines) " <>
          "threshold: #{result.threshold}%"
      )
    end)

    IO.puts(String.duplicate("=", 80))

    total_coverage =
      results
      |> Enum.map(fn {_path, r} -> r.coverage end)
      |> Enum.sum()
      |> Kernel./(length(results))
      |> Float.round(2)

    failed_count = Enum.count(results, fn {_path, r} -> r.status == :failed end)

    IO.puts("\nTotal average coverage: #{total_coverage}%")
    IO.puts("Files below threshold: #{failed_count}")

    if failed_count > 0 do
      IO.puts("\n\e[31mCOVERAGE CHECK FAILED\e[0m")
    else
      IO.puts("\n\e[32mCOVERAGE CHECK PASSED\e[0m")
    end
  end
end

lcov_path = System.get_env("LCOV_PATH") || "cover/lcov.info"
CoverageGate.run(lcov_path)
