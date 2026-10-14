---
title: "如何搭建自己的音乐音源分离工作流（MSST）"
description: "基于ZFTurbo的Music-Source-Separation-Training，把一首歌拆成伴奏、人声甚至鼓点贝斯的工作流安装教程。"
pubDate: "2026-09-05"
tags:
  - "AI工具"
  - "音频处理"
  - "工作流"
---

# 把一首歌拆成伴奏和人声，其实没那么难

音游玩家或者做二创的朋友经常需要从音乐里提取伴奏或纯人声。基于 ZFTurbo 开源的 **MSST**（Music Source Separation Training），可以在本地用显卡把一首歌拆成伴奏、人声、贝斯，甚至还能做人声去混响。下面记录一下完整的本地环境搭建与推理命令。

这里默认你对 Python、命令行以及 Git 有一定了解。如果你只想用开箱即用的图形界面，可以直接翻到文末的 Q&A，文末有官方继任工具的指引。

本地运行环境需求：

1. **Python 3.11**（MSST 官方推荐 **3.11.6**）
   * 前往 [Python 官网](https://www.python.org/downloads/) 下载，或者用 `conda` 创建环境。
2. **NVIDIA 显卡与驱动**（能在终端里敲出 `nvidia-smi` 即可）
   * 没有 GPU 也能用 CPU 跑，但处理速度会非常慢。
3. **Git**
   * 前往 [Git 官网](https://git-scm.com/) 下载安装。

> **提示**：这套引擎原先的网页界面 **MSST-WebUI** 已经停止维护，开发团队转向了更适合新手的 **[Pymss-Studio](https://github.com/pymss-project/pymss-studio)**。如果你想要开箱即用的图形界面，文末提供了 Pymss-Studio 的安装指引；如果想走纯命令行批量处理，继续往下看即可。

## MSST 是干什么用的

**MSST** 全称是 **Music Source Separation Training**，由开发者 [ZFTurbo](https://github.com/ZFTurbo) 开源，[MVSep.com](https://mvsep.com) 提供支持。它把当下主流的几种音频分离模型整合到了一个工程里，你只需要修改一行命令参数，就能切换不同的算法模型：

- **Demucs**：Meta 团队出品的经典模型，支持拆分 4 轨或 6 轨。
- **BS Roformer**：目前提取人声最干净的模型之一，社区口碑很好。
- **Mel-Roformer**：适合卡拉 OK 伴奏提取的老牌模型。
- **SCNet**：新一代的多轨分离算法。

你可以把它理解成一个统一的调度器，配好模型权重，它就调对应的模型去处理音频。

## 本地搭建步骤

### 1. 克隆代码仓库

打开终端，输入：

```bash
git clone https://github.com/ZFTurbo/Music-Source-Separation-Training.git
cd Music-Source-Separation-Training
```

等待代码拉取完成即可。

### 2. 创建 Python 独立环境

MSST 依赖较多，强烈建议单独创建一个虚拟环境，避免和系统里的 Python 包冲突。官方推荐 Python **3.11.6**。

推荐使用 `conda` 管理：

```bash
# 创建独立环境
conda create -n msst python=3.11 -y
conda activate msst
```

如果不习惯用 conda，也可以去下载 [Python 3.11.6](https://www.python.org/ftp/python/3.11.6/python-3.11.6-amd64.exe) 安装包，装完后在终端检查版本：

```bash
python --version
# 输出 3.11.x 即可
```

### 3. 安装带 CUDA 的 PyTorch

这一步是配置的核心，顺序不能弄错。

**必须先手动安装带 CUDA 支持的 PyTorch，然后再安装项目的 requirements.txt。** 如果直接装 requirements，pip 会默认安装 CPU 版 PyTorch，导致显卡无法调用。

先在终端运行 `nvidia-smi` 确认显卡驱动正常，然后根据驱动选择对应的安装命令：

```bash
# 推荐：CUDA 12.1 版（对应较新的驱动）
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121

# 驱动较老时可换 CUDA 11.8
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# 无独立显卡时装 CPU 版
pip install torch torchaudio
```

安装完成后，在终端验证 PyTorch 是否能正确识别显卡：

```bash
python -c "import torch; print(torch.cuda.is_available())"
# 正常应输出 True
```

如果输出 False，说明安装的 CUDA 版本与本地显卡驱动不匹配，需要重新核对驱动支持的 CUDA 版本。

### 4. 安装项目依赖

回到项目根目录，安装其余 Python 依赖：

```bash
pip install -r requirements.txt
```

#### Windows 用户避坑注意
在 Windows 下，`requirements.txt` 里的某些库（如 `wxpython`）在编译时如果缺少 C++ 环境会直接报错，建议提前装好微软的运行组件：
- [Microsoft Visual C++ 2015-2022 (x64) 运行库](https://aka.ms/vs/17/release/vc_redist.x64.exe)
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（安装时勾选 "Desktop development with C++"）

#### 安装 ffmpeg 扩充格式支持
MSST 读取音频主要依赖 `librosa` 和 `soundfile`。为了能正常读取 MP3、FLAC 等常见格式，建议顺手安装 **ffmpeg**：

```bash
# Windows 用 choco 安装，或者去官网下载解压并把 bin 目录加入系统环境变量
choco install ffmpeg
```

## 准备模型权重

MSST 不会自动在后台拉取模型文件。每次跑模型之前，需要**手动准备好两个配套文件**：

1. **配置文件（`.yaml`）**：定义模型的网络结构。
2. **权重文件（`.ckpt` 或 `.th`）**：训练好的模型参数。

下载完成后，在项目根目录下新建一个 `weights/` 文件夹，把两个文件丢进去，推理时在参数里填上路径即可。

### 推荐人声分离模型配置

如果日常需求是**剥离人声与伴奏**，推荐优先使用 **BS Roformer**：

- 配置文件：[model_bs_roformer_ep_317_sdr_12.9755.yaml](https://raw.githubusercontent.com/ZFTurbo/Music-Source-Separation-Training/main/configs/viperx/model_bs_roformer_ep_317_sdr_12.9755.yaml)
- 权重文件：[model_bs_roformer_ep_317_sdr_12.9755.ckpt](https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/model_bs_roformer_ep_317_sdr_12.9755.ckpt)

权重文件普遍在几百兆到 1GB 以上，下载前注意确认硬盘空间。完整模型列表可以在项目仓库的 `docs/pretrained_models.md` 中查阅。

## 运行推理：分离音频

### 基本命令

把需要处理的音频文件放到一个文件夹里（比如 `input/songs/`），然后运行：

```bash
python inference.py \
    --model_type bs_roformer \
    --config_path weights/model_bs_roformer_ep_317_sdr_12.9755.yaml \
    --start_check_point weights/model_bs_roformer_ep_317_sdr_12.9755.ckpt \
    --input_folder input/songs/ \
    --store_dir output/separated/
```

处理完成后，输出目录结构如下：

```
output/separated/
└── song1/
    ├── vocals.wav          # 人声轨
    └── instrumental.wav    # 伴奏轨
```

如果需要额外导出消音伴奏，在命令后追加 `--extract_instrumental` 即可。

### 常用参数一览

| 参数 | 作用说明 |
| :--- | :--- |
| `--model_type` | 指定算法架构（如 `bs_roformer`、`mel_band_roformer`、`htdemucs` 等） |
| `--extract_instrumental` | 同步输出原曲减去人声后的伴奏轨 |
| `--use_tta` | 开启测试时增强，提取结果更干净，但处理耗时增加两到三倍 |
| `--force_cpu` | 强制使用 CPU 计算 |
| `--device_ids 0` | 多卡环境下指定使用的显卡编号 |
| `--flac_file` | 输出为无损 FLAC 格式代替默认的 WAV |

## 常见问题与替代方案

### Q：不想敲命令行，有没有开箱即用的图形界面？
原作者自带一个简单的桌面脚本 `python gui-wx.py`，社区也做过打包好的 [MSST-WebUI](https://github.com/SUC-DriverOld/MSST-WebUI)。

但 MSST-WebUI 目前已停止维护，团队正在全力开发新项目 **[Pymss-Studio](https://github.com/pymss-project/pymss-studio)**。它同样完全开源，界面更现代化，且初次运行会自动下载缺失的模型权重，不需要手动搬运 YAML 和 CKPT 文件。追求省心界面的朋友可以直接转向 Pymss-Studio。

### Q：安装依赖时提示缺少 C++ 编译器？
参考步骤 4 的说明，安装 Microsoft C++ Build Tools 并勾选 "Desktop development with C++"，安装完毕后重新开一个终端窗口运行 pip 安装。

### Q：提取出来的人声不够干净怎么办？
可以尝试换用 `mel_band_roformer` 这类大模型，或者在推理命令后追加 `--use_tta` 参数。开启后处理时间会变长，但能有效过滤杂音。

### Q：分离一首歌需要耗费多长时间？
取决于显卡算力。在 8GB 以上显存的显卡上，一首 4 分钟的歌曲通常在 10 到 30 秒内完成；纯靠 CPU 处理则可能需要几分钟。首次运行时加载模型会有片刻停顿，属于正常现象。

---

这篇教程献给只是想干干净净地把一首歌拆开，却不知道该从哪个引擎开始折腾的你。
