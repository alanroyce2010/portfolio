---
title: Q Bellman equation for a min-max adversarial game
description: What breaks in the ordinary Q-learning fixed point when an adversary picks half of every transition, and why the fix turns the greedy max into a small linear program over mixed strategies.
date: 2026
category: Reinforcement Learning / Game Theory
citekey: gabriel2026minimaxq
---

## The Assumption Hiding in the Single-Agent Equation

The Bellman optimality equation for the action-value function is usually the
first equation anyone learns in reinforcement learning:

$$
Q^*(s, a) = \mathbb{E}_{s'} \left[ r(s, a) + \gamma \max_{a'} Q^*(s', a') \right]
$$

It reads innocently, but the $\max$ is carrying a strong worldview: *every
decision after this one belongs to me.* The environment is stochastic but
indifferent. It rolls its dice from a fixed distribution and doesn't care
whether I win. That assumption is baked into everything downstream of this
equation: the learner bootstraps toward a future in which it gets to pick
the best action forever.

The moment there is a second agent whose goals oppose mine, that worldview
is wrong, and the equation has to change. This post derives what it changes
into: the minimax Q Bellman equation for two-player zero-sum Markov games.
The punchline is that exactly one symbol needs to be replaced, but replacing
it correctly requires a small detour through game theory. To be clear about
provenance up front: none of the mathematics here is new (the fixed point
is from 1953, the algorithm from 1994, and a map of who did what is at the
end of the post). The point is the derivation itself, and a worked example
built to expose a subtlety the equations keep quiet about.

## Letting the Environment Fight Back

The formal object is a **zero-sum Markov game**, which predates most of
modern RL: Shapley wrote it down in 1953. There are two players. In state
$s$, I pick an action $a$ from my set $A$, the opponent simultaneously picks
$o$ from their set $O$, and the world responds to the *pair*:

