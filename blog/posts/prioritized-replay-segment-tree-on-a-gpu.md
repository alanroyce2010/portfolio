---
title: Putting prioritized replay's segment tree on a GPU
description: The sum tree inside Ape-X's replay buffer, ported to C and OpenACC: why the GPU-friendly batch update does asymptotically more work on purpose, the race condition that produced silently wrong probabilities, and honest crossover measurements.
date: 2026
category: Reinforcement Learning / HPC
citekey: gabriel2026sumtree
---

## The Tree Under Every Prioritized Replay

Prioritized experience replay (Schaul et al., 2016) samples transition
$i$ with probability proportional to a priority: $P(i) = p_i^{\alpha} / \sum_j p_j^{\alpha}$.
Three operations have to be fast for that to work at scale: update the
priorities of a just-trained batch, draw a batch of indices proportional
to priority, and read the global minimum priority (the importance-weight
normalization needs it). The standard structure for all three is a **sum
tree**: an implicit binary tree in a flat array of length $2n$, leaves
holding the priorities, every internal node holding the sum of its
children, the root holding the total. A point update touches one
leaf-to-root path, $O(\log n)$; the total is a single array read; and
sampling is a walk down the tree. A twin tree with min in place of sum
serves the third operation.

In [my Ape-X port](projects/apex-mpi/index.html), one MPI rank owns the
replay buffer and nothing else, and this tree is nearly all of what that
rank does: priority updates for every learner batch, plus intake batches
from every actor, plus 512 sampling descents per learner step, against a
buffer of $n = 2^{21}$ transitions. It is the hot path, it was pure
Python, and this post is the story of moving it to C and then, with
OpenACC, onto a GPU, including the parts where that was less
straightforwardly a win than the project write-up's headline number
suggests.

## Sampling Is a Descent

The elegant bit of the sum tree is proportional sampling without ever
materializing the distribution. Draw a uniform "mass" in $[0, \text{total})$
and walk down from the root: if the left child's sum exceeds the
remaining mass, go left; otherwise subtract the left sum and go right.
The leaf you land on is a sample drawn exactly proportional to priority.

![Two-panel diagram: left, a descent through a sum tree locating a leaf for a sampled mass; right, the batch update pattern with parallel leaf writes and level-by-level rebuild.](images/apex-tree/sum_tree.png "Left: one sampling descent. Right: the shape of the batched update, the whole point of the GPU port.")

In C the descent is a dozen lines, and this exact function is the one
the replay rank runs 512 times per learner step:

```c
int st_find_prefixsum_idx(const Tree *t, double prefixsum) {
    int idx = 1;
    while (idx < t->cap) {
        if (t->data[2*idx] > prefixsum)
            idx = 2 * idx;
        else {
            prefixsum -= t->data[2*idx];
            idx = 2 * idx + 1;
        }
    }
    return idx - t->cap;
}
```

## First Port: Pay the Interpreter Once

The first speedup has nothing to do with GPUs. The reference code calls
`find_prefixsum_idx` in a Python loop, 512 times, and each call walks 21
levels of interpreted code. The C library exposes *batched* primitives
instead: one `ctypes` call takes the whole array of masses (or indices,
or priorities) as a zero-copy NumPy pointer and loops in C. Measured on
the CPU build, batch of 512 descents against the $2^{21}$-leaf tree:

```
pure Python loop        : 430.7 us per batch
C descent, ctypes loop  : 131.0 us per batch   (3.3x)
C descent, one batch call: 19.1 us per batch   (22.5x)
```

The middle row is worth staring at: even with the descent already in C,
calling it 512 times through `ctypes` costs 6.8 times more than calling
it once with the batch. Most of that gap is pure foreign-function call
overhead. Batching is not a GPU trick; it is an interpreter trick that
happens to also be exactly what a GPU needs.

## Second Port: Make the Update GPU-Shaped

Updates are where the algorithm itself has to change. The natural batch
update, run the leaf-to-root propagation once per element, is hostile to
a GPU in two ways: the $k$ paths are scattered, divergent walks, and
they *collide*. Every path ends at the root, and near the top of the
tree all $k$ updates write the same few nodes, which means atomics or
serialization. So the C version does something different, and it is the
pattern in the right panel of the figure: write all $k$ leaves at once
(fully independent), then rebuild the internal nodes bottom-up, one
level at a time, where every node within a level is independent:

```c
/* Step 1: write leaves - all independent, fully parallel. */
#pragma acc parallel loop present_or_copyin(idxes[0:n], vals[0:n]) \
                           present_or_copy(t->data[0:2*t->cap])
for (int i = 0; i < n; i++)
    t->data[idxes[i] + t->cap] = vals[i];

/* Step 2: bottom-up rebuild, one level at a time. */
for (int level = t->cap / 2; level >= 1; level /= 2) {
    #pragma acc parallel loop present_or_copy(t->data[0:2*t->cap])
    for (int i = level; i < 2 * level; i++)
        t->data[i] = t->data[2*i] + t->data[2*i+1];
}
```

