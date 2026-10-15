# Measurement protocol

## Benchmark design

- Fix the inputs: the same data, seeds, request mix, and concurrency.
- Record the environment: hardware or instance type, OS, runtime version, build
  mode, power or CPU frequency settings, and container resource limits.
- Decide between cold and warm measurement and document the choice. Warm up JIT
  compilers and caches when steady state matters.
- Run enough iterations that run-to-run spread is smaller than the effect you
  need to detect. Report the iteration count.
- In microbenchmarks, consume results so the compiler or runtime cannot remove
  the measured work.
- Alternate baseline and candidate runs on the same machine to reduce drift
  rather than measuring all baseline runs first.
- Use the benchmark harness the project already has. Common examples include
  pytest-benchmark, Vitest bench, Go `testing.B`, JMH, BenchmarkDotNet, and
  Criterion; do not add one without agreement.

## Comparing results

Report the median, tail percentiles relevant to users, such as p95 or p99, and
spread, such as interquartile range or standard deviation. Show absolute values
next to percentage change. A difference smaller than run-to-run variation is not
an improvement. With enough samples, a nonparametric test such as Mann–Whitney U
helps; otherwise repeat full trials and report each.

Closed-loop load generators wait for each response before sending the next and
under-report latency when the system slows, an effect called coordinated
omission. Use a constant arrival rate for latency-under-load claims.

Lab measurements and field data answer different questions. For web pages,
compare lab results with real-user monitoring when it exists, and state which one
supports a claim.

## Profiling tools

Prefer tools built into the runtime or already used by the project.

| Environment | CPU and time                                      | Memory                                       |
| ----------- | ------------------------------------------------- | -------------------------------------------- |
| Browser     | DevTools Performance panel, Lighthouse            | DevTools heap snapshots, allocation timeline |
| Node.js     | `--cpu-prof`, `--inspect` with DevTools           | `--heap-prof`, heap snapshots                |
| Python      | `cProfile`; sampling profilers such as py-spy     | `tracemalloc`                                |
| JVM         | Java Flight Recorder, async-profiler              | Flight Recorder, heap dumps                  |
| Go          | `pprof` CPU profile                               | `pprof` heap and allocation profiles         |
| .NET        | dotnet-trace, dotnet-counters                     | dotnet-gcdump                                |
| Native      | perf on Linux, platform profilers elsewhere       | heaptrack, Valgrind Massif                   |
| Database    | Query plans, slow query log, statement statistics | Buffer and cache statistics                  |

In browsers, throttle CPU and network to the target device class. For Node.js
services, also watch event-loop delay. Deterministic profilers such as `cProfile`
add overhead that inflates small, frequently called functions.

## Reading profiles

- Self time is spent in a function itself; total time includes callees. Wide
  flame-graph frames show where samples accumulate, not call order.
- CPU profiles hide time spent waiting on I/O or locks; use wall-clock profiles
  or tracing for latency.
- A leak is retained memory that grows across repeated identical operations after
  garbage collection. Churn is a high allocation rate that costs collection time
  without growth.
- The possible speedup is bounded by the fraction of time the changed component
  takes.

## Regression guards

Shared CI runners are noisy. Prefer deterministic proxies where they capture the
risk, such as query counts, allocation counts, bundle bytes, or request counts.
For timing benchmarks, compare against a baseline measured on the same runner in
the same job, and set thresholds above observed noise.

## Report template

```text
Metric and target:
Scenario and data:
Environment:
Method: tool, warm-up, iterations, run order
Baseline: median, tail percentile, spread
Bottleneck evidence:
Change:
After: median, tail percentile, spread
Conclusion: difference beyond noise, and its size
Regression guard:
Not measured or caveats:
```
