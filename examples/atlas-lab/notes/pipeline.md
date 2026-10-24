# 从原始观测，到可讨论的结论

> Mermaid 图表直接嵌入正文。读完流程，还可以继续阅读下面的解释。

## 实验数据流水线

```mermaid
flowchart LR
    A[采集观测] --> B{质量检查}
    B -->|通过| C[轨迹重建]
    B -->|未通过| D[清理与补采]
    D --> A
    C --> E[计算指标]
    E --> F[汇总报告]
    F --> G[引用与讨论]
    classDef input fill:#eff6ff,stroke:#60a5fa,color:#1e3a8a
    classDef process fill:#f0fdf4,stroke:#34d399,color:#065f46
    classDef decision fill:#fff7ed,stroke:#fb923c,color:#9a3412
    classDef output fill:#eef2ff,stroke:#818cf8,color:#3730a3
    class A,D input
    class C,E process
    class B decision
    class F,G output
```

## 为什么保留质量检查

低质量输入会同时影响误差与耗时。先检查观测完整性，再执行重建，可以让后续的对比更有解释力。

## 看清细节

悬停图表显示缩放按钮；按住 Ctrl 并滚动滚轮放大，放大后可拖动。图表原有占位高度保持不变，下面的正文不会被放大操作顶走。
