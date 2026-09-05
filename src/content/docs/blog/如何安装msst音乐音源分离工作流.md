---
title: "如何搭建自己的音乐音源分离工作流（MSST）"
description: "基于ZFTurbo的Music-Source-Separation-Training，把一首歌拆成伴奏、人声甚至鼓点贝斯的工作流安装教程。"
pubDate: "2026-09-05"
---

# 把一首歌拆成伴奏和人声，其实没那么难

> 作为一位音游玩家和折腾党，我最近迷上了"音源分离"这个魔法 —— 让 AI 把一首歌拆成伴奏、人声、贝斯、鼓点……甚至还能让人声"去混响"变成干音。这套魔法背后的引擎叫做 **MSST**，今天就带你在本地把它跑起来。

这里我默认你已经对 **Python**、**命令行** 以及 **Git** 有一定的认知。如果你只想"拿来就能用的傻瓜画图界面"，可以直接跳到文末的 **善后工作**，我用的是更适合折腾党的命令行方案。

本地环境需求如下（缺一不可）：

1. **Python 3.11**（MSST 官方推荐 **3.11.6**）
   * 前往 [Python 官网](https://www.python.org/downloads/)，或用 `conda` 创建
2. **NVIDIA 显卡 + 正确的显卡驱动**（有 `nvidia-smi` 就行）
   * 没有 GPU 也能跑推理，只是会慢到怀疑人生
3. **Git**（用于克隆项目）：
   * 前往 [Git 官网](https://git-scm.com/) 下载安装

> **⚠️ 先看这条**：这套引擎的图形界面 **MSST-WebUI** 官方已停止开发/维护，团队整体转向了更适合新手的 **[Pymss-Studio](https://github.com/pymss-project/pymss-studio)**。这篇教程讲的 MSST 命令行底层依然可用、也依然是最"原味"的方案；但如果你只想要图形界面，文末 **善后工作** 里有官方继任者的三件套指引，直接跳过去更省事。

# 这个框架是干嘛的

---

首先介绍 **MSST**，全称 **Music Source Separation Training**，是 [ZFTurbo](https://github.com/ZFTurbo) 开发的一个**训练+推理一体**的音乐音源分离框架，由 [MVSep.com](https://mvsep.com) 提供支持。它的秘诀在于：底层封装了多套分离引擎，你只要用一条命令换一个参数，就能在**不同的 AI 模型**之间自由切换。

所以你会听到一堆名词，其实它们都是 MSST 支持的**同一类引擎**：

- **Demucs**：法国 Meta 团队出品的经典模型，能把歌拆成 4 轨甚至 6 轨
- **BS Roformer**：当下最流行的人声分离模型，效果最好的那批基本都能带它
- **Mel-Roformer**：经典卡拉 OK / 人声分离元老
- **SCNet**：新一代多轨分离，效果越来越能打

一句话，**MSST 是个"引擎停车场"**，你配一个模型参数，它就开哪辆车出来干活。

# 开始本地搭建

---

## 1/4：克隆代码仓库

---

1. 打开命令行（Windows 用终端、Linux 用 Bash 都行），敲入：

```bash
git clone https://github.com/ZFTurbo/Music-Source-Separation-Training.git
cd Music-Source-Separation-Training
```

**(这一步没有任何技巧，等进度条走到 100% 就好)**

## 2/4：创建 Python 环境

---

MSST 依赖较多，**强烈建议**建一个独立环境，别污染你系统里已装的 Python。官方文档指名的 Python 版本是 **3.11.6**。

用哪些方式都行，推荐用 `conda`（隔离最干净）：

```bash
# 创建一个名叫 msst 的独立环境
conda create -n msst python=3.11 -y
conda activate msst
```

如果你用的是 Windows 又懒得装 conda，也可以直接下载 [Python 3.11.6](https://www.python.org/ftp/python/3.11.6/python-3.11.6-amd64.exe) 安装包，装完在命令行里：

```bash
python --version
# 只要输出的版本是 3.11.x 即可
```

## 3/4：安装 PyTorch（内存肥肉，先装它）

---

这是**最关键的一步**，也是新手最容易踩坑的地方。

**一定要先单独装带 CUDA 的 PyTorch，再装 requirements。** 因为 `requirements.txt` 里只写了 `torch>=2.0.1`，如果你直接 `pip install -r requirements.txt`，它会默认给你装**CPU 版**，你的显卡直接沦为摆设。

* 先确认你的显卡驱动支持 CUDA：命令行输入 `nvidia-smi`，能看到显卡信息就说明 OK

然后按你的 CUDA 版本选择：

```bash
# 推荐：CUDA 12.1 版（对应最新主流驱动）
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121

# 如果你的驱动较老，试试 CUDA 11.8
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# 实在没有显卡，装 CPU 版（能跑，但很慢）
pip install torch torchaudio
```

装完检查一下显卡有没有被认出来：

```bash
python -c "import torch; print(torch.cuda.is_available())"
# 输出 True 说明 PyTorch 成功用上显卡了
```

**(如果输出 False，多半是 CUDA 版本和驱动不匹配，回去重新选 cu121/cu118)**

## 4/4：安装项目依赖

---

回到项目根目录，装剩下的依赖：

```bash
pip install -r requirements.txt
```

这一步会下载一堆东西（PyTorch 之外还有 `librosa`、`demucs`、`transformers` 等等），耐心等它跑完。**期间出现红色的进度条或警告很正常，只要最后没有 ERROR 就行。**

### Windows 用户必读（少这一步必挂）

如果你在 Windows，`requirements.txt` 里有个叫 `wxpython` 的东西是桌面界面用的，编译它在缺东西时会报错。所以**先装两样微软的组件**：

* [Microsoft Visual C++ 2015-2022 (x64) 运行库](https://aka.ms/vs/17/release/vc_redist.x64.exe)
* [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（安装时勾选 "Desktop development with C++"）

**(不装这两个，你不是在装 MSST，而是在体验"编译错误大赏")**

### 让音频格式识别更全

MSST 读音频主要靠 `librosa` 和 `soundfile`。要想畅读 MP3 / FLAC 等非 WAV 格式，建议顺手装个 **ffmpeg**：

```bash
# Windows（用包管理器，如果是 brew/choco 用法类似）
choco install ffmpeg
```

# 准备模型权重

---

MSST **不会自动帮你下载模型**，这点和很多傻瓜画图软件不一样。你需要**手动下载两个文件**，配合一条命令使用：

1. **Config 文件（`.yaml`）**：告诉 MSST 这个模型是什么架构
2. **权重文件（`.ckpt` / `.th`）**：模型真正的"大脑"

下载后建议全部丢进项目根目录下的 `weights/` 文件夹（没有就自己建一个），用的时候指定路径即可。

## 最推荐的人声分离模型

如果只想把**伴奏和人声分开**，首选 **BS Roformer**（社区口碑最好）：

* Config：[model_bs_roformer_ep_317_sdr_12.9755.yaml](https://raw.githubusercontent.com/ZFTurbo/Music-Source-Separation-Training/main/configs/viperx/model_bs_roformer_ep_317_sdr_12.9755.yaml)
* 权重：[model_bs_roformer_ep_317_sdr_12.9755.ckpt](https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/model_bs_roformer_ep_317_sdr_12.9755.ckpt)

**(注意权重文件很大，RoFormer 类普遍在 100MB 到 1GB 以上，下载前先看下磁盘空间)**

完整的模型列表（人声 / 单轨 / 多轨都有）都在项目文档 `docs/pretrained_models.md` 里，表格里的 Config 和 Checkpoint 两头链接点开就是。

# 跑起来！一条命令分离音频

---

## 基本用法

把你想分离的歌曲放进一个文件夹（比如 `input/songs/`），然后：

```bash
python inference.py \
    --model_type bs_roformer \
    --config_path weights/model_bs_roformer_ep_317_sdr_12.9755.yaml \
    --start_check_point weights/model_bs_roformer_ep_317_sdr_12.9755.ckpt \
    --input_folder input/songs/ \
    --store_dir output/separated/
```

跑完后，`output/separated/` 里会出现类似这样的结构：

```
output/separated/
└── song1/
    ├── vocals.wav          # 人声
    └── instrumental.wav    # 伴奏
```

**(要是想连伴奏一起输出来，在命令里加上 `--extract_instrumental` 就行)**

## 常用参数速查

| 参数 | 作用 |
|---|---|
| `--model_type` | 选引擎：`bs_roformer` / `mel_band_roformer` / `htdemucs` / `mdx23c` / `scnet` … |
| `--extract_instrumental` | 额外输出伴奏（原曲 - 人声） |
| `--use_tta` | 测试时增强，效果更干净但慢三倍 |
| `--force_cpu` | 强制用 CPU 跑（没显卡的人保命用） |
| `--device_ids 0` | 指定使用哪块显卡 |
| `--flac_file` | 输出 FLAC 而非 WAV 格式 |
| `--filename_template "{file_name}/{instr}"` | 自定义输出文件命名 |

---

# 一些善后工作

---

Q：我不想敲命令行，有没有图形界面？
A：有。ZFTurbo 官方有个 `python gui-wx.py` 桌面程序，社区大佬也做了 [SUC-DriverOld/MSST-WebUI](https://github.com/SUC-DriverOld/MSST-WebUI)，把 MSST 和 UVR 打包成了网页界面——**我本机那套"音轨分离"就是这个**。

**但是请注意！** MSST-WebUI 的官方语雀文档已经声明：**即将停止开发/维护 MSST-WebUI，转向开发 Pymss-Studio**。如果你正准备从头装图形界面，强烈建议直接看下面的 Pymss-Studio，免得刚上手就撞上停止维护的坑。

[Pymss-Studio](https://github.com/pymss-project/pymss-studio) 是官方钦定的继任者，**同样完全开源免费**，但处处更强：支持**更多模型**、**推理速度更快**、GUI **更美观**、还**跨平台**（Windows / macOS / Linux / 甚至 Apple Silicon 用 MLX 加速）。它拆成三件套：

* [pymss-studio](https://github.com/pymss-project/pymss-studio)：跨平台桌面软件（下载安装包即用，直接给你图形界面）
* [pymss](https://github.com/pymss-project/pymss)：Python 核心依赖包（走命令行 / API，一句话调用、模型按名自动下载）
* [comfy-mss](https://github.com/pymss-project/comfy-mss)：给 ComfyUI 用的音频分离自定义节点

而且 Pymss-Studio 安装起来比 MSST 省心得多——不像 MSST 那样要手动下载模型再手动指定路径，它 `pip install pymss` 之后，第一次运行会自动下载缺失的模型。如果你的机器是 NVIDIA 显卡，装 **Windows CUDA 版**能比 MSST-WebUI 快出一截；苹果 M 系芯片（M1/M2/M3/M4）还有专吃的 **MLX 后端**。

Q：`requirements.txt` 装到一半报错，说缺什么 C++ 编译器？
A：回看第 4 步的 **Windows 必读**。去装 Microsoft C++ Build Tools，勾选 "Desktop development with C++"，装完重开命令行再 `pip install -r requirements.txt`。

Q：为什么我分离出来的音乐有噪声，或者人声不干净？
A：两个可能。一是换更强的模型（试试 `mel_band_roformer`）；二是加 `--use_tta` 让它在三个方向上各跑一遍再平均，代价是慢，但质量肉眼可见地提升。

Q：分离一个文件要多久？
A：看你显卡。有 8GB+ 显存的显卡，一首 5 分钟的歌通常几秒到十几秒；用 CPU 的话，可能要几分钟到十几分钟。别急，第一次跑时它要先加载模型，会卡在 0% 一小会儿，那是正常的。

---

- 这篇教程献给 **只是想干干净净地把一首歌拆开，却不知道该从哪台"引擎"开始折腾的你** 。

- 本站基于开源框架 **Astro** 和其组件 **Starlight** 搭建，托管于 **GitHub Pages**。
  在此，特别感谢 **Gemini (AI)** 在本地环境配置、网络镜像调优及 CI/CD 自动化工作流规划中提供的全方位技术支持与陪伴。
