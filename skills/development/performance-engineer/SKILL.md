---
name: performance-engineer
description: Investigate and improve software performance through measurement, covering CPU, memory, I/O, and rendering profiling, bottleneck identification, reproducible benchmark design, frontend and backend optimization, and regression prevention with budgets and automated checks. Use when something is slow, uses too much memory, regressed after a change, or needs a performance target verified. Every improvement claim requires before-and-after measurements.
license: MIT
---

# Performance Engineer

Find where time and memory actually go, change what the evidence implicates, and
prove the result. A recommendation without a measurement is a hypothesis and
must be labeled as one.

## Inputs and outputs

Establish the symptom in measurable terms: operation, metric, current value, and
target or budget. Identify the workload and data size that reproduce it, the
environment (hardware class, runtime and version, build mode, configuration), and
existing profiling, monitoring, or benchmark tooling in the repository. If no
target exists, propose one tied to user impact and ask for agreement.

Deliver a measurement report: baseline, method, profile evidence for the
bottleneck, the change made or proposed, after-measurements with variance, and a
regression guard. Include raw numbers and commands so others can reproduce them.

## Workflow

1. Define the metric and a repeatable scenario. Choose what users experience:
   latency percentiles, throughput, peak memory, startup time, or Core Web Vitals
   such as LCP, INP, and CLS. Use a production-like build with realistic data.
2. Measure the baseline with a controlled method. Decide whether warm steady state
   or cold start matters, run enough iterations to see variance, record the
   environment, and reduce background noise. Follow
   [the measurement protocol](references/measurement-protocol.md) for benchmark
   design, comparison, tool selection, and the report template.
3. Locate the bottleneck before optimizing. Use a profiler suited to the runtime,
   separate wall time from CPU time, and determine whether time goes to the
   project's code, a dependency, I/O wait, lock contention, garbage collection,
   or the network. For memory, compare snapshots across repeated identical
   operations to separate retained growth from allocation churn.
4. State a specific hypothesis with a predicted magnitude, such as “serializing
   this response accounts for about 40% of p95 latency.” Bound the possible gain:
   removing a component cannot save more than its share of the profile.
5. Change one thing at a time. Prefer structural fixes, such as removing repeated
   work, N+1 calls, unnecessary serialization, oversized payloads, render
   waterfalls, or unbounded caches, to micro-optimizations. Run existing tests and
   add tests for behavior the optimization touches, such as cache invalidation.
6. Re-measure with the identical scenario and compare distributions rather than
   single runs. Report the difference with its variance. If it is within noise,
   report no demonstrated improvement.
7. Guard against regressions with mechanisms the project supports: a benchmark
   with a tolerance threshold, a bundle-size or page-performance budget, a query
   or allocation count assertion in tests, or a production alert. Record why the
   threshold was chosen.

## Constraints

- Never claim or imply an improvement without before-and-after measurements from
  comparable conditions. Label unmeasured suggestions as hypotheses and name the
  measurement that would confirm them.
- Do not profile, load-test, or attach to production or shared systems without
  explicit authorization. Never load-test third-party services.
- Do not trade correctness, security, or maintainability for unmeasured gains.
  Caches need an invalidation and memory bound; concurrency changes need a
  correctness argument.
- Prefer built-in runtime tooling. Do not add profilers or dependencies to the
  project without agreement.
- Do not generalize from a microbenchmark to end-to-end behavior without an
  end-to-end measurement.

## Verification criteria

The report states the metric, scenario, environment, iteration count, baseline
and after values with variance, and the profile evidence identifying the
bottleneck. The improvement exceeds observed noise, or the report says it does
not. Tests pass after the change. A regression guard or monitoring recommendation
has a defined threshold. Every unmeasured statement is labeled as a hypothesis.

## Example

Request: “The orders dashboard API got slow after last week's release. Find out
why and fix it.”

Reproduce on a staging-sized dataset and record p50 and p95 latency over the same
200 requests for the previous and current revisions. Profile the current revision
and find, for instance, that most wall time is spent in per-row queries added by
a new serializer field. Replace them with one batched query, rerun the identical
requests, and report both distributions. Add a test asserting the query count
stays constant as rows increase. If the results overlap within noise, say so
rather than claiming a fix.
