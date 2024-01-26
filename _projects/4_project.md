---
layout: page
title: FBSDE
description: Portfolio Optimization using Deep Learning with propagator transaction cost model
importance: 4
category: Finance
---

In this project, we optimally replicate an option portfolio in the presence of transaction costs using a deep learning framework. We use a propagator transaction cost model to account for transaction costs. Finally, we compare the performance of the replicating portfolio with the performance of the option portfolio.

We model this as a stochastic control problem, and we aim to minimize or maximize the functional
\begin{equation}
\tilde{J}(c)=E\left(\int_0^T \tilde{\mathrm{rc}}\left(s, \tilde{X}_s, c_s\right) d s+\tilde{\mathrm{fc}}\left(\tilde{X}_T\right)\right)
\end{equation}

with respect to the control function $$c_t$$, where the underlying stochastic evolving factors $$\tilde{X}_t$$ satisfy
\begin{equation}
d \tilde{X}_t=\tilde{\mu}\left(t, \tilde{X}_t ; c_t\right) d t+\tilde{\sigma}\left(t, \tilde{X}_t ; c_t\right) d W_t,
\end{equation}

where $$X_t = [S_t, Y_t]$$ which follows the following processes, 

\begin{equation}
d S_t=\mu\left(t, S_t\right) d t+\sigma\left(t, S_t\right) d W_t
\end{equation}
\begin{equation}
d Y_t=-f\left(t, S_t, Y_t, Q_t\right) d t+ Q_t^T \sigma\left(t, S_t\right) d W_t
\end{equation}

We model running costs $$\tilde{rc}$$ using a propogator model, and final cost is given by 
\begin{equation}
\tilde{fc} = \|\|{Y_T - g(S_T)}\|\|^2
\end{equation}

Finally, we model transaction costs using (1) linear permanent impact and quadratic temporary impact, and (2) markov impact process as follows:
\begin{equation}
    I_{t + 1}^Q = e^{-\lambda} I_{t}^Q + \gamma v_{t}
\end{equation}

\begin{equation}
    v_{t} = Q_{t + 1} - Q_{t}
\end{equation}

Using this, we obtain new underlier processes for $$S_t$$ and $$Y_t$$ (not shown here). Finally, we optimize the total PnL using a risk averse optimization using a simple neural network and gradient descent on the following objective function:

\begin{equation}
\mathcal{L}(w_T) = \frac{\kappa}{2} V\left[w_T\right]-E\left[w_T\right] \\
\end{equation}

where $$w_T = w_0 + \sum_{t=1}^T \delta w_t,$$ and $$\delta w_t= \delta\left(P_t-Y_t\right)$$



- $$S_t$$ denotes the prices of the underlying assets at time t
- $$Y_t$$ denotes the value of the options replication portfolio at time t
- $$\tilde{X}_t$$ is the concatenation of $$S_t$$ and $$Y_t$$
- $$Q_t$$ is the value of holdings in the underlying stocks at time t
- $$\tilde{rc}$$ and $$\tilde{fc}$$ denote the running cost and final cost respectively
- $$Q_t$$ is the value of holdings in the underlying assets at time t, with unit in dollars
- $$h_t$$ denotes the value of holdings in the underlying assets at time t, with unit in number of shares
- $$\delta t$$ denotes the length of rebalancing interval in discrete time
- $$\tau$$ denotes the length of the time interval for each rebalancing (trade)
- $$v_t$$ denotes (1) the average rate of trading at time t in shares for the linear and KO model (2) the turnover in dollar in propagator model 
- $$g$$ denotes the payoff function 
- $$X_t$$ denotes the value of the cash account at time t, with unit in dollars
- $$I_{t}^Q$$ is the impact process for the propagator model, with unit in basis points
- $$c_t$$ denotes the instantaneous cost when rebalancing positon at time t
- $$\lambda$$ denotes the exponential decay; $$\frac{\ln 2}{\lambda}$$ represents the half-life in the Markov propagator model
- $$\gamma$$ denotes trades loading, i.e. the push in propagator model
