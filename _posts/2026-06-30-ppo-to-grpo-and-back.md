---
layout: post
title: PPO to GRPO and back
date: 2026-06-30
description: How I think about PPO and GRPO, why GRPO drops the critic, and why long-horizon tasks pull the field back toward one.
tags: [rl, llm, ppo, grpo]
---

This is a short post on how I think about PPO and GRPO, and where that same intuition is useful even outside of training runs.

PPO barely needs an introduction. It is an actor-critic policy gradient method built from one small piece: a per-token clipped surrogate. Write the probability ratio between the new and old policy as

$$
\rho_t = \frac{\pi_\theta(o_t \mid q, o_{<t})}{\pi_{\theta_{old}}(o_t \mid q, o_{<t})}
$$

and the clipped surrogate for a single token, given an advantage $$A$$, as

$$
\ell(\rho, A) = \min\big(\rho\, A,\; \operatorname{clip}(\rho,\, 1-\varepsilon,\, 1+\varepsilon)\, A\big)
$$

The clip stops an update from moving the policy too far when $$A$$ is large. PPO is just this term averaged over a rollout:

$$
\mathcal{L}_{\text{PPO}}(\theta) = \mathbb{E}_{q,\, o \sim \pi_{\theta_{old}}} \left[ \frac{1}{|o|} \sum_{t=1}^{|o|} \ell(\rho_t,\, \hat{A}_t) \right]
$$

The advantage $$\hat{A}_t$$ comes from Generalized Advantage Estimation on top of a value function learned by a separate critic. The critic gives a per-token signal: GAE turns its value estimates into an advantage at every step $$t$$.

This works, but the critic is not free. It is a second model about the size of the policy, so it roughly doubles the memory and compute. And it has a hard job: predict the expected reward of a half-finished answer at every token, when the reward usually lands only at the very end. Once the task is hard enough that judging a partial attempt is about as hard as finishing it, the value estimates get noisy, and a noisy critic gives you noisy advantages.

The fix, in hindsight, was simple: estimate the advantage from the model you are already training. Sample a group of rollouts for the same prompt, score each one, and normalize the rewards within the group:

$$
\hat{A}_i = \frac{r_i - \operatorname{mean}(\mathbf{r})}{\operatorname{std}(\mathbf{r})}, \qquad \mathbf{r} = \{r_1, \dots, r_G\}
$$

No separate value network and no GAE: the group is its own baseline. This is GRPO, from the [DeepSeekMath paper](https://arxiv.org/abs/2402.03300). It reuses the exact same per-token surrogate $$\ell$$, now averaged over the whole group and with a KL penalty back to a reference policy:

$$
\mathcal{J}_{\text{GRPO}}(\theta) = \mathbb{E}_{q,\, \{o_i\}_{i=1}^{G} \sim \pi_{\theta_{old}}} \left[ \frac{1}{G} \sum_{i=1}^{G} \frac{1}{|o_i|} \sum_{t=1}^{|o_i|} \Big( \ell(\rho_{i,t},\, \hat{A}_{i,t}) - \beta\, \mathbb{D}_{KL}\!\left[\pi_\theta \,\|\, \pi_{ref}\right] \Big) \right]
$$

Here $$\rho_{i,t}$$ is the same ratio, for token $$t$$ of rollout $$i$$, and the KL uses the unbiased estimator

$$
\mathbb{D}_{KL}\!\left[\pi_\theta \,\|\, \pi_{ref}\right] = \frac{\pi_{ref}(o_{i,t} \mid q, o_{i,<t})}{\pi_\theta(o_{i,t} \mid q, o_{i,<t})} - \log \frac{\pi_{ref}(o_{i,t} \mid q, o_{i,<t})}{\pi_\theta(o_{i,t} \mid q, o_{i,<t})} - 1
$$

Two things to notice. PPO and GRPO share the same core $$\ell$$; the difference is only where the advantage comes from. And for outcome supervision the GRPO advantage is shared across the whole rollout, $$\hat{A}_{i,t} = \hat{A}_i$$ for every token $$t$$. That second point matters: GRPO hands the entire trajectory a single number.

So GRPO looked like a clean win, and for a while the takeaway was "use GRPO, drop the critic." But that single-number-per-trajectory is exactly what hurts on long horizons. The [GLM 5.2 blog post](https://z.ai/blog/glm-5.2) makes this concrete. On long-horizon tasks the traces get very long, and once a super-long trajectory is split by compaction into multiple sub-traces, different rollouts of the same prompt yield different numbers of trainable traces with highly variable lengths. That breaks the group-relative comparison GRPO depends on, because there is no longer a clean group of comparable rollouts to normalize against. So they move from group-wise optimization to a critic-based PPO that learns from individual rollouts, using the critic to estimate token-level advantages instead of group-relative ones, plus a token-level loss to handle the length imbalance.

This is also where it connects back to work outside of training. On a long-horizon problem, the move is not to try a bunch of things until one of them happens to succeed. You get more out of looking closely at your own successful and failed attempts (non-i.i.d. as they are) and assigning credit to the specific critical points along the way. Constant tracking and self-critique gives a higher-quality signal than a single pass or fail at the end.

So the choice is really about the task. Short, outcome-verifiable problems with a clean set of comparable rollouts do fine on a group baseline. Long, multi-step tasks, where you need to know which step mattered, are where a critic pays for itself.