Note what was traded. Per-element propagation does $O(k \log n)$ work;
the rebuild does $O(k + n)$, touching every internal node whether or not
anything beneath it changed. The batch path deliberately does *more*
arithmetic to get work that is conflict-free, coalesced, and
level-parallel. The same source file compiles two ways: `gcc` ignores
the pragmas and produces a plain CPU library; `nvc -acc` offloads both
phases to the GPU. One algorithm, one file, two machines.

## The Race Condition Worth Writing Down

The first version of that rebuild had the `parallel loop` pragma on the
*outer* loop, over levels. OpenACC obligingly ran all the levels
concurrently, which means a parent could sum its children before the
level below had finished writing them. The result was not a crash. It
was a tree whose internal sums were slightly wrong, which means a
sampling distribution that was slightly wrong, which in an RL system
means nothing visibly fails and your agent just learns a little worse
from subtly mis-prioritized data. The dependency structure of a tree
reduction is *between* levels, never within one; the fix is exactly the
code above, sequential outer loop, parallel inner loop, and it is the
oldest lesson in parallel prefix computation (Blelloch's scan literature
says it formally: level-synchronous, log-depth).

What caught it was not a sanitizer but the boring test harness: every
operation compared against the pure-Python reference to machine
precision, on every build. For numerical-systems code where wrongness is
silent, a bit-for-bit oracle is worth more than any amount of code
review.

## Measuring the Trade Honestly

The project write-up reports the headline result on the cluster build:
roughly two orders of magnitude over the original interpreted tree on
batched updates and sampling, and the MPI system it serves wins actor
intake throughput at every scale tested (1.39x to 2.31x over the ZMQ
baseline). Preparing this post, I re-benchmarked the CPU build on my
laptop (Apple silicon, clang, no GPU), sweeping the update batch size
$k$ against all three strategies. The result is more interesting than
the headline:

![Log-log plot of update time per batch versus batch size for pure Python, C per-element, and C batch-rebuild strategies, showing the flat rebuild line crossing both rising lines.](images/apex-tree/update_crossover.png "The rebuild costs a flat ~500 microseconds at any batch size; the per-element strategies scale with k log n. Crossovers near k = 512 and k = 2048.")

```
     k   pure Python   C per-element   C batch rebuild
     8        7.2 us         1.9 us         516.3 us
    50       49.2 us        11.6 us         477.7 us
   512      554.9 us       120.7 us         487.6 us
  2048     2279.3 us       489.4 us         500.2 us
 32768    52270.1 us      8819.7 us         568.0 us
```

The rebuild line is flat, as $O(k + n)$ with $n \gg k$ says it must be,
and on a serial CPU it does not pay until $k$ approaches 2000. At the
replay buffer's actual batch sizes, 50-transition intake batches and
512-priority learner updates, a plain C per-element loop beats the
GPU-shaped algorithm by 41x and 4x respectively. On the CPU, the honest
recommendation is a hybrid dispatch: per-element below the measured
crossover, rebuild above it. The rebuild earns its keep on the machine
it was shaped for, where the 500 microseconds of level sweeps spread
across thousands of GPU lanes and the per-element path's conflicts and
divergence have no good answer at all.

I like this result more than a clean victory. It is the whole
CPU-versus-GPU tension in one flat gold line: the accelerator-friendly
algorithm is often the *worse* serial algorithm, chosen anyway because
it parallelizes, and the only way to know where the trade lands on a
given machine is to measure it there. The pragmas-ignored-by-gcc design
keeps both options open from a single source file, which in hindsight is
the most defensible engineering decision in the whole component.

## Where This Lives

The lineage, for anyone building the same thing: prioritized experience
replay and the sum tree usage are Schaul et al. (2016); the distributed
architecture this buffer serves is Ape-X, Horgan et al. (2018); the
pure-Python tree this port started from descends from the OpenAI
Baselines implementation that half the RL ecosystem inherited. The
level-synchronous parallel reduction pattern is classical, formalized in
Blelloch's work on scans. The full system context, the MPI transport
that replaced a ZeroMQ stack and the wall-clock results, lives on the
[project page](projects/apex-mpi/index.html), and the write-up with
scaling figures is in the repo's report. The benchmarks in this post
were run for the post, on the CPU build, and the numbers above are the
unedited output.

::: callout
A prioritized replay buffer is a sum tree with three verbs: update,
sample, min. Batching them into single C calls pays for itself
immediately, mostly by dodging interpreter and FFI overhead. Putting
the update on a GPU requires changing the algorithm itself, from
$O(k \log n)$ scattered propagation to an $O(k + n)$ level-synchronous
rebuild that deliberately does more work to make every write
conflict-free. That trade is machine-dependent in a way a single
headline number hides: measured on a serial CPU it loses below batch
sizes of about 2000, and the race condition on the way there produced
silently wrong sampling probabilities that only a machine-precision
oracle test caught. Parallelize within tree levels, never across them,
and benchmark on the machine you will actually run on.
:::
