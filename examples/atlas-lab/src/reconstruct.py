from dataclasses import dataclass
from math import sqrt


@dataclass(frozen=True)
class ExperimentConfig:
    """可复现的实验配置。"""
    seed: int = 42
    samples: int = 128
    noise: float = 0.02


def position_error(predicted, reference):
    """计算每个观测点的欧氏距离。"""
    if len(predicted) != len(reference):
        raise ValueError("轨迹长度必须一致")
    errors = [
        sqrt(sum((a - b) ** 2 for a, b in zip(p, q)))
        for p, q in zip(predicted, reference)
    ]
    return sum(errors) / max(1, len(errors))


config = ExperimentConfig()
print(f"samples={config.samples}, seed={config.seed}")
