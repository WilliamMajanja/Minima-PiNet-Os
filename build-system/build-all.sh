#!/bin/bash
set -e

echo "Starting PiNetOS Build Process..."

# 1. Build Rootfs
./build-rootfs.sh

# 2. Build Image
./build-image.sh

echo "PiNetOS Build Complete!"
