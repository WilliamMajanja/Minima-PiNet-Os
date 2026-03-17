#!/bin/bash
IP=$1
echo "Starting provisioning for node $IP..."
# Real provisioning steps would go here
# e.g., ssh-copy-id, apt-get update, install minima, join cluster
sleep 2
echo "Configuring WireGuard mesh for $IP..."
sleep 1
echo "Deploying k3s agent to $IP..."
sleep 2
echo "Provisioning complete for $IP."
exit 0
