# 从观测到估计

## 状态与观测

用状态向量 $\mathbf x_t = [p_t, v_t]^\mathsf T$ 描述位置和速度。时间间隔为 $\Delta t$ 时，有：

$$
\mathbf x_{t+1} =
\underbrace{\begin{bmatrix}1 & \Delta t \\ 0 & 1\end{bmatrix}}_{\mathbf A}
\mathbf x_t + \mathbf w_t
$$

## 贝叶斯更新

将观测证据与先验结合，得到当前状态的后验分布：

$$
p(\mathbf x \mid \mathbf z) =
\frac{p(\mathbf z \mid \mathbf x)\,p(\mathbf x)}
{\int p(\mathbf z \mid \mathbf x')\,p(\mathbf x')\,d\mathbf x'}
$$

> 这里的 $p(\mathbf x)$ 是先验；归一化项保证后验密度的积分为 $1$。

## 两种误差来源

| 符号 | 含义 |
| :--- | :--- |
| $\mathbf Q$ | 状态转移中的过程噪声 |
| $\mathbf R$ | 传感器观测中的测量噪声 |
