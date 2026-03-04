FROM nvidia/cuda:12.2.0-devel-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    git cmake build-essential \
    libboost-all-dev libeigen3-dev libceres-dev \
    libflann-dev libfreeimage-dev libmetis-dev \
    libgoogle-glog-dev libgflags-dev libsqlite3-dev \
    libglew-dev qtbase5-dev libqt5opengl5-dev \
    ffmpeg curl wget \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/colmap/colmap.git /opt/colmap && \
    cd /opt/colmap && mkdir build && cd build && \
    cmake .. -DCMAKE_CUDA_ARCHITECTURES="all-major" && \
    make -j$(nproc) && make install

RUN pip3 install --upgrade pip && \
    pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu121 && \
    pip3 install nerfstudio gsplat

RUN pip3 install requests pillow

WORKDIR /app
COPY worker.py /app/
COPY export_splat.py /app/
COPY entrypoint.sh /app/

ENTRYPOINT ["/app/entrypoint.sh"]