- I receive reward $r(s, a, o)$; the opponent receives $-r(s, a, o)$. One scalar reward, opposite signs: that's the zero-sum part.
- The next state is drawn from $P(s' \mid s, a, o)$.

The first structural consequence is that $Q$ needs a bigger signature. A
value $Q(s, a)$ no longer means anything, because the outcome of my action
depends on what the opponent did in the same instant. The natural object is
$Q(s, a, o)$: the value of the joint action under optimal play afterward.

The second consequence is the interesting one. To turn $Q$ values into a
state value $V(s)$, the single-agent recipe says: take the max. What is the
adversarial analogue? Two candidates immediately suggest themselves, and
both are wrong in instructive ways:

1. $\max_a \max_o Q(s, a, o)$ assumes the opponent will kindly pick whatever is best *for me*. This is not an adversary model, it's a fantasy, and a policy trained against it collapses on contact with a real opponent.
2. $\max_a \min_o Q(s, a, o)$ has the right instinct: commit to an action, assume the opponent responds as badly for me as possible, pick the action whose worst case is least bad. This is genuinely close, and for some games it even works. But it optimizes over *deterministic* choices only, and that's a real loss.

## Why a Plain Max-Min Isn't Enough

Rock-paper-scissors makes the failure concrete. Treat it as a Markov game
with a single state and the payoff matrix (rows are my action, columns the
opponent's):

$$
\begin{pmatrix} 0 & -1 & 1 \\ 1 & 0 & -1 \\ -1 & 1 & 0 \end{pmatrix}
$$

Evaluate both deterministic operators. If I must commit to one pure action
and the opponent sees it coming, every row has a $-1$ in it, so
$\max_a \min_o = -1$. Flip the order and every column has a $+1$, so
$\min_o \max_a = +1$. The two operators disagree, and neither equals the
true value of the game, which is obviously $0$: play uniformly at random
and no opponent can beat you in expectation.

The resolution is that the thing being optimized has to be a **mixed
strategy**: a probability distribution $\pi$ over my actions, not a single
action. Von Neumann's minimax theorem (1928) says that for matrix games,
once both sides are allowed to randomize, the order of max and min stops
mattering and the shared optimum is a well-defined number, the *value* of
the matrix. That number is what the Bellman backup should propagate.

One simplification comes for free: with my mixture $\pi$ fixed, my expected
payoff is linear in the opponent's mixture, and a linear function on a
probability simplex is minimized at a vertex. So the inner minimization can
run over the opponent's *pure* actions with no loss of generality. Only my
side of the optimization actually needs the distribution.

## The Minimax Q Bellman Equation

Everything is now in place. Define the state value as the minimax value of
the stage game whose payoff matrix is $Q^*(s, \cdot, \cdot)$:

$$
V^*(s) = \max_{\pi \in \Delta(A)} \min_{o \in O} \sum_{a} \pi(a) \, Q^*(s, a, o)
$$

and close the loop with the Q equation, which looks almost untouched:

$$
Q^*(s, a, o) = r(s, a, o) + \gamma \sum_{s'} P(s' \mid s, a, o) \, V^*(s')
$$

Compare this to the single-agent pair and the diff is exactly one operator:
$\max_{a'}$ became $\max_{\pi} \min_{o}$. In the single-agent case the
greedy step is an argmax, a table lookup. Here the greedy step is a small
linear program: choose $\pi$ and a scalar $v$ to maximize $v$ subject to
$\sum_a \pi(a) \, Q(s, a, o) \ge v$ for every opponent action $o$, with
$\pi$ a probability distribution. One constraint per opponent action, one
variable per action of mine. For game-sized action sets this LP is tiny.

## A Worked Example: Penalty Kicks

Equations earn their keep when you can watch them produce a number, so
here is the smallest example I know that exercises every piece of the
machinery: the penalty kick. The kicker chooses a side to shoot, the
goalie simultaneously chooses a side to dive, and the entries are the
kicker's probability of scoring (rows: kick left or right, columns: dive
left or right):

$$
\begin{pmatrix} 0 & 1 \\ 1 & 0.5 \end{pmatrix}
$$

The asymmetry is the story: this kicker is right-footed. A shot to the
wrong-footed side always scores, a left shot into a correct dive is always
saved, but a right shot beats even a correct dive half the time.

### The stage game by hand

First the deterministic operators, to see the gap. Committing to a pure
kick and letting the goalie respond gives $\max_a \min_o = 0.5$: kick
right, since its worst case saves half. Flipping the order gives
$\min_o \max_a = 1$. The value lives strictly between.

Now the LP, which for a 2x2 game collapses to one line of algebra. Kick
left with probability $p$. Against a left dive the scoring probability is
$1 - p$; against a right dive it is $p + 0.5(1 - p) = 0.5 + 0.5p$. At the
optimum both of the goalie's options must be equally good for them
(otherwise the goalie deviates to the better one and my guarantee drops),
so set them equal: $1 - p = 0.5 + 0.5p$ gives $p = 1/3$ and a value of
$2/3$. Randomizing lifted the kicker's guarantee from $0.5$ to $2/3$, and
the equalization step is exactly the LP's tight constraints, solved by
hand.

### Making it a Markov game

Now add state, so the full Bellman recursion has something to do. Say a
kicker who gets guessed is shaken by the near miss: in state *fresh* the
matrix is the one above, but whenever the goalie picks the same side
(scored or not), the next round is taken *rattled*, with every scoring
probability scaled by $0.7$. Wrong-footing the goalie restores *fresh*.
With $\gamma = 0.9$, the Q backup at each state $s$ is

$$
Q_s(a, o) = q_s(a, o) + \gamma \begin{cases} V(\mathrm{rattled}) & \text{if } a = o \\ V(\mathrm{fresh}) & \text{otherwise} \end{cases}
$$

where $q_s$ is that state's goal-probability matrix. Both the reward and
the transition now depend on the *joint* action, which is what makes the
two states genuinely coupled. Value iteration with the minimax backup is
a few lines of Python (the 2x2 value has a closed form, so no LP solver
is even needed):

```python
def val_2x2(M):
    """Minimax value and row-player mixture of a 2x2 zero-sum game."""
    (a, b), (c, d) = M
    maximin = max(min(a, b), min(c, d))          # pure saddle point?
    minimax = min(max(a, c), max(b, d))
    if maximin == minimax:
        return maximin, 1.0 if min(a, b) >= min(c, d) else 0.0
    denom = a - b - c + d
    return (a * d - b * c) / denom, (d - c) / denom

q = {"fresh":   [[0.0, 1.0], [1.0, 0.5]],
     "rattled": [[0.0, 0.7], [0.7, 0.35]]}
gamma = 0.9

V = {"fresh": 0.0, "rattled": 0.0}
for _ in range(1000):
    newV = {}
    for s in V:
        Q = [[q[s][a][o] + gamma * (V["rattled"] if a == o else V["fresh"])
              for o in (0, 1)] for a in (0, 1)]
        newV[s], _ = val_2x2(Q)
    if max(abs(newV[s] - V[s]) for s in V) < 1e-12:
        break
    V = newV
```

Reading out the converged values and the optimal mixtures at each state:

```
fresh    V = 5.6890   kick left with p = 0.3655   (myopic p = 0.3333)
rattled  V = 5.4896   kick left with p = 0.3758   (myopic p = 0.3333)
```

### What the numbers say

The values are unsurprising: being rattled costs about $0.2$ in
discounted return, and both sit below the $2/3 / (1 - \gamma) \approx 6.67$
a permanently fresh kicker would collect, because optimal play still gets
guessed sometimes.

The mixtures are the interesting part. Solved in isolation, *both* stage
games say kick left with probability $1/3$ (the rattled matrix is just a
scaled copy, and scaling doesn't move the equalizer). The Markov game
says $0.3655$ fresh and $0.3758$ rattled. The shift has a clean reading:
being guessed now costs an extra $\gamma \, (V_{\mathrm{fresh}} - V_{\mathrm{rattled}}) \approx 0.18$
*on top of* whatever happens to the ball, and that penalty is symmetric
across sides. The future has added a small matching-pennies game onto the
asymmetric stage game, and matching pennies wants uniform play, so both
mixtures get pulled toward $1/2$. The rattled kicker randomizes closer to
uniform than the fresh one because the same future stake looms larger
against scoring probabilities that have been scaled down.

This is the practical content of the fixed point: you cannot solve the
stage games separately and stitch the answers together. The Q function
couples them, and the coupling changes not just the values but the
strategies.

### When the future can move your mixture, and when it can't

That raises a sharper question: does *any* coupling between the states
drag the mixtures away from myopic play, or does it take a particular
kind? Running the same solver under three different transition rules for
when the kicker becomes rattled gives a surprisingly clean answer. Rule
one is the original: rattled whenever the goalie *guessed* the side, a
condition on the joint action. Rule two: rattled whenever the kicker
*kicked left* (say the left foot tires), a condition on the kicker's own
action only. Rule three: rattled whenever the shot *failed to score*, a
condition on the outcome, whose probability is the reward itself. Both
players' optimal mixtures, against their myopic values:

```
rule          state     kicker p(L)          goalie s(L)
guessed       fresh     0.3655 (vs 0.3333)   0.3655 (vs 0.3333)
guessed       rattled   0.3758 (vs 0.3333)   0.3758 (vs 0.3333)
own-action    fresh     0.3333 (exact)       0.2133 (vs 0.3333)
own-action    rattled   0.3333 (exact)       0.1619 (vs 0.3333)
outcome       fresh     0.3333 (exact)       0.3333 (exact)
outcome       rattled   0.3333 (exact)       0.3333 (exact)
```

Under the outcome rule nothing moves: the continuation value there is
$\gamma \, (q \, V_{\mathrm{fresh}} + (1 - q) \, V_{\mathrm{rattled}})$,
affine in the goal probability $q$, so each state's Q matrix is just a
positive affine rescaling of its stage matrix and the game-theoretic
content is untouched. Only the values change.

The own-action rule is the striking one. Kicking left now carries a real
future cost, and the kicker's optimal mixture does not move by a
micron: it stays at exactly $1/3$. The goalie's mixture is what moves,
and substantially, diving left far less often. This is the classical
indifference principle of mixed equilibria wearing Markov-game clothes:
in a completely mixed equilibrium *your* randomization is pinned down by
the requirement that your *opponent* be indifferent, so a continuation
term that varies only with your own action shifts the opponent's
equalization problem, not yours. The goalie must keep the kicker
indifferent between the two sides, and since kicking left now costs the
kicker future value on its own, the goalie compensates by making the left
side more inviting on the ball.

Put together: the future can only bend your mixture through terms that
vary with the *opponent's* action. Transitions driven by your own choices
or by the rewarded outcome, however dramatic their effect on the value,
leave your strategy exactly myopic. In the penalty game only "being
guessed", a genuinely joint condition, moves both players.

## Does It Still Converge?

A Bellman equation is only useful if it pins down a unique $Q^*$ and if
iterating toward it actually gets there. The single-agent proof rests on
the Bellman operator being a $\gamma$-contraction in the sup norm, and the
key lemma there is that $\max$ is nonexpansive: changing a table's entries
by at most $\epsilon$ changes its max by at most $\epsilon$.

The minimax value has the same property. Write
$\mathrm{val}(M)$ for the minimax value of a matrix $M$; then perturbing
every entry of $M$ by at most $\epsilon$ perturbs $\mathrm{val}(M)$ by at
most $\epsilon$, because whatever mixture was optimal before is still
available after and its expected payoff moved by at most $\epsilon$.
Define the operator

$$
(TQ)(s, a, o) = r(s, a, o) + \gamma \sum_{s'} P(s' \mid s, a, o) \, \mathrm{val}\big(Q(s', \cdot, \cdot)\big)
$$

and the nonexpansiveness of $\mathrm{val}$ gives, entry by entry,

$$
\lVert TQ_1 - TQ_2 \rVert_{\infty} \le \gamma \, \lVert Q_1 - Q_2 \rVert_{\infty}
$$

so for $\gamma \lt 1$, Banach's fixed-point theorem hands us existence,
uniqueness, and convergence of value iteration in one stroke. This is
Shapley's 1953 result, proved before the phrase "reinforcement learning"
existed.

## From Fixed Point to Algorithm

Turning the equation into a learning rule is the same move Watkins made
for MDPs, and Littman made it for Markov games in 1994 with **minimax-Q**:
sample a transition $(s, a, o, r, s')$ and nudge the table toward the
one-sample backup, with the LP standing where the max used to be:

$$
Q(s, a, o) \leftarrow (1 - \alpha) \, Q(s, a, o) + \alpha \left[ r + \gamma \, \mathrm{val}\big(Q(s', \cdot, \cdot)\big) \right]
$$

The per-update LP sounds expensive but rarely is at tabular scale, and the
structure survives into settings people care about now. Robust RL is this
equation with the opponent renamed "nature": model uncertainty becomes an
adversary choosing worst-case transitions, and the robust Bellman operator
is a minimax backup. Robust adversarial RL (RARL) trains a protagonist
policy against a learned antagonist applying disturbance forces, which is
stochastic-approximation minimax-Q wearing deep-network clothes. Self-play
systems propagate the same minimax value target through their search trees.

One last qualitative point worth internalizing: in an MDP there is always
an optimal *deterministic* policy, which is why argmax-greedy behavior is
enough. In an adversarial game there generally isn't. The optimal policy
at rock-paper-scissors *is* the randomization. Stochasticity stops being
an exploration crutch you anneal away and becomes part of the answer.

## Where This Lives in the Literature

Everything derived above is classical, and it is worth knowing whose
shoulders it stands on and where the active edges are.

- **Shapley (1953), "Stochastic Games", PNAS.** The founding paper: zero-sum Markov games, the minimax value recursion, and the contraction argument, two decades before Q-learning existed. The convergence section above is Shapley's proof.
- **von Neumann (1928).** The minimax theorem that makes the stage-game value well defined once mixed strategies are allowed.
- **Littman (1994), "Markov games as a framework for multi-agent reinforcement learning", ICML.** Introduces minimax-Q, the sampled update above, with grid-soccer experiments. **Littman and Szepesvári (1996)** then unified the convergence theory: Q-learning converges for *any* nonexpansive backup operator, the minimax value included, which is the formal version of this post's "one substitution survives everything" claim.
- **Filar and Vrieze, *Competitive Markov Decision Processes* (1997).** The standard book-length treatment.
- **The general-sum caution.** Attempts to extend the recipe beyond zero-sum, notably Hu and Wellman's Nash-Q (JMLR 2003), largely lose their guarantees; Zinkevich et al. (2006) showed value-iteration-style methods cannot in general find equilibria of general-sum Markov games. The zero-sum structure is what makes this post's equation clean.
- **Robust MDPs: Iyengar (2005) and Nilim and El Ghaoui (2005).** The same minimax backup with the opponent renamed "nature" choosing worst-case transition models; the robust Bellman operator's theory is this post's theory.
- **Pinto et al. (2017), "Robust Adversarial Reinforcement Learning", ICML** ([arXiv:1703.02702](https://arxiv.org/abs/1703.02702)). The deep-RL incarnation: a protagonist trained against a learned destabilizing adversary.
- **The modern theory wave.** Sample-complexity and self-play guarantees for exactly this fixed point are an active field: Bai and Jin's provably efficient self-play (ICML 2020, [arXiv:2002.04017](https://arxiv.org/abs/2002.04017)) and the decentralized V-learning of Jin, Liu, Wang, and Yu ([arXiv:2110.14555](https://arxiv.org/abs/2110.14555), Mathematics of Operations Research 2024), among much else.

The worked example's rigidity result, that only opponent-dependent
continuation terms can move your mixture, is not a new theorem either:
it is the textbook indifference principle of mixed equilibria, applied
to the Q matrices the fixed point produces. The example was built for
this post; the principle it illustrates is as old as game theory.

::: callout
The whole derivation is one substitution. The $\max$ in the Bellman
backup, which encodes "the future is mine to choose", becomes the minimax
value of a stage matrix game, which encodes "the future is a negotiation
with someone who wants me to lose". The contraction argument, the unique
fixed point, and the Q-learning recipe all survive the substitution. The
price is that the greedy step becomes a linear program and the optimal
policy must randomize.
:::
